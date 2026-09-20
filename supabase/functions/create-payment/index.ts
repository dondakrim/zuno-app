// Edge Function : create-payment
// Appelée par l'appli au moment du paiement. Crée une facture PayDunya
// pour la commande, et renvoie l'adresse où rediriger l'acheteur pour
// finaliser son paiement (Wave, Orange Money, etc.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYDUNYA_MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY')!;
const PAYDUNYA_PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!;
const PAYDUNYA_PUBLIC_KEY = Deno.env.get('PAYDUNYA_PUBLIC_KEY')!;
const PAYDUNYA_TOKEN = Deno.env.get('PAYDUNYA_TOKEN')!;
// 'test' tant qu'on utilise les clés de bac à sable, 'live' le jour où
// PayDunya valide le compte pour de vrais paiements.
const PAYDUNYA_MODE = Deno.env.get('PAYDUNYA_MODE') || 'test';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PAYDUNYA_BASE_URL =
  PAYDUNYA_MODE === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';

Deno.serve(async (req) => {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId manquant' }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, listings(title)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Commande introuvable' }), { status: 404 });
    }

    const invoicePayload = {
      invoice: {
        total_amount: Math.round(order.montant),
        description: `Zuno — ${order.listings?.title || 'Article'}`,
      },
      store: {
        name: 'Zuno',
        tagline: "Marketplace d'occasion",
        website_url: 'https://zunomarket.store',
      },
      actions: {
        callback_url: `${SUPABASE_URL}/functions/v1/payment-ipn`,
        return_url: 'https://zunomarket.store/paiement-reussi',
        cancel_url: 'https://zunomarket.store/paiement-annule',
      },
      custom_data: {
        order_id: orderId,
      },
    };

    const paydunyaResponse = await fetch(`${PAYDUNYA_BASE_URL}/checkout-invoice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
        'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
        'PAYDUNYA-PUBLIC-KEY': PAYDUNYA_PUBLIC_KEY,
        'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
      },
      body: JSON.stringify(invoicePayload),
    });

    const result = await paydunyaResponse.json();

    if (result.response_code !== '00') {
      return new Response(JSON.stringify({ error: result.response_text || 'Erreur PayDunya' }), {
        status: 400,
      });
    }

    // response_text contient directement l'adresse de paiement à ouvrir.
    await supabase
      .from('orders')
      .update({ payment_reference: result.token, payment_provider: 'paydunya' })
      .eq('id', orderId);

    return new Response(
      JSON.stringify({ redirectUrl: result.response_text, token: result.token }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
