-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- Autorise la création d'identités de test et l'envoi de messages,
-- de la même façon que ce qui a déjà été fait pour la table `listings`.

alter table users enable row level security;
create policy "Lecture publique des utilisateurs" on users for select using (true);
create policy "Création ouverte pendant le développement" on users for insert with check (true);

alter table messages enable row level security;
create policy "Lecture des messages pendant le développement" on messages for select using (true);
create policy "Envoi de messages pendant le développement" on messages for insert with check (true);
