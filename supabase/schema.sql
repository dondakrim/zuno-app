-- Schéma Zuno — à coller dans l'éditeur SQL de ton projet Supabase
-- (onglet "SQL Editor" > "New query"), puis cliquer sur "Run".
-- Reprend exactement le modèle de données qu'on a construit ensemble.

create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key default uuid_generate_v4(),
  telephone text unique not null,
  nom text not null,
  ville text,
  note_moyenne numeric default 0,
  created_at timestamp with time zone default now()
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  nom text unique not null
);

create table listings (
  id uuid primary key default uuid_generate_v4(),
  vendeur_id uuid references users(id) on delete cascade,
  categorie_id uuid references categories(id),
  category text, -- nom de catégorie en clair, utilisé le temps de brancher categorie_id
  title text not null,
  description text,
  price numeric not null,
  condition text,
  city text,
  photo_url text,
  status text default 'disponible', -- disponible | vendu
  created_at timestamp with time zone default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete cascade,
  expediteur_id uuid references users(id),
  destinataire_id uuid references users(id),
  contenu text not null,
  created_at timestamp with time zone default now()
);

create table orders (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id),
  acheteur_id uuid references users(id),
  montant numeric not null,
  statut text default 'en_attente', -- en_attente | payee | annulee
  created_at timestamp with time zone default now()
);

create table payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  fournisseur text default 'MyNITA',
  reference text,
  statut text default 'en_attente', -- en_attente | reussi | echoue
  created_at timestamp with time zone default now()
);

create table deliveries (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  adresse text not null,
  partenaire text, -- ex: KAMES Express
  statut_livraison text default 'a_traiter', -- a_traiter | pris_en_charge | en_cours | livre
  created_at timestamp with time zone default now()
);

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  auteur_id uuid references users(id),
  note integer check (note between 1 and 5),
  commentaire text,
  created_at timestamp with time zone default now()
);

-- Catégories de départ (correspond aux maquettes)
insert into categories (nom) values
  ('Mode et vêtements'),
  ('Électronique et téléphones'),
  ('Maison et électroménager'),
  ('Véhicules et pièces'),
  ('Autres');

-- Sécurité : à activer avant la mise en production.
-- Pour l'instant les tables sont ouvertes en lecture/écriture pour que
-- l'appli fonctionne pendant le développement. On verrouillera avec des
-- règles "Row Level Security" une fois l'authentification en place.
alter table listings enable row level security;
create policy "Lecture publique des annonces" on listings for select using (true);
create policy "Insertion ouverte pendant le développement" on listings for insert with check (true);
