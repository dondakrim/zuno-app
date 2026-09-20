-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- Corrige un oubli : l'admin ne pouvait pas encore lire les paniers.
drop policy if exists "Gérer son propre panier" on cart_items;
create policy "Gérer son propre panier" on cart_items
  for all using (auth.uid() = acheteur_id or auth.uid() in (select id from admins))
  with check (auth.uid() = acheteur_id);
