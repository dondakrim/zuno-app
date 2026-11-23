// Recommandations selon les centres d'intérêt — src/lib/recommendations.js
import { supabase } from './supabase';
import { getDeviceUserId } from './deviceUser';

const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Un article correspond à un intérêt si sa catégorie et l'intérêt se contiennent
// l'un l'autre (ex. « Mode » et « Mode et vêtements »).
export function matchesInterest(category, interests) {
  const c = norm(category);
  if (!c || !interests || interests.length === 0) return false;
  return interests.some((i) => {
    const n = norm(i);
    return n && (c.includes(n) || n.includes(c));
  });
}

// 1) les centres d'intérêt enregistrés sur le profil (users.interests),
// 2) sinon, ceux déduits des articles mis de côté ou dans le panier.
export async function getUserInterests() {
  const myId = await getDeviceUserId();
  try {
    const { data, error } = await supabase.from('users').select('interests').eq('id', myId).maybeSingle();
    if (!error && data && Array.isArray(data.interests) && data.interests.length > 0) return data.interests;
  } catch (e) { /* colonne absente : on déduit */ }

  const cats = new Set();
  try {
    const [w, c] = await Promise.all([
      supabase.from('wishlist_items').select('listings(category)').eq('acheteur_id', myId),
      supabase.from('cart_items').select('listings(category)').eq('acheteur_id', myId),
    ]);
    [...(w.data || []), ...(c.data || [])].forEach((r) => { if (r.listings && r.listings.category) cats.add(r.listings.category); });
  } catch (e) { /* rien à déduire */ }
  return [...cats];
}

// Articles proposés : ceux qui collent aux intérêts d'abord, puis les boostés,
// puis les plus récents. `excludeIds` évite de reproposer ce qui est déjà affiché.
export async function fetchRecommended({ interests = [], excludeIds = [], limit = 8 } = {}) {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'disponible')
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const skip = new Set(excludeIds);
  const now = new Date();
  const score = (l) =>
    (matchesInterest(l.category, interests) ? 4 : 0) +
    (l.boost_until && new Date(l.boost_until) > now ? 2 : 0) +
    (l.priority ? 1 : 0);
  return data
    .filter((l) => !skip.has(l.id))
    .map((l, i) => ({ l, s: score(l), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.l);
}

// Publicités actives pour un emplacement ('accueil' | 'tendances'), celles
// ciblées sur un intérêt de l'utilisateur en premier. Une pub sans cible
// s'affiche pour tout le monde ; une pub ciblée sur autre chose est masquée.
export async function fetchTargetedAds(placement, interests = []) {
  const { data, error } = await supabase.from('ads').select('*').eq('active', true).order('position', { ascending: true });
  if (error || !data) return [];
  return data
    .filter((ad) => !ad.placement || ad.placement === 'tous' || ad.placement === placement)
    .filter((ad) => !ad.target_category || matchesInterest(ad.target_category, interests))
    .map((ad, i) => ({ ad, hit: ad.target_category ? 1 : 0, i }))
    .sort((a, b) => b.hit - a.hit || a.i - b.i)
    .map((x) => x.ad);
}
