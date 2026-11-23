// Couche 1 (Règles) et couche 2 (Détection automatique) de l'architecture
// Trust & Safety. Analyse le texte d'une annonce (titre, description,
// catégorie, prix) et renvoie un score de risque avec une recommandation.
//
// Ce module ne traite PAS les images : une vraie analyse d'image demande un
// service de vision par IA externe (Google Cloud Vision, AWS Rekognition,
// Sightengine...). La fonction `analyzeImage` ci-dessous est un point
// d'accroche prêt à être branché sur un vrai service plus tard — elle ne
// simule aucune détection pour l'instant, pour ne pas donner une fausse
// impression de sécurité.

// Catégories de contenus interdits. Les mots-clés sont volontairement
// généraux (termes courants, pas un dictionnaire exhaustif d'argot) : le
// but est de détecter les cas évidents et d'envoyer le reste vers la
// vérification humaine, pas de tout bloquer automatiquement.
const ILLEGAL_KEYWORDS = {
  DROGUES_STUPEFIANTS: [
    'drogue', 'stupéfiant', 'cannabis', 'marijuana', 'weed', 'cocaïne',
    'héroïne', 'ecstasy', 'mdma', 'crack', 'shit', 'beuh', 'chanvre indien',
  ],
  ARMES: [
    'arme à feu', 'pistolet', 'revolver', 'fusil d\'assaut', 'kalachnikov',
    'munitions', 'silencieux d\'arme', 'arme de poing', 'ak-47',
  ],
  EXPLOSIFS: [
    'explosif', 'dynamite', 'tnt', 'bombe artisanale', 'détonateur', 'c4',
  ],
  ORGANES_HUMAINS: [
    'organe humain', 'rein à vendre', 'don d\'organe rémunéré', 'vente de rein',
  ],
  MEDICAMENTS_ILLICITES: [
    'médicament sans ordonnance', 'tramadol en vente', 'morphine à vendre',
    'anabolisant', 'stéroïde anabolisant', 'médicament contrefait',
  ],
  CONTREFACONS: [
    'contrefaçon', 'réplique de luxe', 'copie identique', 'faux de marque',
    'produit contrefait',
  ],
  FAUSSES_IDENTITES: [
    'faux papiers', 'fausse carte d\'identité', 'faux passeport',
    'identité falsifiée', 'faux permis de conduire',
  ],
  DOCUMENTS_OFFICIELS: [
    'faux diplôme', 'faux acte de naissance', 'document administratif falsifié',
    'faux cachet officiel',
  ],
  PRODUITS_VOLES: [
    'produit volé', 'objet volé', 'sans papiers d\'origine', 'origine douteuse',
    'marchandise volée',
  ],
  ESPECES_PROTEGEES: [
    'ivoire', 'corne de rhinocéros', 'espèce protégée', 'peau de léopard',
    'écaille de tortue',
  ],
  MATIERES_DANGEREUSES: [
    'matière radioactive', 'produit chimique dangereux', 'mercure à vendre',
    'substance toxique',
  ],
  SERVICES_ILLICITES: [
    'piratage de compte', 'hacking à la demande', 'faux avis achetés',
    'usurpation d\'identité', 'service de hacking',
  ],
  // Catégorie ouverte : couvre tout contenu manifestement illégal qui ne
  // rentre dans aucune case ci-dessus. À enrichir au fil de l'usage réel.
  OTHER_ILLEGAL: [
    'contenu illégal', 'produit interdit à la vente', 'marché noir',
  ],
};

// Formulations qui, sans être illégales en soi, sont des signaux de
// comportement à risque (contournement de la messagerie, opacité
// volontaire, pression à l'achat...).
const SUSPICIOUS_PHRASES = [
  'dm pour prix', 'mp pour prix', 'disponible discrètement', 'discrétion assurée',
  'pas de questions', 'sans poser de questions', 'livraison partout sans vérification',
  'contact whatsapp', 'contactez-moi sur whatsapp', 'paiement avant livraison',
  'paiement uniquement avant envoi', 'transaction rapide et discrète',
];

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // retire les accents pour un matching plus robuste
}

// Détecte un numéro de téléphone ou une mention explicite d'un canal
// externe dans le texte libre — signe classique de contournement de la
// messagerie intégrée.
function detectContactBypass(text) {
  const phoneRegex = /(\+?\d[\d\s.-]{7,}\d)/;
  return phoneRegex.test(text);
}

/**
 * Analyse une annonce et renvoie :
 * - score : niveau de risque cumulé
 * - flags : liste détaillée des signaux détectés
 * - matchedIllegalCategories : catégories interdites détectées textuellement
 * - recommendation : 'approve' | 'review' | 'block'
 */
export function analyzeListing({ title = '', description = '', category = '', price = 0 }) {
  const fullText = normalize(`${title} ${description}`);
  const flags = [];
  const matchedIllegalCategories = new Set();
  let score = 0;

  // Couche « règles » : mots-clés de catégories interdites.
  for (const [cat, keywords] of Object.entries(ILLEGAL_KEYWORDS)) {
    for (const kw of keywords) {
      if (fullText.includes(normalize(kw))) {
        matchedIllegalCategories.add(cat);
        score += 50;
        flags.push({ type: 'illegal_keyword', category: cat, matched: kw });
      }
    }
  }

  // Couche « comportement » : formulations suspectes.
  for (const phrase of SUSPICIOUS_PHRASES) {
    if (fullText.includes(normalize(phrase))) {
      score += 15;
      flags.push({ type: 'suspicious_phrase', matched: phrase });
    }
  }

  // Contournement probable de la messagerie intégrée.
  if (detectContactBypass(fullText)) {
    score += 10;
    flags.push({ type: 'contact_bypass', matched: 'numéro de téléphone dans le texte' });
  }

  // Anomalie de prix simple : un prix anormalement bas sur une catégorie de
  // valeur peut indiquer un article volé ou un article inexistant utilisé
  // comme appât. Heuristique volontairement prudente, à affiner avec de
  // vraies données au fil du temps.
  const highValueCategories = ['Électronique et téléphones', 'Véhicules et pièces'];
  if (highValueCategories.includes(category) && price > 0 && price < 1000) {
    score += 10;
    flags.push({ type: 'price_anomaly', matched: `${price} FCFA pour la catégorie ${category}` });
  }

  let recommendation = 'approve';
  if (matchedIllegalCategories.size > 0) {
    recommendation = 'block';
  } else if (score >= 20) {
    recommendation = 'review';
  }

  return {
    score,
    flags,
    matchedIllegalCategories: Array.from(matchedIllegalCategories),
    recommendation,
  };
}

// Point d'accroche pour une vraie analyse d'image, à brancher plus tard sur
// un service de vision par IA. Renvoie toujours "non vérifié" pour l'instant
// — ne jamais faire croire qu'une vérification a eu lieu si ce n'est pas le
// cas.
export async function analyzeImage(_photoUrl) {
  return { checked: false, flags: [] };
}

export { ILLEGAL_KEYWORDS, SUSPICIOUS_PHRASES };
