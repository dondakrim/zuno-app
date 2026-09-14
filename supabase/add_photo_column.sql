-- Comme ton projet Supabase existe déjà, colle uniquement ceci dans le SQL
-- Editor (pas besoin de tout relancer) pour ajouter la colonne photo :

alter table listings add column if not exists photo_url text;
