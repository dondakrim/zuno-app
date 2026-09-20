-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- Envoie une notification push à chaque utilisateur dont un centre
-- d'intérêt correspond à la catégorie d'une nouvelle annonce publiée.

create extension if not exists pg_net;

create or replace function notify_interested_users()
returns trigger as $$
declare
  rec record;
  messages jsonb := '[]'::jsonb;
begin
  for rec in
    select pt.token
    from users u
    join push_tokens pt on pt.user_id = u.id
    where new.category = any(u.interets)
      and (new.vendeur_id is null or u.id <> new.vendeur_id)
  loop
    messages := messages || jsonb_build_object(
      'to', rec.token,
      'title', 'Nouvel article dans ' || new.category,
      'body', new.title || ' vient d''être publié' ||
              case when new.city is not null then ' à ' || new.city else '' end,
      'data', jsonb_build_object('listingId', new.id)
    );
  end loop;

  if jsonb_array_length(messages) > 0 then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_new_listing on listings;
create trigger trg_notify_new_listing
after insert on listings
for each row execute function notify_interested_users();
