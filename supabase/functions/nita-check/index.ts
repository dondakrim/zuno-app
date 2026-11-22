// Diagnostic temporaire : n'affiche AUCUNE valeur secrète (ni mot de passe, ni clé complète).
Deno.serve(() => {
  const get = (n: string) => (Deno.env.get(n) ?? '').trim();
  const base = get('NITA_BASE_URL');
  let host = '(vide)';
  try { host = new URL(base).host; } catch { host = base ? '(adresse invalide)' : '(vide)'; }
  const key = get('NITA_API_KEY');
  const hmac = get('NITA_HMAC_SECRET');
  const out = {
    adresse_api_hote: host,
    cle_api_debut: key.slice(0, 10),
    cle_api_longueur: key.length,
    hmac_longueur: hmac.length,
    hmac_est_celui_du_test: hmac === 'sandbox_test_signing_secret',
    login: get('NITA_LOGIN'),
    login_longueur: get('NITA_LOGIN').length,
    mot_de_passe_longueur: get('NITA_PASSWORD').length,
  };
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json' } });
});
