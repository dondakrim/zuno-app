import { supabase } from './supabase';

export const TRUST_BADGE_THRESHOLD = 10;

// Note moyenne d'un ARTICLE précis (pas du vendeur en général) : les avis
// sont liés à une commande, et chaque commande à une annonce précise.
// La vue `listing_ratings` (base de données) calcule la moyenne sans les avis masqués.
export async function getListingRating(listingId) {
  const { data, error } = await supabase
    .from('listing_ratings')
    .select('avg_note, n')
    .eq('listing_id', listingId)
    .maybeSingle();
  if (error || !data) return { average: null, count: 0 };
  return { average: Number(data.avg_note), count: data.n };
}

// Note moyenne et nombre d'avis reçus par un vendeur (via la vue `seller_ratings`).
export async function getSellerRating(vendeurId) {
  const { data, error } = await supabase
    .from('seller_ratings')
    .select('avg_note, n')
    .eq('vendeur_id', vendeurId)
    .maybeSingle();
  if (error || !data) return { average: null, count: 0 };
  return { average: Number(data.avg_note), count: data.n };
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
