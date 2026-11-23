// Langue et devise — src/lib/prefs.js
// Aucune configuration dans App.js : ce petit « magasin » se charge tout seul.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EN_DICT, EN_PATTERNS } from './i18n-en';

const KEY = 'zuno_prefs';

export const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

// Le FCFA (XOF) est lié à l'euro à un taux FIXE et officiel : 1 € = 655,957 FCFA.
export const CURRENCIES = [
  { code: 'XOF', label: 'Franc CFA (FCFA)', short: 'FCFA' },
  { code: 'EUR', label: 'Euro (€)', short: '€' },
];
const XOF_PER_EUR = 655.957;

let state = { lang: 'fr', currency: 'XOF' };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw);
    state = {
      lang: LANGS.some((l) => l.code === saved.lang) ? saved.lang : 'fr',
      currency: CURRENCIES.some((c) => c.code === saved.currency) ? saved.currency : 'XOF',
    };
    emit();
  })
  .catch(() => {});

export function setPrefs(partial) {
  state = { ...state, ...partial };
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

// Prix d'une annonce. Les montants réellement payés (panier, commandes, paiement)
// restent toujours en FCFA : on ne les convertit pas.
export function formatPriceWith(amount, currency) {
  const n = Number(amount) || 0;
  if (currency === 'EUR') {
    return '≈ ' + (n / XOF_PER_EUR).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  return n.toLocaleString('fr-FR') + ' FCFA';
}

// Traductions : la clé est le texte français. Texte absent = affiché en français.
// Le dictionnaire complet est dans i18n-en.js
const NORM = (t) =>
  String(t).replace(/[\u2019\u2018]/g, "'").replace(/\\'/g, "'").replace(/\s+/g, ' ').trim();

const cache = new Map();

export function translate(lang, text) {
  if (lang !== 'en' || typeof text !== 'string' || !text) return text;
  try {
    const key = NORM(text);
    if (!key) return text;
    if (cache.has(key)) {
      const r = cache.get(key);
      return r == null ? text : keepSpaces(text, r);
    }
    let out = EN_DICT[key];
    if (out == null) {
      for (const [re, fn] of EN_PATTERNS) {
        const m = key.match(re);
        if (m) { out = fn(m, (x) => translate('en', x)); break; }
      }
    }
    cache.set(key, out == null ? null : out);
    return out == null ? text : keepSpaces(text, out);
  } catch (e) {
    return text;
  }
}

// garde les espaces/retours du texte d'origine autour de la traduction
function keepSpaces(orig, out) {
  const lead = (orig.match(/^\s*/) || [''])[0];
  const trail = (orig.match(/\s*$/) || [''])[0];
  return lead + out + trail;
}

export const getPrefs = () => state;

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => state;

export function usePrefs() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    lang: s.lang,
    currency: s.currency,
    t: (text) => translate(s.lang, text),
    formatPrice: (amount) => formatPriceWith(amount, s.currency),
    setLang: (lang) => setPrefs({ lang }),
    setCurrency: (currency) => setPrefs({ currency }),
  };
}
