-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- Envoie une notification une fois par semaine (le lundi à 9h) à chaque
-- utilisateur, résumant le nombre de nouveaux articles publiés dans ses
-- centres d'intérêt au cours des 7 derniers jours.

create extension if not exists pg_cron;

create or replace function send_trends_digest()
returns void as $$
declare
  user_row record;
  nb_articles integer;
  token_row record;
  messages jsonb;
begin
  for user_row in select id, interets from users where interets is not null and array_length(interets, 1) > 0
  loop
    select count(*) into nb_articles
    from listings
    where category = any(user_row.interets)
      and status = 'disponible'
      and moderation_status = 'approved'
      and created_at > now() - interval '7 days';

    if nb_articles > 0 then
      messages := '[]'::jsonb;
      for token_row in select token from push_tokens where user_id = user_row.id loop
        messages := messages || jsonb_build_object(
          'to', token_row.token,
          'title', 'Tendances de la semaine',
          'body', nb_articles || ' nouveaux articles cette semaine dans tes catégories préférées sur Zuno'
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
  end loop;
end;
$$ language plpgsql security definer;

select cron.schedule('trends-digest-weekly', '0 9 * * 1', $$select send_trends_digest()$$);
