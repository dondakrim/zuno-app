-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

create table if not exists favorite_shops (
  id uuid primary key default uuid_generate_v4(),
  acheteur_id uuid references users(id) on delete cascade,
  vendeur_id uuid references users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (acheteur_id, vendeur_id)
);

alter table favorite_shops enable row level security;
create policy "Lecture des favoris pendant le développement" on favorite_shops for select using (true);
create policy "Ajout aux favoris pendant le développement" on favorite_shops for insert with check (true);
create policy "Suppression des favoris pendant le développement" on favorite_shops for delete using (true);
