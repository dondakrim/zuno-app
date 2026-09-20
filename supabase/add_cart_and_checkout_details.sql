-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- Panier : un article + une quantité par acheteur.
create table if not exists cart_items (
  id uuid primary key default uuid_generate_v4(),
  acheteur_id uuid references users(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  quantity integer default 1,
  created_at timestamp with time zone default now(),
  unique (acheteur_id, listing_id)
);

alter table cart_items enable row level security;
create policy "Lecture du panier pendant le développement" on cart_items for select using (true);
create policy "Ajout au panier pendant le développement" on cart_items for insert with check (true);
create policy "Mise à jour du panier pendant le développement" on cart_items for update using (true);
create policy "Suppression du panier pendant le développement" on cart_items for delete using (true);

-- Quantité et frais de livraison sur la commande.
alter table orders add column if not exists quantite integer default 1;
alter table orders add column if not exists frais_livraison numeric default 0;
alter table orders add column if not exists mode_livraison text;

-- Informations de contact et créneau sur la livraison.
alter table deliveries add column if not exists nom_contact text;
alter table deliveries add column if not exists telephone_contact text;
alter table deliveries add column if not exists quartier text;
alter table deliveries add column if not exists heure_livraison text;
