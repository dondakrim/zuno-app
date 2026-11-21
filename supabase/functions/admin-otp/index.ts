// Journal des connexions WhatsApp pour le tableau de bord.
// Ne renvoie JAMAIS les codes : seulement le statut des envois.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const mask = (p: string) => {
  const d = String(p || '').replace(/[^\d]/g, '');
  if (d.length < 7) return '+' + d;
  return '+' + d.slice(0, 3) + ' •• •• ' + d.slice(-4);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Non connecté' }, 401);
    const { data: me } = await admin.from('admins').select('id, is_super, active, permissions').eq('id', user.id).maybeSingle();
    if (!me || me.active === false) return json({ error: 'Accès refusé' }, 403);
    if (!me.is_super && !(me.permissions || []).includes('connexions')) return json({ error: 'Accès refusé' }, 403);

    const body = await req.json().catch(() => ({}));

    if (body.action === 'stats') {
      const { data, error } = await admin.rpc('admin_connexion_stats');
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, stats: data });
    }

    if (body.action === 'list') {
      let q = admin.from('otp_log').select('id, created_at, phone, status, error_code, error_detail, sms_type')
        .order('created_at', { ascending: false }).limit(100);
      const s = String(body.search || '').replace(/[^\d]/g, '');
      if (s.length >= 3) q = q.ilike('phone', '%' + s + '%');
      if (body.status === 'envoye' || body.status === 'echec') q = q.eq('status', body.status);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      return json({
        ok: true,
        rows: (data || []).map((r) => ({
          id: r.id, created_at: r.created_at, phone: mask(r.phone), status: r.status,
          error_code: r.error_code, error_detail: r.error_detail, sms_type: r.sms_type,
        })),
      });
    }
    return json({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
