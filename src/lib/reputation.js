import { supabase } from './supabase';

export const TRUST_BADGE_THRESHOLD = 10;

// Note moyenne d'un ARTICLE précis (pas du vendeur en général) : les avis
// sont liés à une commande, et chaque commande à une annonce précise —
// on peut donc remonter jusqu'à l'annonce sans rien changer au schéma.
export async function getListingRating(listingId) {
  const { data } = await supabase
    .from('reviews')
    .select('note, orders!inner(listing_id)')
    .eq('orders.listing_id', listingId);
  if (!data || data.length === 0) return { average: null, count: 0 };
  const total = data.reduce((sum, r) => sum + r.note, 0);
  return { average: total / data.length, count: data.length };
}

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
