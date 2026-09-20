-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

create table if not exists ads (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subtitle text,
  image_url text,
  color text default '#2E0B8C',
  active boolean default true,
  position integer default 0,
  created_at timestamp with time zone default now()
);

alter table ads enable row level security;
create policy "Lecture publique des publicités" on ads for select using (true);
create policy "Création de publicités réservée aux admins" on ads
  for insert with check (auth.uid() in (select id from admins));
create policy "Modification des publicités réservée aux admins" on ads
  for update using (auth.uid() in (select id from admins));
create policy "Suppression des publicités réservée aux admins" on ads
  for delete using (auth.uid() in (select id from admins));

-- Le dépôt d'image est réservé aux admins ; la lecture est publique
-- automatiquement puisque le bucket sera créé en mode "public".
create policy "Admins peuvent déposer des images de publicité"
on storage.objects for insert
with check (bucket_id = 'ad-images' and auth.uid() in (select id from admins));

create policy "Admins peuvent supprimer des images de publicité"
on storage.objects for delete
using (bucket_id = 'ad-images' and auth.uid() in (select id from admins));
