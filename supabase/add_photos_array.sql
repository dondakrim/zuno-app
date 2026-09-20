-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- Ajoute une colonne pour stocker la liste complète des photos d'une
-- annonce (photo_url reste utilisée comme photo de couverture pour les
-- vignettes du fil d'accueil).

alter table listings add column if not exists photos text[];
