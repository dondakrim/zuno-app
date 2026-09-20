-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- Comptes administrateurs : une vraie connexion email/mot de passe
-- (via Supabase Auth), distincte de l'identité de test utilisée dans
-- l'appli mobile. Seuls les comptes présents dans cette table pourront
-- valider une identité ou traiter un litige/une modération.
create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamp with time zone default now()
);

alter table admins enable row level security;
create policy "Un admin peut lire sa propre ligne" on admins for select using (auth.uid() = id);

-- Vérification d'identité des vendeurs.
-- non_soumise | en_attente | verifiee | rejetee
alter table users add column if not exists id_document_url text;
alter table users add column if not exists identity_status text default 'non_soumise';

-- Le profil (centres d'intérêt, soumission d'identité...) reste modifiable
-- par tout le monde comme le reste de l'appli pendant le développement,
-- SAUF le passage à "verifiee" qui est réservé aux comptes admin.
create policy "Mise à jour du profil avec identité protégée" on users
  for update using (true)
  with check (identity_status is distinct from 'verifiee' or auth.uid() in (select id from admins));

-- Les décisions de modération et de litiges deviennent réservées aux
-- admins (la création/lecture reste ouverte, utilisée par l'appli).
drop policy if exists "Mise a jour de la file de moderation pendant le developpement" on moderation_queue;
create policy "Mise à jour de la modération réservée aux admins" on moderation_queue
  for update using (auth.uid() in (select id from admins));

drop policy if exists "Mise à jour des litiges pendant le développement" on order_disputes;
create policy "Mise à jour des litiges réservée aux admins" on order_disputes
  for update using (auth.uid() in (select id from admins));

-- Lecture des pièces d'identité réservée aux admins (le bucket de stockage
-- doit être créé manuellement en "privé", voir README).
create policy "Admins peuvent lire les documents d'identité"
on storage.objects for select
using (
  bucket_id = 'identity-documents'
  and auth.uid() in (select id from admins)
);

-- Le dépôt reste ouvert (comme pour les photos d'annonces), sinon un
-- vendeur ne pourrait jamais envoyer sa pièce la première fois.
create policy "Tout le monde peut déposer un document d'identité"
on storage.objects for insert
with check (bucket_id = 'identity-documents');
