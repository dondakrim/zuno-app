-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- (nom, ville, telephone existent déjà dans la table users)

alter table users add column if not exists boutique_nom text;
alter table users add column if not exists photo_url text;
