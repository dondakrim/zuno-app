-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- La lecture de la table users devient réservée à soi-même (ou un admin) :
-- personne ne peut plus faire un simple "select * from users" pour
-- récupérer les emails et motifs de suspension de tout le monde.
drop policy if exists "Lecture publique des utilisateurs" on users;
create policy "Lire son propre profil (ou par un admin)" on users
  for select using (auth.uid() = id or auth.uid() in (select id from admins));

-- Une vue publique expose uniquement les champs nécessaires au bon
-- fonctionnement du marketplace (nom, boutique, ville, photo, statut
-- d'identité — et le téléphone/WhatsApp, volontairement affichés aux
-- acheteurs intéressés par une annonce précise, comme sur toute
-- marketplace classique). L'email, le motif de suspension et le chemin
-- de la pièce d'identité restent exclus : aucune raison qu'ils soient
-- visibles ailleurs que dans le tableau de bord admin.
create or replace view public_profiles as
  select id, nom, telephone, whatsapp, boutique_nom, ville, photo_url, identity_status, created_at
  from users;

grant select on public_profiles to anon, authenticated;
