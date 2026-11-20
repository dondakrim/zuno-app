// Edge Function « send-push » : envoie une notification sur les téléphones.
// Appelée automatiquement par deux Database Webhooks (voir le guide) :
//   - nouvelle ligne dans "notifications"  -> push à cet utilisateur
//   - nouvelle ligne dans "announcements"  -> push à tout le monde (si notify = true)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  // Protection : seul le webhook qui connaît le mot secret peut appeler cette fonction.
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Non autorisé', { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Corps invalide', { status: 400 });
  }
  if (payload?.type !== 'INSERT' || !payload.record) return new Response('ignoré');

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const r = payload.record;
  let tokens: string[] = [];
  let title = '';
  let body = '';
  let data: Record<string, unknown> = {};

  if (payload.table === 'notifications') {
    title = r.title || 'Zuno';
    body = r.body || '';
    data = { type: r.type || 'info', related_id: r.related_id || null };
    const { data: rows } = await supa.from('push_tokens').select('token').eq('user_id', r.user_id);
    tokens = (rows || []).map((x: any) => x.token);
  } else if (payload.table === 'announcements') {
    if (!r.notify || !r.active) return new Response('pas de notification demandée');
    title = r.title || 'Zuno';
    body = r.body || '';
    data = { type: 'info' };
    // tous les téléphones, par pages de 1000
    for (let from = 0; ; from += 1000) {
      const { data: rows } = await supa.from('push_tokens').select('token').range(from, from + 999);
      if (!rows || rows.length === 0) break;
      tokens.push(...rows.map((x: any) => x.token));
      if (rows.length < 1000) break;
    }
  } else {
    return new Response('table ignorée');
  }

  tokens = [...new Set(tokens)];
  if (tokens.length === 0) return new Response('aucun téléphone enregistré');

  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    const messages = chunk.map((to) => ({
      to, title, body: body.slice(0, 180), data, sound: 'default', channelId: 'default',
    }));
    try {
      const res = await fetch(EXPO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      const json = await res.json();
      (json.data || []).forEach((t: any, idx: number) => {
        if (t.status === 'ok') sent += 1;
        else if (t.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx]);
      });
    } catch (e) {
      console.log('Erreur envoi push :', (e as Error).message);
    }
  }

  // On oublie les téléphones qui ont désinstallé l'app
  if (dead.length) await supa.from('push_tokens').delete().in('token', dead);

  return new Response(JSON.stringify({ sent, removed: dead.length }), { headers: { 'Content-Type': 'application/json' } });
});
