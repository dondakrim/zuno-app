-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- La table `reviews` existe déjà, mais sans savoir QUI est noté (le
-- vendeur). On ajoute cette colonne pour pouvoir calculer facilement la
-- note moyenne d'un vendeur.
alter table reviews add column if not exists cible_id uuid references users(id);

alter table reviews enable row level security;
create policy "Lecture des avis pendant le développement" on reviews for select using (true);
create policy "Création d'avis pendant le développement" on reviews for insert with check (true);
