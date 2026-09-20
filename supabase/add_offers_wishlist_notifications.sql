-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- Offres de prix négociées entre un acheteur et un vendeur, sur une
-- annonce précise.
create table if not exists offers (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete cascade,
  buyer_id uuid references users(id),
  seller_id uuid references users(id),
  montant numeric not null,
  message text,
  status text default 'en_attente', -- en_attente | acceptee | refusee
  created_at timestamp with time zone default now()
);

alter table offers enable row level security;
create policy "Lecture des offres pendant le développement" on offers for select using (true);
create policy "Création d'offres pendant le développement" on offers for insert with check (true);
create policy "Mise à jour des offres pendant le développement" on offers for update using (true);

-- Liste d'envies : un article mis de côté par un acheteur, distinct des
-- "boutiques favorites" qui suivent un vendeur dans son ensemble.
create table if not exists wishlist_items (
  id uuid primary key default uuid_generate_v4(),
  acheteur_id uuid references users(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (acheteur_id, listing_id)
);

alter table wishlist_items enable row level security;
create policy "Lecture de la liste d'envies pendant le développement" on wishlist_items for select using (true);
create policy "Ajout à la liste d'envies pendant le développement" on wishlist_items for insert with check (true);
create policy "Suppression de la liste d'envies pendant le développement" on wishlist_items for delete using (true);

-- Notifie l'acheteur par push à chaque fois que le statut de sa livraison
-- change (À traiter, Pris en charge, En cours, Livré...).
create or replace function notify_order_status_change()
returns trigger as $$
declare
  buyer_id uuid;
  listing_title text;
  token_row record;
  messages jsonb := '[]'::jsonb;
  status_label text;
begin
  if new.statut_livraison is distinct from old.statut_livraison then
    select o.acheteur_id, l.title into buyer_id, listing_title
    from orders o
    join listings l on l.id = o.listing_id
    where o.id = new.order_id;

    status_label := case new.statut_livraison
      when 'a_traiter' then 'À traiter'
      when 'pris_en_charge' then 'Pris en charge'
      when 'en_cours' then 'En cours de livraison'
      when 'livre' then 'Livré'
      when 'annulee' then 'Annulée'
      else new.statut_livraison
    end;

    for token_row in select token from push_tokens where user_id = buyer_id loop
      messages := messages || jsonb_build_object(
        'to', token_row.token,
        'title', 'Commande mise à jour',
        'body', listing_title || ' : ' || status_label,
        'data', jsonb_build_object('orderId', new.order_id)
      );
    end loop;

    if jsonb_array_length(messages) > 0 then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := messages,
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_order_status on deliveries;
create trigger trg_notify_order_status
after update on deliveries
for each row execute function notify_order_status_change();
