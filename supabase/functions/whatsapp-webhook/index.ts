// Supabase Edge Function : point de contact (« webhook ») pour Meta WhatsApp.
// - GET : Meta vérifie l'adresse (hub.verify_token doit être égal au secret WHATSAPP_VERIFY_TOKEN).
// - POST : Meta envoie des événements (statuts, réponses). On répond 200 sans rien enregistrer.
Deno.serve((req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'POST') {
    return new Response('OK', { status: 200 });
  }

  return new Response('Method not allowed', { status: 405 });
});
