// Liste des favoris (articles + boutiques) — src/screens/FavoritesScreen.js
import { usePrefs } from '../lib/prefs';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import InfoHeader from '../components/InfoHeader';

export default function FavoritesScreen({ navigation }) {
  const { formatPrice } = usePrefs();
  const [tab, setTab] = useState('articles');
  const [articles, setArticles] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const myId = await getDeviceUserId();
      const { data: w } = await supabase.from('wishlist_items').select('id, listing_id').eq('acheteur_id', myId).order('created_at', { ascending: false });
      const ids = (w || []).map((x) => x.listing_id);
      let listings = [];
      if (ids.length) {
        const { data } = await supabase.from('listings').select('*').in('id', ids);
        listings = data || [];
      }
      setArticles(ids.map((id) => listings.find((l) => l.id === id)).filter(Boolean));

      const { data: f } = await supabase.from('favorite_shops').select('id, vendeur_id').eq('acheteur_id', myId).order('created_at', { ascending: false });
      const vIds = [...new Set((f || []).map((x) => x.vendeur_id).filter(Boolean))];
      let profiles = {};
      if (vIds.length) {
        const { data: p } = await supabase.from('public_profiles').select('id, nom, boutique_nom').in('id', vIds);
        (p || []).forEach((x) => { profiles[x.id] = x; });
      }
      setShops((f || []).map((x) => ({ ...x, profile: profiles[x.vendeur_id] || null })));
    } catch (e) {
      // listes vides en cas de souci réseau
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeArticle = async (listingId) => {
    const myId = await getDeviceUserId();
    await supabase.from('wishlist_items').delete().eq('acheteur_id', myId).eq('listing_id', listingId);
    setArticles((a) => a.filter((x) => x.id !== listingId));
  };
  const removeShop = async (id) => {
    await supabase.from('favorite_shops').delete().eq('id', id);
    setShops((s) => s.filter((x) => x.id !== id));
  };

  return (
    <View style={styles.container}>
      <InfoHeader title="Mes favoris" navigation={navigation} />
      <View style={styles.tabs}>
        {[['articles', `Articles (${articles.length})`], ['boutiques', `Boutiques (${shops.length})`]].map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : tab === 'articles' ? (
        <FlatList
          data={articles}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aucun article enregistré. Appuie sur le cœur d'une annonce pour la retrouver ici.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('Accueil', { screen: 'ProductDetail', params: { listing: item } })}>
              <View style={styles.thumb}>
                {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.img} /> : <Ionicons name="image-outline" size={22} color={colors.textMuted} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.sub}>{formatPrice(item.price)} · {item.city}</Text>
                {item.status && item.status !== 'disponible' ? <Text style={styles.sold}>Plus disponible</Text> : null}
              </View>
              <TouchableOpacity onPress={() => removeArticle(item.id)} hitSlop={10}>
                <Ionicons name="heart" size={20} color={colors.orange} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aucune boutique favorite. Appuie sur le cœur à côté d'un vendeur pour l'ajouter.</Text>}
          renderItem={({ item }) => {
            const name = item.profile?.boutique_nom || item.profile?.nom || 'Boutique';
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('CategoryListing', { vendeurId: item.vendeur_id, title: name })}>
                <View style={[styles.thumb, { backgroundColor: colors.purple }]}>
                  <Ionicons name="storefront-outline" size={22} color={colors.white} />
                </View>
                <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{name}</Text>
                <TouchableOpacity onPress={() => removeShop(item.id)} hitSlop={10}>
                  <Ionicons name="heart" size={20} color={colors.orange} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', margin: spacing.lg, marginBottom: 0, backgroundColor: colors.surface, borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabOn: { backgroundColor: colors.purple },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextOn: { color: colors.white },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: spacing.xl, lineHeight: 19 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md, marginBottom: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  title: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sold: { fontSize: 11, color: colors.danger, fontWeight: '700', marginTop: 2 },
});
