-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- Autorise la création de commandes et de livraisons, comme on l'a déjà
-- fait pour les tables listings, users et messages.

alter table orders enable row level security;
create policy "Lecture des commandes pendant le développement" on orders for select using (true);
create policy "Création de commandes pendant le développement" on orders for insert with check (true);
create policy "Mise à jour des commandes pendant le développement" on orders for update using (true);

alter table deliveries enable row level security;
create policy "Lecture des livraisons pendant le développement" on deliveries for select using (true);
create policy "Création de livraisons pendant le développement" on deliveries for insert with check (true);
create policy "Mise à jour des livraisons pendant le développement" on deliveries for update using (true);
