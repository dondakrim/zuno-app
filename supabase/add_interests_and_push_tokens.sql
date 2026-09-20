-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- Centres d'intérêt choisis à la première ouverture de l'appli.
alter table users add column if not exists interets text[];

-- Un jeton de notification par appareil (permet d'envoyer une notification
-- push à ce téléphone précis, même quand l'appli est fermée).
create table if not exists push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  token text unique not null,
  created_at timestamp with time zone default now()
);

alter table push_tokens enable row level security;
create policy "Lecture des jetons pendant le développement" on push_tokens for select using (true);
create policy "Création de jetons pendant le développement" on push_tokens for insert with check (true);
create policy "Mise à jour des jetons pendant le développement" on push_tokens for update using (true);
