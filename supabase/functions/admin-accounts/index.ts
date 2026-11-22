// Suppression sûre de comptes (tableau de bord). Réservé aux super-admins, vérifié côté serveur.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Non connecté' }, 401);
    const { data: me } = await admin.from('admins').select('is_super, active, username').eq('id', user.id).maybeSingle();
    if (!me || me.active === false || !me.is_super) return json({ error: 'Accès refusé (super-admin uniquement)' }, 403);

    const body = await req.json().catch(() => ({}));
    const ids = (Array.isArray(body.ids) ? body.ids : [])
      .map(String)
      .filter((x: string) => UUID.test(x) && x !== user.id);
    if (ids.length === 0) return json({ error: 'Aucun compte à traiter.' }, 400);
    if (ids.length > 200) return json({ error: 'Maximum 200 comptes à la fois.' }, 400);

    if (body.action !== 'check' && body.action !== 'delete') return json({ error: 'Action inconnue' }, 400);
    const apply = body.action === 'delete';
    const { data, error } = await admin.rpc('admin_cleanup_accounts', { p_ids: ids, p_apply: apply });
    if (error) {
      return json({ error: error.message + ' — as-tu lancé nettoyage-comptes.sql dans Supabase ?' }, 400);
    }
    return json({ ok: true, rows: data || [] });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
