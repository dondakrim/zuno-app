// Client minimal pour l'API NITA (Achat en ligne).
// Authentification par jeton + signature HMAC-SHA256 de chaque requête,
// comme décrit dans le guide de prise en main de la sandbox NITA.

const encoder = new TextEncoder();

export type NitaConfig = {
  baseUrl: string;
  apiKey: string;
  hmacSecret: string;
  login: string;
  password: string;
};

export type NitaResult = {
  ok: boolean;            // true seulement si status === "SUCCESS" et code === 200
  httpStatus: number;
  code?: number | string;
  message?: string;
  data?: any;
  raw: string;
};

export function nitaConfig(): NitaConfig {
  const get = (name: string) => {
    // trim() retire les espaces / retours à la ligne cachés laissés par un copier-coller.
    const value = Deno.env.get(name)?.trim();
    if (!value) throw new Error(`Secret manquant : ${name}`);
    return value;
  };
  return {
    baseUrl: get('NITA_BASE_URL').replace(/\/+$/, ''),
    apiKey: get('NITA_API_KEY'),
    hmacSecret: get('NITA_HMAC_SECRET'),
    login: get('NITA_LOGIN'),
    password: get('NITA_PASSWORD'),
  };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// X-NT-SIGNATURE = hex( HMAC-SHA256( secret, timestamp + "\n" + nonce + "\n" + corps ) )
export async function sign(secret: string, timestamp: string, nonce: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}\n${nonce}\n${body}`));
  return toHex(signature);
}

async function signedFetch(
  cfg: NitaConfig,
  method: 'POST' | 'PUT',
  path: string,
  payload: Record<string, unknown>,
  token?: string,
): Promise<NitaResult> {
  // Le corps est sérialisé une seule fois : la signature porte sur ce texte exact.
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID(); // 36 caractères alphanumériques et tirets, à usage unique
  const signature = await sign(cfg.hmacSecret, timestamp, nonce, body);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-NT-API-KEY': cfg.apiKey,
    'X-NT-TIMESTAMP': timestamp,
    'X-NT-NONCE': nonce,
    'X-NT-SIGNATURE': signature,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(cfg.baseUrl + path, { method, headers, body });
  const raw = await response.text();
  let json: any = null;
  try { json = JSON.parse(raw); } catch { /* réponse non JSON */ }

  // Une opération refusée peut revenir avec un HTTP 200 : on lit le verdict dans le corps.
  const ok = response.ok && json?.status === 'SUCCESS' && Number(json?.code) === 200;
  return {
    ok,
    httpStatus: response.status,
    code: json?.code,
    message: json?.message,
    data: json?.data,
    raw,
  };
}

// Jeton valable 15 minutes : on le garde en mémoire tant que l'instance vit.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(cfg: NitaConfig, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const result = await signedFetch(cfg, 'POST', '/api/authenticate', {
    username: cfg.login,
    password: cfg.password,
  });
  const token = result.data?.token;
  if (!token) {
    // On indique seulement les longueurs (jamais les valeurs) pour repérer une saisie tronquée.
    throw new Error(
      `Authentification NITA refusée (HTTP ${result.httpStatus}) : ${result.raw.slice(0, 300)}` +
        ` [login : ${cfg.login.length} car., mot de passe : ${cfg.password.length} car.]`,
    );
  }
  cachedToken = { value: token, expiresAt: Date.now() + 10 * 60 * 1000 };
  return token;
}

async function call(
  cfg: NitaConfig,
  method: 'POST' | 'PUT',
  path: string,
  payload: Record<string, unknown>,
): Promise<NitaResult> {
  let result = await signedFetch(cfg, method, path, payload, await getToken(cfg));
  // Jeton absent (401) ou expiré (403) : on en demande un nouveau et on réessaie une fois.
  if (result.httpStatus === 401 || result.httpStatus === 403) {
    result = await signedFetch(cfg, method, path, payload, await getToken(cfg, true));
  }
  return result;
}

const BASE = '/api/v2/nitaServices/achatEnLigne';

export type CreateAchatInput = {
  descriptionAchat: string[];
  montantTransaction: number;
  motifTransaction: string;
  requestId: string;
  phoneClient: string;
  adresseIp: string;
  urlCallback?: string;
  urlRetour?: string;
};

// Crée l'achat. Aucun fonds n'est débité : le client paie ensuite sur data.urlPaiement.
export function createAchat(cfg: NitaConfig, input: CreateAchatInput) {
  return call(cfg, 'POST', `${BASE}/saveAchatEnLigne`, input);
}

// data.code : '0' non payé | '1' payé | '2' annulé | '3' bloqué
export function checkAchatStatus(cfg: NitaConfig, requestId: string, adresseIp?: string) {
  const payload: Record<string, unknown> = { requestId };
  if (adresseIp) payload.adresseIp = adresseIp;
  return call(cfg, 'POST', `${BASE}/checkAchatStatus`, payload);
}

export function cancelAchat(cfg: NitaConfig, codeAchat: string, requestId: string, adresseIp?: string) {
  const payload: Record<string, unknown> = { codeAchat, requestId };
  if (adresseIp) payload.adresseIp = adresseIp;
  return call(cfg, 'PUT', `${BASE}/annulerAchat`, payload);
}

// Numéro au format NITA : indicatif compris, préfixé « 00 » (ex. 0022792969858).
export function toNitaPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().replace(/[\s().-]/g, '');
  if (value.startsWith('+')) value = '00' + value.slice(1);
  if (!/^\d+$/.test(value)) return null;
  if (value.startsWith('00')) return value.length >= 10 ? value : null;
  if (value.length === 8) return '00227' + value; // numéro nigérien sans indicatif
  return null;
}
