// Edge Function : payment-ipn
// C'est l'adresse que PayDunya appelle automatiquement dès qu'un paiement
// est confirmé. Par sécurité, on ne fait jamais confiance à cet appel
// tel quel : on revérifie le statut directement auprès de PayDunya avant
// de marquer la commande comme payée.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYDUNYA_MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY')!;
const PAYDUNYA_PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!;
const PAYDUNYA_PUBLIC_KEY = Deno.env.get('PAYDUNYA_PUBLIC_KEY')!;
const PAYDUNYA_TOKEN = Deno.env.get('PAYDUNYA_TOKEN')!;
const PAYDUNYA_MODE = Deno.env.get('PAYDUNYA_MODE') || 'test';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PAYDUNYA_BASE_URL =
  PAYDUNYA_MODE === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    // PayDunya envoie le token de différentes façons selon le contexte ;
    // on couvre les cas les plus courants.
    const token = body?.data?.invoice?.token || body?.token || body?.invoice_token;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token manquant' }), { status: 400 });
    }

    // Revérifie le statut réel auprès de PayDunya (jamais confiance dans
    // le contenu brut de l'appel entrant).
    const confirmResponse = await fetch(
      `${PAYDUNYA_BASE_URL}/checkout-invoice/confirm/${token}`,
      {
        headers: {
          'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
          'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
          'PAYDUNYA-PUBLIC-KEY': PAYDUNYA_PUBLIC_KEY,
          'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
        },
      }
    );
    const confirmResult = await confirmResponse.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (confirmResult.status !== 'completed') {
      // Paiement annulé, échoué, ou encore en attente : on ne fait rien
      // de plus, la commande reste "en_attente_paiement".
      return new Response(JSON.stringify({ received: true, status: confirmResult.status }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const orderId = confirmResult.custom_data?.order_id;
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'order_id introuvable dans la réponse' }), {
        status: 400,
      });
    }

    await supabase.from('orders').update({ statut: 'a_traiter' }).eq('id', orderId);

    // Notifie l'acheteur que son paiement est confirmé.
    const { data: order } = await supabase
      .from('orders')
      .select('acheteur_id')
      .eq('id', orderId)
      .single();
    if (order?.acheteur_id) {
      await supabase.from('notifications').insert({
        user_id: order.acheteur_id,
        title: 'Paiement confirmé',
        body: 'Ton paiement a bien été reçu, ta commande est en cours de traitement.',
        type: 'payment',
      });
    }

    return new Response(JSON.stringify({ received: true, status: 'completed' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
