import { supabase } from './supabase';

export const TRUST_BADGE_THRESHOLD = 10;

// Récupère la note moyenne et le nombre d'avis reçus par un vendeur.
export async function getSellerRating(vendeurId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('note')
    .eq('cible_id', vendeurId);

  if (error || !data || data.length === 0) {
    return { average: null, count: 0 };
  }
  const total = data.reduce((sum, r) => sum + r.note, 0);
  return { average: total / data.length, count: data.length };
}

// Compte les ventes réellement finalisées (livrées ou récupérées) d'un
// vendeur, utilisé pour le badge de confiance.
export async function countCompletedSales(vendeurId) {
  const { data } = await supabase
    .from('orders')
    .select('id, listings!inner(vendeur_id), deliveries(statut_livraison)')
    .eq('listings.vendeur_id', vendeurId);

  return (data || []).filter((o) => o.deliveries?.[0]?.statut_livraison === 'livre').length;
}
