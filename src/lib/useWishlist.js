// Cœur « mettre de côté » partagé par les écrans — src/lib/useWishlist.js
import { useState, useCallback } from 'react';
import { supabase } from './supabase';
import { getDeviceUserId, ensureAccountComplete } from './deviceUser';

export default function useWishlist(navigation) {
  const [wishlistIds, setWishlistIds] = useState(new Set());

  const loadWishlist = useCallback(async () => {
    const myId = await getDeviceUserId();
    const { data } = await supabase.from('wishlist_items').select('listing_id').eq('acheteur_id', myId);
    setWishlistIds(new Set((data || []).map((w) => w.listing_id)));
  }, []);

  const toggleWishlist = useCallback(
    async (listing) => {
      const myId = await getDeviceUserId();
      if (wishlistIds.has(listing.id)) {
        await supabase.from('wishlist_items').delete().eq('acheteur_id', myId).eq('listing_id', listing.id);
      } else {
        const ok = await ensureAccountComplete(navigation, 'mettre un article de côté');
        if (!ok) return;
        await supabase.from('wishlist_items').insert({ acheteur_id: myId, listing_id: listing.id });
      }
      loadWishlist();
    },
    [wishlistIds, loadWishlist, navigation]
  );

  return { wishlistIds, loadWishlist, toggleWishlist };
}
