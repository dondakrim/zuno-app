// Protège les échanges : pas de numéro de téléphone, de WhatsApp, d'email ni de lien dans la messagerie.
// Fichier : src/lib/chatGuard.js

const WORD_DIGITS = {
  zero: '0', un: '1', une: '1', deux: '2', trois: '3', quatre: '4',
  cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9',
};

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Retourne null si le message est correct, sinon la raison du blocage.
export function checkMessage(text) {
  let t = strip(String(text || '').toLowerCase());

  // 1) On retire les prix (« 12 000 000 FCFA ») pour ne pas les prendre pour un numéro
  t = t.replace(/[\d][\d\s.,]*\s*(fcfa|cfa|xof|f\b|€|eur)/g, ' ');

  // 2) Mots interdits : applis de messagerie externes
  if (/(whats?\s?ap+|watsap|wasap|wtsp|wsp|telegram|signal\b|snap(chat)?|messenger|imo\b|viber)/.test(t)) {
    return 'contact';
  }
  // 3) Emails et liens
  if (/[a-z0-9._-]+\s?(@|\(at\)|\[at\])\s?[a-z0-9.-]+/.test(t)) return 'contact';
  if (/(https?:\/\/|www\.|wa\.me|\.com\b|\.net\b|\.org\b|\.store\b)/.test(t)) return 'contact';

  // 4) Chiffres écrits en lettres (« zero six quatre... ») -> chiffres
  t = t.replace(/\b(zero|une?|deux|trois|quatre|cinq|six|sept|huit|neuf)\b/g, (m) => WORD_DIGITS[m]);

  // 5) Série de 8 chiffres ou plus, même séparés par des espaces, points, tirets...
  const compact = t.replace(/(\d)[\s.\-_/()+*,]{1,2}(?=\d)/g, '$1');
  if (/\d{8,}/.test(compact)) return 'numero';

  return null;
}

export const BLOCK_MESSAGE =
  "Pour ta sécurité, les numéros de téléphone, WhatsApp, emails et liens ne peuvent pas être échangés ici. " +
  "Continue la discussion sur Zuno, puis passe commande : ton paiement est protégé.";
