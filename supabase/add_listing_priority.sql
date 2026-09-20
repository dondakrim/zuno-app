-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- Priorité manuelle (0 par défaut) : un chiffre plus élevé fait remonter
-- l'annonce en tête de Tendances et de la section "Articles en vedette"
-- de l'accueil, en plus des annonces boostées.
alter table listings add column if not exists priority integer default 0;
