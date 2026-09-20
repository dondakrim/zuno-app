-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- Notifications réelles (en plus des pushs) : chaque décision d'un admin
-- sur une demande (mise en avant, identité, litige, modération) crée une
-- ligne ici, visible dans l'onglet Notifications de l'appli, avec un
-- point rouge sur la cloche tant qu'elle n'est pas lue.
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  body text,
  type text, -- boost | identity | dispute | moderation | autre
  related_id uuid,
  read boolean default false,
  created_at timestamp with time zone default now()
);

alter table notifications enable row level security;
create policy "Lecture des notifications pendant le développement" on notifications for select using (true);
create policy "Création de notifications pendant le développement" on notifications for insert with check (true);
create policy "Mise à jour des notifications pendant le développement" on notifications for update using (true);

-- Envoie automatiquement un push en plus de la notification enregistrée.
create or replace function notify_on_new_notification()
returns trigger as $$
declare
  token_row record;
  messages jsonb := '[]'::jsonb;
begin
  for token_row in select token from push_tokens where user_id = new.user_id loop
    messages := messages || jsonb_build_object(
      'to', token_row.token,
      'title', new.title,
      'body', coalesce(new.body, ''),
      'data', jsonb_build_object('notificationId', new.id, 'type', new.type)
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

drop trigger if exists trg_notify_on_new_notification on notifications;
create trigger trg_notify_on_new_notification
after insert on notifications
for each row execute function notify_on_new_notification();
