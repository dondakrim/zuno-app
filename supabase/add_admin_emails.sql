-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- ⚠️ Avant de coller : remplace 'COLLE_TA_CLE_RESEND_ICI' par ta vraie
-- clé API Resend (celle qui commence par re_...), un peu plus bas dans
-- ce fichier.

create or replace function send_email(to_email text, subject text, html_body text)
returns void as $$
begin
  -- Réservé aux admins : personne d'autre ne doit pouvoir déclencher
  -- l'envoi d'un email au nom de Zuno.
  if not (auth.uid() in (select id from admins)) then
    raise exception 'Réservé aux administrateurs';
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer re_atGzkdBC_E36ivLq9bSLR7GqpxAtta8wa'
    ),
    body := jsonb_build_object(
      'from', 'Zuno <contact@zunomarket.store>',
      'to', array[to_email],
      'subject', subject,
      'html', html_body
    )
  );
end;
$$ language plpgsql security definer;

grant execute on function send_email(text, text, text) to authenticated;
