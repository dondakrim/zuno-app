// Langue et devise — src/lib/prefs.js
// Aucune configuration dans App.js : ce petit « magasin » se charge tout seul.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
const EN = {
  'Compte': 'Account', 'Paramètres': 'Settings', 'Mon activité': 'My activity', 'Préférences': 'Preferences',
  'Aide et communauté': 'Help and community', 'Informations légales': 'Legal information', 'Sécurité': 'Safety',
  'Coupons': 'Coupons', 'Retrouve tes codes promo': 'Find your promo codes', 'Notifications': 'Notifications',
  'Liste des favoris': 'Favorites', 'Articles et boutiques enregistrés': 'Saved items and shops',
  'Thème, langue, devise et plus': 'Theme, language, currency and more',
  'Service clients': 'Customer service', 'WhatsApp, appel, email': 'WhatsApp, call, email',
  'Suggestions': 'Suggestions', 'Dis-nous comment améliorer Zuno': 'Tell us how to improve Zuno',
  'Infos': 'News', 'Alertes et avertissements de Zuno': 'Zuno alerts and notices',
  'Blog': 'Blog', 'Conseils et actualités': 'Tips and news',
  'Conditions générales': 'Terms and conditions', 'Politique de confidentialité': 'Privacy policy',
  'Politique de retour': 'Return policy', 'Politique de remboursement': 'Refund policy',
  'Politique d’annulation': 'Cancellation policy', 'FAQ': 'FAQ', 'Questions fréquentes': 'Frequently asked questions',
  'Reporter un utilisateur': 'Report a user', 'Signale un comportement suspect': 'Report suspicious behavior',
  'Bienvenue sur Zuno': 'Welcome to Zuno',
  'Gère ton compte, tes préférences et ton aide.': 'Manage your account, preferences and help.',
  'Connecte-toi pour profiter de toutes les fonctions.': 'Sign in to enjoy every feature.',
  'Se connecter': 'Sign in', 'La connexion avec compte arrive bientôt.': 'Account sign-in is coming soon.',
  'Cette section arrive bientôt.': 'This section is coming soon.',
  'Mon profil': 'My profile', "Revoir mes centres d'intérêt": 'Review my interests', 'Langue': 'Language',
  'Devise': 'Currency', 'Thème sombre': 'Dark theme', 'Bientôt': 'Soon', 'Légal': 'Legal',
  "Conditions d'utilisation": 'Terms of use', 'Zone dangereuse': 'Danger zone', 'Supprimer mon compte': 'Delete my account',
  'Complète ton profil': 'Complete your profile', 'Appuie pour modifier tes informations': 'Tap to edit your information',
  'Choisis ta langue': 'Choose your language', 'Choisis ta devise': 'Choose your currency',
  'Les prix des annonces sont affichés à titre indicatif. Tu paies toujours en FCFA.': 'Listing prices are shown for reference. You always pay in FCFA.',
  'Fermer': 'Close',
};

export function translate(lang, text) {
  if (lang === 'en' && EN[text]) return EN[text];
  return text;
}

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
