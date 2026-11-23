import { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { getDeviceUserId, ensureAccountComplete } from './deviceUser';

// État du panier partagé entre toutes les cartes et la page article :
// une seule requête pour savoir quels articles sont déjà dans le panier.
let items = new Map(); // listing_id -> id de la ligne cart_items
let loadedAt = 0;
let loading = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export async function refreshCart(force = false) {
  if (!force && Date.now() - loadedAt < 15000) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const myId = await getDeviceUserId();
      const { data, error } = await supabase
        .from('cart_items')
        .select('id, listing_id')
        .eq('acheteur_id', myId);
      if (!error && data) {
        items = new Map(data.map((r) => [r.listing_id, r.id]));
        loadedAt = Date.now();
        notify();
      }
    } catch (e) {
      // silencieux : le bouton reste utilisable
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export async function toggleCart(listingId, navigation) {
  const existing = items.get(listingId);
  if (existing) {
    const { error } = await supabase.from('cart_items').delete().eq('id', existing);
    if (error) throw error;
    items.delete(listingId);
    notify();
    return false;
  }
  const ok = await ensureAccountComplete(navigation, 'ajouter un article au panier');
  if (!ok) return null;
  const myId = await getDeviceUserId();
  const { data, error } = await supabase
    .from('cart_items')
    .insert({ acheteur_id: myId, listing_id: listingId, quantity: 1 })
    .select()
    .single();
  if (error) throw error;
  items.set(listingId, data?.id);
  notify();
  return true;
}

// Hook : { inCart, busy, toggle }
export function useCart(listingId, navigation) {
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    refreshCart();
    return () => listeners.delete(fn);
  }, []);

  const toggle = useCallback(async () => {
    if (busy) return;
    // Déjà dans le panier : on ouvre l'écran Panier (retrait depuis cet écran).
    if (items.has(listingId)) {
      try {
        navigation.navigate('Panier', { screen: 'MyCart' });
      } catch (e) {
        // pas d'onglet Panier (mode marchand) : rien à faire
      }
      return;
    }
    setBusy(true);
    try {
      await toggleCart(listingId, navigation);
    } catch (e) {
      Alert.alert('Panier', `Impossible de mettre à jour le panier. Détail technique : ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, listingId, navigation]);

  return { inCart: items.has(listingId), busy, toggle };
}
