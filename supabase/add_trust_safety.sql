-- Colle ceci dans le SQL Editor de Supabase et clique sur Run.

-- Statut de modération sur chaque annonce.
-- approved       : visible publiquement (comportement normal)
-- pending_review : créée mais cachée, en attente de vérification humaine
-- blocked        : bloquée automatiquement, jamais visible publiquement
alter table listings add column if not exists moderation_status text default 'approved';
alter table listings add column if not exists moderation_score integer default 0;
alter table listings add column if not exists moderation_flags jsonb default '[]'::jsonb;

-- File d'attente de vérification humaine : une ligne par détection
-- automatique ou par signalement d'utilisateur.
create table if not exists moderation_queue (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete cascade,
  source text not null, -- 'auto_detection' | 'user_report'
  category text, -- ex: DROGUES_STUPEFIANTS, ARMES, OTHER_ILLEGAL...
  score integer default 0,
  detected_keywords text[],
  reporter_id uuid references users(id),
  reporter_comment text,
  status text default 'pending', -- pending | reviewed_ok | reviewed_removed
  reviewer_id uuid references users(id),
  reviewer_note text,
  created_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone
);

-- Traçabilité complète : chaque action (détection, signalement, décision
-- humaine) laisse une trace horodatée, jamais modifiée ni supprimée.
create table if not exists moderation_logs (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete set null,
  actor_type text not null, -- 'system' | 'user' | 'moderator'
  actor_id uuid references users(id),
  action text not null, -- 'auto_approve' | 'auto_flag' | 'auto_block' | 'user_report' | 'moderator_approve' | 'moderator_remove'
  details jsonb,
  created_at timestamp with time zone default now()
);

alter table moderation_queue enable row level security;
create policy "Lecture de la file de moderation pendant le developpement" on moderation_queue for select using (true);
create policy "Creation dans la file de moderation pendant le developpement" on moderation_queue for insert with check (true);
create policy "Mise a jour de la file de moderation pendant le developpement" on moderation_queue for update using (true);

alter table moderation_logs enable row level security;
create policy "Lecture des logs de moderation pendant le developpement" on moderation_logs for select using (true);
create policy "Creation de logs de moderation pendant le developpement" on moderation_logs for insert with check (true);
