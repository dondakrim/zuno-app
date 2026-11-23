// Moyens de paiement proposés à l'étape « Je paye par ».
// Pour activer un moyen plus tard : passe enabled à true (et branche son paiement côté serveur).
export const CASH_METHOD = {
  id: 'cash',
  label: 'Espèces',
  hint: "Tu paies à la réception de l'article",
};

export const MOBILE_METHODS = [
  {
    id: 'nita',
    label: 'MyNITA',
    hint: "Paiement dans l'appli MyNITA, rubrique « Achat en ligne »",
    accountLabel: 'Numéro de ton compte MyNITA',
    enabled: true,
  },
  { id: 'amanata', label: 'Amanata', hint: 'Bientôt disponible', enabled: false },
  { id: 'kkiapay', label: 'KKiaPay', hint: 'Bientôt disponible', enabled: false },
];

export function methodLabel(method) {
  if (!method) return '';
  if (method.kind === 'cash') return CASH_METHOD.label;
  return MOBILE_METHODS.find((m) => m.id === method.id)?.label || '';
}
