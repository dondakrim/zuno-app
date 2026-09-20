// Edge Function : track-session
// Appelée une fois à chaque ouverture de l'appli. Déduit la ville
// approximative à partir de l'adresse IP de connexion (aucune permission
// demandée à la personne, contrairement à un vrai GPS), et enregistre le
// modèle d'appareil ainsi que la date de dernière connexion.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 });
    }

    // Vérifie qui appelle vraiment (on ne fait jamais confiance à un
    // identifiant envoyé directement par l'appli).
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), { status: 401 });
    }

    const { deviceModel, osName, osVersion } = await req.json().catch(() => ({}));

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      null;

    let city = null;
    let region = null;
    let country = null;
    if (ip) {
      try {
        const geoRes = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,country,regionName,city`
        );
        const geo = await geoRes.json();
        if (geo.status === 'success') {
          city = geo.city || null;
          region = geo.regionName || null;
          country = geo.country || null;
        }
      } catch (_e) {
        // Pas grave si la géolocalisation échoue : on enregistre le reste
        // quand même.
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase
      .from('users')
      .update({
        last_seen_at: new Date().toISOString(),
        last_city: city,
        last_region: region,
        last_country: country,
        device_model: deviceModel || null,
        os_info: osName ? `${osName} ${osVersion || ''}`.trim() : null,
      })
      .eq('id', user.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
