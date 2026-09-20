-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.
-- Remplace RESEND_API_KEY_ICI par ta vraie clé Resend avant d'exécuter.

create or replace function send_email(to_email text, subject text, html_body text)
returns void as $$
begin
  if not (auth.uid() in (select id from admins)) then
    raise exception 'Non autorisé';
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer RESEND_API_KEY_ICI'
    ),
    body := jsonb_build_object(
      -- En mode test (avant vérification de domaine), l'expéditeur DOIT
      -- rester "onboarding@resend.dev", et l'email n'arrivera que sur
      -- l'adresse de ton propre compte Resend. Une fois zunomarket.store
      -- vérifié dans Resend, remplace par : 'Zuno <contact@zunomarket.store>'
      'from', 'Zuno <onboarding@resend.dev>',
      'to', jsonb_build_array(to_email),
      'subject', subject,
      'html', html_body
    )
  );
end;
$$ language plpgsql security definer;

grant execute on function send_email(text, text, text) to authenticated;
