// Vérifie auprès de NITA si une commande a été payée et, si oui, la marque comme payée.
// Remplace payment-ipn (PayDunya). L'app l'appelle quand l'acheteur revient de la page de paiement.
// On ne fait jamais confiance à l'app : le verdict vient uniquement de NITA.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAchatStatus, nitaConfig } from '../_shared/nita.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Non connecté.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Session invalide.' }, 401);

    const { orderId } = await req.json();
    if (!orderId) return json({ error: 'orderId manquant.' }, 400);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, acheteur_id, statut, payment_provider, payment_reference')
      .eq('id', orderId)
      .single();
    if (orderError || !order) return json({ error: 'Commande introuvable.' }, 404);
    if (order.acheteur_id !== user.id) return json({ error: 'Cette commande ne t\'appartient pas.' }, 403);

    // Déjà traitée : rien à refaire.
    if (order.statut !== 'en_attente_paiement') return json({ paid: true, already: true });

    if (order.payment_provider !== 'nita' || !order.payment_reference) {
      return json({ paid: false, status: 'no_payment' });
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const result = await checkAchatStatus(nitaConfig(), `ZN-${order.id}`, clientIp);
    if (!result.ok) {
      console.error('NITA checkAchatStatus refusé :', result.httpStatus, result.raw.slice(0, 500));
      return json({ paid: false, status: 'check_failed' }, 502);
    }

    const code = String(result.data?.code ?? '');
    // '0' non payé | '1' payé | '2' annulé | '3' bloqué
    if (code !== '1') return json({ paid: false, status: code });

    // La condition sur le statut évite de notifier deux fois si l'app vérifie plusieurs fois.
    const { data: updated, error: updateError } = await admin
      .from('orders')
      .update({ statut: 'a_traiter' })
      .eq('id', order.id)
      .eq('statut', 'en_attente_paiement')
      .select('id');
    if (updateError) {
      console.error('Mise à jour commande :', updateError.message);
      return json({ error: 'Erreur serveur.' }, 500);
    }

    if (updated && updated.length > 0) {
      await admin.from('notifications').insert({
        user_id: order.acheteur_id,
        title: 'Paiement confirmé',
        body: 'Ton paiement a bien été reçu, ta commande est en cours de traitement.',
        type: 'payment',
        related_id: order.id,
      });
    }

    return json({ paid: true });
  } catch (err) {
    console.error('check-payment :', err);
    return json({ error: 'Erreur serveur.' }, 500);
  }
});
