// Réglages du contact support (tableau de bord). Réservé aux super-admins, vérifié côté serveur.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const KEYS = ['support_whatsapp', 'support_phone', 'support_email', 'support_hours'];

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
    if (!me || me.active === false || !me.is_super) return json({ error: 'Accès refusé' }, 403);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'list') {
      const { data, error } = await admin.from('app_settings').select('key, value, updated_at, updated_by').in('key', KEYS);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, rows: data || [] });
    }

    if (body.action === 'save') {
      const v = body.values || {};
      const whatsapp = String(v.support_whatsapp ?? '').replace(/[^0-9]/g, '');
      const phone = String(v.support_phone ?? '').replace(/[^0-9+]/g, '');
      const email = String(v.support_email ?? '').trim().slice(0, 120);
      const hours = String(v.support_hours ?? '').trim().slice(0, 100);
      if (whatsapp && (whatsapp.length < 8 || whatsapp.length > 15)) {
        return json({ error: 'Numéro WhatsApp invalide : indicatif du pays + numéro, sans + ni espaces (ex : 34627137449).' }, 400);
      }
      if (phone && (phone.replace('+', '').length < 8 || phone.length > 17)) {
        return json({ error: 'Numéro de téléphone invalide.' }, 400);
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'Adresse e-mail invalide.' }, 400);
      }
      const rows = [
        { key: 'support_whatsapp', value: whatsapp },
        { key: 'support_phone', value: phone },
        { key: 'support_email', value: email },
        { key: 'support_hours', value: hours },
      ].map((r) => ({ ...r, updated_at: new Date().toISOString(), updated_by: me.username || 'admin' }));
      const { error } = await admin.from('app_settings').upsert(rows, { onConflict: 'key' });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
