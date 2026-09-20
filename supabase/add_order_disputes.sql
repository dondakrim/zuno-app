-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- Un litige = un signalement de problème sur une commande précise
-- (article non reçu, non conforme, vendeur injoignable...), distinct du
-- signalement d'annonce qui existe déjà (moderation_queue).
create table if not exists order_disputes (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  opened_by uuid references users(id),
  category text not null, -- non_recu | non_conforme_description | vendeur_injoignable | autre
  description text,
  status text default 'ouvert', -- ouvert | resolu | rejete
  created_at timestamp with time zone default now()
);

alter table order_disputes enable row level security;
create policy "Lecture des litiges pendant le développement" on order_disputes for select using (true);
create policy "Création de litiges pendant le développement" on order_disputes for insert with check (true);
create policy "Mise à jour des litiges pendant le développement" on order_disputes for update using (true);
