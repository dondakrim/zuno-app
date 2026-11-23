// Garantie proposée par le vendeur sur son article.
// En base : listings.warranty_days  (vide = ancienne annonce, 0 = sans garantie, sinon nombre de jours)
export const WARRANTY_OPTIONS = [
  { label: '7 jours', days: 7 },
  { label: '1 mois', days: 30 },
  { label: '3 mois', days: 90 },
  { label: '6 mois', days: 180 },
  { label: '1 an', days: 365 },
  { label: '2 ans', days: 730 },
];

export function warrantyLabel(days) {
  const n = Number(days);
  if (!n || n <= 0) return '';
  const exact = WARRANTY_OPTIONS.find((o) => o.days === n);
  if (exact) return exact.label;
  if (n % 365 === 0) return `${n / 365} an${n / 365 > 1 ? 's' : ''}`;
  if (n % 30 === 0) return `${n / 30} mois`;
  return `${n} jours`;
}
