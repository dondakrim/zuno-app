-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- Mise en avant payante d'une annonce (500 FCFA / 3 jours par défaut).
-- Comme le paiement en ligne (MyNITA) n'est pas encore branché, la
-- demande est créée immédiatement mais reste "en_attente" jusqu'à ce
-- qu'un admin confirme avoir reçu le paiement (mobile money, manuel).
alter table listings add column if not exists boost_until timestamptz;

create table if not exists boost_requests (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete cascade,
  vendeur_id uuid references users(id),
  amount numeric default 500,
  duration_days integer default 3,
  status text default 'en_attente', -- en_attente | paye | rejete
  created_at timestamp with time zone default now(),
  confirmed_at timestamp with time zone
);

alter table boost_requests enable row level security;
create policy "Lecture des demandes de boost pendant le développement" on boost_requests for select using (true);
create policy "Création de demandes de boost pendant le développement" on boost_requests for insert with check (true);
create policy "Mise à jour des demandes de boost réservée aux admins" on boost_requests
  for update using (auth.uid() in (select id from admins));

-- Bannissement de compte (utilisateurs récidivistes).
alter table users add column if not exists is_banned boolean default false;
alter table users add column if not exists ban_reason text;

-- Empêche quiconque (y compris la personne bannie elle-même, via l'appli)
-- de modifier is_banned ou ban_reason sans être admin — dans un sens
-- comme dans l'autre. Une policy simple ne suffit pas ici car elle ne
-- peut pas comparer l'ancienne et la nouvelle valeur ; un déclencheur le
-- peut.
create or replace function protect_ban_fields()
returns trigger as $$
begin
  if not (auth.uid() in (select id from admins)) then
    new.is_banned := old.is_banned;
    new.ban_reason := old.ban_reason;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_ban_fields on users;
create trigger trg_protect_ban_fields
before update on users
for each row execute function protect_ban_fields();

-- Certification de responsabilité au moment de la publication d'une
-- annonce (l'annonceur reconnaît être seul responsable de l'état et de
-- la provenance de l'article).
alter table listings add column if not exists seller_certified boolean default false;
