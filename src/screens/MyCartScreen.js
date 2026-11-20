import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import { getUserInterests, fetchRecommended } from '../lib/recommendations';
import useWishlist from '../lib/useWishlist';
import GradientHeader from '../components/GradientHeader';
import MasonrySection from '../components/MasonrySection';

export default function MyCartScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const { wishlistIds, loadWishlist, toggleWishlist } = useWishlist(navigation);

  const loadCart = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    const { data, error } = await supabase
      .from('cart_items')
      .select('*, listings(*)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });

    const cart = !error && data ? data.filter((i) => i.listings) : [];
    setItems(cart);
    setLoading(false);

    // « Vous aimerez aussi » : selon les centres d'intérêt, sans reproposer
    // ce qui est déjà dans le panier.
    const interests = await getUserInterests();
    setRecommended(await fetchRecommended({ interests, excludeIds: cart.map((i) => i.listings.id), limit: 8 }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCart();
      loadWishlist();
    }, [loadCart, loadWishlist])
  );

  const handleRemove = async (id) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', id);
    if (error) {
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }
    loadCart();
  };

  const total = items.reduce((sum, item) => sum + item.listings.price * item.quantity, 0);

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <Text style={styles.headerTitle}>Mon panier</Text>
        {items.length > 0 ? (
          <Text style={styles.headerSub}>{items.length} article{items.length > 1 ? 's' : ''}</Text>
        ) : null}
      </GradientHeader>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cart-outline" size={44} color={colors.purple} />
              </View>
              <Text style={styles.emptyTitle}>Pas encore d’articles ?</Text>
              <Text style={styles.emptyText}>Continuez de scroller pour en trouver.</Text>
              <TouchableOpacity
                style={styles.browseButton}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Boutique')}
              >
                <Text style={styles.browseText}>Parcourir les articles</Text>
              </TouchableOpacity>
            </View>
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => navigation.navigate('ProductDetail', { listing: item.listings })}
              >
                <View style={styles.thumb}>
                  {item.listings.photo_url ? (
                    <Image source={{ uri: item.listings.photo_url }} style={styles.thumbImage} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.listings.title}</Text>
                  <Text style={styles.cardSubtitle}>
                    Qté {item.quantity} · {(item.listings.price * item.quantity).toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemove(item.id)} style={styles.removeButton}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}

          {recommended.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <MasonrySection
                title="Vous aimerez aussi"
                items={recommended}
                getSellerRating={() => undefined}
                wishlistIds={wishlistIds}
                onToggleWishlist={toggleWishlist}
                onPressItem={(item) => navigation.navigate('ProductDetail', { listing: item })}
              />
            </View>
          )}
        </ScrollView>
      )}

      {items.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total.toLocaleString('fr-FR')} FCFA</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 50, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '600' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.tintPurple, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  browseButton: { marginTop: spacing.lg, backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl },
  browseText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  removeButton: { padding: spacing.xs },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  totalLabel: { fontSize: 14, color: colors.textSecondary },
  totalValue: { fontSize: 18, fontWeight: '700', color: colors.orange },
});
