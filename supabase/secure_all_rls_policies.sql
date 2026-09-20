-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- ATTENTION : ce script part du principe que la connexion anonyme
-- Supabase est active (voir README, Étape 29) et que l'appli mobile a
-- déjà été mise à jour pour l'utiliser. Sans ça, plus rien ne
-- fonctionnera après avoir exécuté ce script — chaque requête de l'appli
-- doit venir d'une vraie session pour être acceptée.

-- ============================================================
-- USERS
-- ============================================================
-- La lecture reste publique : les noms, photos et boutiques doivent
-- rester visibles par tous pour que le marketplace fonctionne (fiches
-- produit, avis, boutiques favorites...). Limite connue et acceptée :
-- le téléphone/WhatsApp/email restent techniquement lisibles par
-- quiconque interroge directement la table plutôt que via l'appli — un
-- vrai cloisonnement par colonne demanderait une vue dédiée, à
-- envisager plus tard si besoin.
drop policy if exists "Création ouverte pendant le développement" on users;
create policy "Création de son propre compte uniquement" on users
  for insert with check (auth.uid() = id);

drop policy if exists "Mise à jour du profil avec identité protégée" on users;
create policy "Mise à jour de son propre profil (ou par un admin)" on users
  for update using (auth.uid() = id or auth.uid() in (select id from admins))
  with check (
    (identity_status is distinct from 'verifiee' or auth.uid() in (select id from admins))
  );

-- ============================================================
-- LISTINGS
-- ============================================================
-- La lecture reste publique (c'est le principe même du marketplace).
drop policy if exists "Insertion ouverte pendant le développement" on listings;
create policy "Publier une annonce sous sa propre identité" on listings
  for insert with check (auth.uid() = vendeur_id);

create policy "Modifier sa propre annonce (ou par un admin)" on listings
  for update using (auth.uid() = vendeur_id or auth.uid() in (select id from admins));

create policy "Supprimer sa propre annonce (ou par un admin)" on listings
  for delete using (auth.uid() = vendeur_id or auth.uid() in (select id from admins));

-- Empêche un vendeur de modifier lui-même les champs réservés aux admins
-- (statut de modération, mise en avant, priorité) en les repassant à
-- leur ancienne valeur si la personne qui modifie n'est pas admin.
create or replace function protect_listing_admin_fields()
returns trigger as $$
begin
  if not (auth.uid() in (select id from admins)) then
    new.moderation_status := old.moderation_status;
    new.moderation_score := old.moderation_score;
    new.moderation_flags := old.moderation_flags;
    new.boost_until := old.boost_until;
    new.priority := old.priority;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_listing_admin_fields on listings;
create trigger trg_protect_listing_admin_fields
before update on listings
for each row execute function protect_listing_admin_fields();

-- ============================================================
-- MESSAGES — privés, seuls les deux participants doivent les lire
-- ============================================================
drop policy if exists "Lecture des messages pendant le développement" on messages;
create policy "Lire ses propres messages" on messages
  for select using (auth.uid() = expediteur_id or auth.uid() = destinataire_id);

drop policy if exists "Envoi de messages pendant le développement" on messages;
create policy "Envoyer un message sous sa propre identité" on messages
  for insert with check (auth.uid() = expediteur_id);

-- ============================================================
-- ORDERS
-- ============================================================
drop policy if exists "Lecture des commandes pendant le développement" on orders;
create policy "Lire ses commandes (achat ou vente)" on orders
  for select using (
    auth.uid() = acheteur_id
    or auth.uid() in (select vendeur_id from listings where id = orders.listing_id)
    or auth.uid() in (select id from admins)
  );

drop policy if exists "Création de commandes pendant le développement" on orders;
create policy "Passer une commande sous sa propre identité" on orders
  for insert with check (auth.uid() = acheteur_id);

drop policy if exists "Mise à jour des commandes pendant le développement" on orders;
create policy "Mettre à jour ses commandes (achat ou vente)" on orders
  for update using (
    auth.uid() = acheteur_id
    or auth.uid() in (select vendeur_id from listings where id = orders.listing_id)
    or auth.uid() in (select id from admins)
  );

-- ============================================================
-- DELIVERIES — mêmes règles que la commande associée
-- ============================================================
drop policy if exists "Lecture des livraisons pendant le développement" on deliveries;
create policy "Lire les livraisons de ses commandes" on deliveries
  for select using (
    exists (
      select 1 from orders o
      left join listings l on l.id = o.listing_id
      where o.id = deliveries.order_id
        and (o.acheteur_id = auth.uid() or l.vendeur_id = auth.uid())
    )
    or auth.uid() in (select id from admins)
  );

drop policy if exists "Création de livraisons pendant le développement" on deliveries;
create policy "Créer la livraison de sa propre commande" on deliveries
  for insert with check (
    exists (select 1 from orders o where o.id = deliveries.order_id and o.acheteur_id = auth.uid())
  );

drop policy if exists "Mise à jour des livraisons pendant le développement" on deliveries;
create policy "Mettre à jour les livraisons de ses commandes" on deliveries
  for update using (
    exists (
      select 1 from orders o
      left join listings l on l.id = o.listing_id
      where o.id = deliveries.order_id
        and (o.acheteur_id = auth.uid() or l.vendeur_id = auth.uid())
    )
    or auth.uid() in (select id from admins)
  );

-- ============================================================
-- REVIEWS — lecture publique (comme des avis produits), écriture
-- réservée à son auteur
-- ============================================================
drop policy if exists "Création d'avis pendant le développement" on reviews;
create policy "Laisser un avis sous sa propre identité" on reviews
  for insert with check (auth.uid() = auteur_id);

-- ============================================================
-- CART_ITEMS, FAVORITE_SHOPS, WISHLIST_ITEMS, PUSH_TOKENS
-- Données strictement personnelles.
-- ============================================================
drop policy if exists "Lecture du panier pendant le développement" on cart_items;
drop policy if exists "Ajout au panier pendant le développement" on cart_items;
drop policy if exists "Mise à jour du panier pendant le développement" on cart_items;
drop policy if exists "Suppression du panier pendant le développement" on cart_items;
create policy "Gérer son propre panier" on cart_items
  for all using (auth.uid() = acheteur_id or auth.uid() in (select id from admins))
  with check (auth.uid() = acheteur_id);

drop policy if exists "Lecture des favoris pendant le développement" on favorite_shops;
drop policy if exists "Ajout aux favoris pendant le développement" on favorite_shops;
drop policy if exists "Suppression des favoris pendant le développement" on favorite_shops;
create policy "Gérer ses propres boutiques favorites" on favorite_shops
  for all using (auth.uid() = acheteur_id) with check (auth.uid() = acheteur_id);

drop policy if exists "Lecture de la liste d'envies pendant le développement" on wishlist_items;
drop policy if exists "Ajout à la liste d'envies pendant le développement" on wishlist_items;
drop policy if exists "Suppression de la liste d'envies pendant le développement" on wishlist_items;
create policy "Gérer sa propre liste d'envies" on wishlist_items
  for all using (auth.uid() = acheteur_id) with check (auth.uid() = acheteur_id);

drop policy if exists "Lecture des jetons pendant le développement" on push_tokens;
drop policy if exists "Création de jetons pendant le développement" on push_tokens;
drop policy if exists "Mise à jour des jetons pendant le développement" on push_tokens;
create policy "Gérer son propre jeton de notification" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- OFFERS
-- ============================================================
drop policy if exists "Lecture des offres pendant le développement" on offers;
create policy "Lire ses propres offres (achat ou vente)" on offers
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Création d'offres pendant le développement" on offers;
create policy "Faire une offre sous sa propre identité" on offers
  for insert with check (auth.uid() = buyer_id);

drop policy if exists "Mise à jour des offres pendant le développement" on offers;
create policy "Répondre à une offre reçue" on offers
  for update using (auth.uid() = seller_id);

-- ============================================================
-- ORDER_DISPUTES
-- ============================================================
drop policy if exists "Lecture des litiges pendant le développement" on order_disputes;
create policy "Lire les litiges qui me concernent" on order_disputes
  for select using (
    auth.uid() = opened_by
    or auth.uid() in (
      select l.vendeur_id from orders o join listings l on l.id = o.listing_id
      where o.id = order_disputes.order_id
    )
    or auth.uid() in (select id from admins)
  );

drop policy if exists "Création de litiges pendant le développement" on order_disputes;
create policy "Signaler un litige sous sa propre identité" on order_disputes
  for insert with check (auth.uid() = opened_by);

-- ============================================================
-- BOOST_REQUESTS
-- ============================================================
drop policy if exists "Lecture des demandes de boost pendant le développement" on boost_requests;
create policy "Lire ses propres demandes de mise en avant" on boost_requests
  for select using (auth.uid() = vendeur_id or auth.uid() in (select id from admins));

drop policy if exists "Création de demandes de boost pendant le développement" on boost_requests;
create policy "Demander une mise en avant sous sa propre identité" on boost_requests
  for insert with check (auth.uid() = vendeur_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
drop policy if exists "Lecture des notifications pendant le développement" on notifications;
create policy "Lire ses propres notifications" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Création de notifications pendant le développement" on notifications;
create policy "Création de notifications réservée aux admins" on notifications
  for insert with check (auth.uid() in (select id from admins));

drop policy if exists "Mise à jour des notifications pendant le développement" on notifications;
create policy "Marquer ses propres notifications comme lues" on notifications
  for update using (auth.uid() = user_id);

-- ============================================================
-- MODERATION_QUEUE, MODERATION_LOGS — données internes, réservées aux
-- admins en lecture (le tableau de bord web est l'outil prévu pour ça,
-- pas l'appli mobile)
-- ============================================================
drop policy if exists "Lecture de la file de moderation pendant le developpement" on moderation_queue;
create policy "Lecture de la modération réservée aux admins" on moderation_queue
  for select using (auth.uid() in (select id from admins));

drop policy if exists "Creation dans la file de moderation pendant le developpement" on moderation_queue;
create policy "Signaler une annonce sous sa propre identité (ou système)" on moderation_queue
  for insert with check (reporter_id is null or auth.uid() = reporter_id);

drop policy if exists "Lecture des logs de moderation pendant le developpement" on moderation_logs;
create policy "Lecture des logs réservée aux admins" on moderation_logs
  for select using (auth.uid() in (select id from admins));

drop policy if exists "Creation de logs de moderation pendant le developpement" on moderation_logs;
create policy "Créer un log en étant connecté" on moderation_logs
  for insert with check (auth.uid() is not null);

-- ============================================================
-- CATEGORIES et PAYMENTS — jamais sécurisées jusqu'ici, on comble l'oubli
-- ============================================================
alter table categories enable row level security;
create policy "Lecture publique des catégories" on categories for select using (true);

alter table payments enable row level security;
create policy "Paiements réservés aux admins" on payments
  for all using (auth.uid() in (select id from admins));
