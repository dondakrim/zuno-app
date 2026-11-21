// Versions des textes légaux (tableau de bord). Droits vérifiés côté serveur.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const KINDS = ['cgu', 'confidentialite', 'retour', 'remboursement', 'annulation'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Non connecté' }, 401);
    const { data: me } = await admin.from('admins').select('is_super, active, permissions, username').eq('id', user.id).maybeSingle();
    if (!me || me.active === false) return json({ error: 'Accès refusé' }, 403);
    if (!me.is_super && !(me.permissions || []).includes('legal')) return json({ error: 'Accès refusé' }, 403);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'list') {
      const { data, error } = await admin.from('legal_versions').select('*').order('published_at', { ascending: false }).limit(200);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, rows: data || [] });
    }
    if (body.action === 'publish') {
      if (!KINDS.includes(body.kind)) return json({ error: 'Texte inconnu' }, 400);
      const version = String(body.version || '').trim().slice(0, 20);
      if (!version) return json({ error: 'Indique un numéro de version (ex : 1.1).' }, 400);
      const note = String(body.note || '').trim().slice(0, 300);
      if (!note) return json({ error: 'Résume en une phrase ce qui a changé.' }, 400);
      const { error } = await admin.from('legal_versions').insert({
        kind: body.kind, version, note, published_by: me.username || 'admin',
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
