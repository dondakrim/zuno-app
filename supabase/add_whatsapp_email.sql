-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
alter table users add column if not exists whatsapp text;
alter table users add column if not exists email text;
