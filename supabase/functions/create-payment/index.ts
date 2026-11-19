// Crée (ou retrouve) l'achat NITA d'une commande et renvoie le lien de paiement.
// Remplace l'ancienne version PayDunya.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAchatStatus, createAchat, nitaConfig, toNitaPhone } from '../_shared/nita.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Page affichée à l'acheteur après son paiement (à publier dans docs/retour.html).
const RETURN_URL = 'https://dondakrim.github.io/zuno-app/retour.html';

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
      .select('id, acheteur_id, montant, reference_number, payment_provider, payment_reference, payment_url, listings(title), deliveries(telephone_contact)')
      .eq('id', orderId)
      .single();
    if (orderError || !order) return json({ error: 'Commande introuvable.' }, 404);

    // Seul l'acheteur de la commande peut lancer son paiement.
    if (order.acheteur_id !== user.id) return json({ error: 'Cette commande ne t\'appartient pas.' }, 403);

    const montant = Math.round(Number(order.montant));
    if (!(montant > 0)) return json({ error: 'Montant de commande invalide.' }, 400);

    const cfg = nitaConfig();
    const requestId = `ZN-${order.id}`; // 1 à 100 caractères, unique parmi les achats non annulés
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // Paiement déjà lancé pour cette commande : on regarde où il en est avant d'en créer un autre.
    if (order.payment_provider === 'nita' && order.payment_reference) {
      const status = await checkAchatStatus(cfg, requestId, clientIp);
      const code = String(status.data?.code ?? '');
      if (status.ok && code === '1') return json({ alreadyPaid: true, codeAchat: order.payment_reference });
      if (status.ok && code === '0' && order.payment_url) {
        return json({ url: order.payment_url, codeAchat: order.payment_reference });
      }
      if (status.ok && code === '3') return json({ error: 'Cet achat est bloqué. Contacte le support Zuno.' }, 409);
      // '2' (annulé) ou inconnu : on crée un nouvel achat ci-dessous (le requestId peut resservir après annulation).
    }

    // Numéro du client : contact de livraison, sinon numéro de son profil.
    let phone = toNitaPhone(order.deliveries?.[0]?.telephone_contact);
    if (!phone) {
      const { data: profile } = await admin.from('users').select('telephone').eq('id', user.id).maybeSingle();
      phone = toNitaPhone(profile?.telephone);
    }
    if (!phone) return json({ error: 'Numéro de téléphone du client introuvable ou invalide.' }, 400);

    const reference = 'ZN-CMD-' + String(order.reference_number).padStart(6, '0');
    const title = order.listings?.title || 'Article Zuno';

    const result = await createAchat(cfg, {
      descriptionAchat: [title],
      montantTransaction: montant,
      motifTransaction: `Commande ${reference}`,
      requestId,
      phoneClient: phone,
      adresseIp: clientIp,
      urlRetour: RETURN_URL,
    });

    if (!result.ok || !result.data?.codeAchat || !result.data?.urlPaiement) {
      console.error('NITA saveAchatEnLigne refusé :', result.httpStatus, result.raw.slice(0, 500));
      return json({ error: 'Le paiement n\'a pas pu être créé. Réessaie dans un instant.' }, 502);
    }

    const { error: updateError } = await admin
      .from('orders')
      .update({
        payment_provider: 'nita',
        payment_reference: result.data.codeAchat,
        payment_url: result.data.urlPaiement,
      })
      .eq('id', order.id);
    if (updateError) console.error('Mise à jour commande :', updateError.message);

    return json({ url: result.data.urlPaiement, codeAchat: result.data.codeAchat });
  } catch (err) {
    console.error('create-payment :', err);
    return json({ error: 'Erreur serveur.' }, 500);
  }
});
