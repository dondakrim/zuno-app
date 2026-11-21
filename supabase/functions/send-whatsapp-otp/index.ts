// Supabase Edge Function : envoie le code de connexion par WhatsApp
// (Meta WhatsApp Cloud API). Branchée comme « Send SMS Hook » dans Supabase.
// Secrets requis : SEND_SMS_HOOK_SECRET, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
// Secrets optionnels : WHATSAPP_TEMPLATE (défaut zuno_code), WHATSAPP_LANG (défaut fr)
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v21.0';

function fail(code: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: code, message } }), {
    status: code,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Journal des envois (le code n'est jamais enregistré). Une erreur de journal ne bloque jamais l'envoi.
async function journal(phone: string, status: 'envoye' | 'echec', smsType?: string, code?: string, detail?: string) {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return;
    const db = createClient(url, key, { auth: { persistSession: false } });
    await db.from('otp_log').insert({
      phone, status, sms_type: smsType || null, error_code: code || null, error_detail: (detail || '').slice(0, 300) || null,
    });
  } catch (_e) { /* ignore */ }
}

Deno.serve(async (req) => {
  const raw = await req.text();

  // 1) Vérifie que la demande vient bien de Supabase
  const hookSecret = (Deno.env.get('SEND_SMS_HOOK_SECRET') || '').replace('v1,whsec_', '');
  let payload: { user?: { phone?: string; phone_change?: string; new_phone?: string }; sms?: { otp?: string; sms_type?: string } };
  try {
    const wh = new Webhook(hookSecret);
    payload = wh.verify(raw, Object.fromEntries(req.headers)) as typeof payload;
  } catch (_e) {
    return fail(401, 'Signature invalide');
  }

  const u = payload.user || {};
  // Pour un changement de numéro (compte anonyme -> numéro), le nouveau numéro est dans phone_change.
  const rawPhone = u.phone_change || u.new_phone || u.phone || '';
  const phone = rawPhone.replace(/[^\d]/g, ''); // chiffres seulement, sans +
  const otp = payload.sms?.otp;
  if (!phone || !otp) return fail(400, 'Numéro ou code manquant');

  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID');
  if (!token || !phoneId) {
    await journal(phone, 'echec', payload.sms?.sms_type, 'config', 'WhatsApp non configuré');
    return fail(500, 'WhatsApp non configuré');
  }

  const template = Deno.env.get('WHATSAPP_TEMPLATE') || 'zuno_code';
  const lang = Deno.env.get('WHATSAPP_LANG') || 'fr';

  // 2) Envoie le modèle « authentification » (corps + bouton Copier le code)
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: otp }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] },
      ],
    },
  };

  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      console.log('Erreur WhatsApp', res.status, t.slice(0, 300));
      let detail = t;
      try { const j = JSON.parse(t); detail = j?.error?.message || t; } catch (_e) { /* texte brut */ }
      await journal(phone, 'echec', payload.sms?.sms_type, 'HTTP ' + res.status, detail);
      return fail(502, "Impossible d'envoyer le code WhatsApp");
    }
  } catch (e) {
    console.log('Erreur réseau WhatsApp', (e as Error).message);
    await journal(phone, 'echec', payload.sms?.sms_type, 'reseau', (e as Error).message);
    return fail(502, "Impossible d'envoyer le code WhatsApp");
  }

  await journal(phone, 'envoye', payload.sms?.sms_type);
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
