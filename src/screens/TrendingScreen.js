import React, { useState, useCallback } from 'react';
import { usePrefs } from '../lib/prefs';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getUserInterests, fetchRecommended, fetchTargetedAds } from '../lib/recommendations';
import useWishlist from '../lib/useWishlist';
import GradientHeader from '../components/GradientHeader';
import MasonrySection from '../components/MasonrySection';
import AdCarousel from '../components/AdCarousel';

export default function TrendingScreen({ navigation }) {
  const { formatPrice } = usePrefs();
  const [listings, setListings] = useState([]);
  const [forYou, setForYou] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const { wishlistIds, loadWishlist, toggleWishlist } = useWishlist(navigation);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    // En attendant un vrai suivi des vues/favoris, "tendance" correspond
    // ici aux annonces les plus récentes, toutes catégories confondues.
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'disponible')
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(40);
    if (!error && data) {
      // Priorité : d'abord les annonces boostées, puis triées par le
      // champ "priority" fixé depuis le tableau de bord admin, puis par
      // date de publication.
      const now = new Date();
      const sorted = [...data].sort((a, b) => {
        const aBoosted = a.boost_until && new Date(a.boost_until) > now;
        const bBoosted = b.boost_until && new Date(b.boost_until) > now;
        if (aBoosted && !bBoosted) return -1;
        if (!aBoosted && bBoosted) return 1;
        return (b.priority || 0) - (a.priority || 0);
      });
      setListings(sorted);
    }
    setLoading(false);

    // Pubs ciblées et « Pour vous », selon les centres d'intérêt.
    const interests = await getUserInterests();
    const [adsList, rec] = await Promise.all([
      fetchTargetedAds('tendances', interests),
      fetchRecommended({ interests, limit: 8 }),
    ]);
    setAds(adsList);
    setForYou(rec);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrending();
      loadWishlist();
    }, [loadTrending, loadWishlist])
  );

  const onPressAd = (ad) => {
    if (ad.link_url) Linking.openURL(ad.link_url).catch(() => {});
    else if (ad.target_category) navigation.navigate('CategoryListing', { category: ad.target_category });
  };

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <Text style={styles.headerTitle}>Tendances</Text>
        <Text style={styles.headerSub}>Ce qui plaît en ce moment</Text>
      </GradientHeader>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          {ads.length > 0 && (
            <View style={{ marginBottom: spacing.lg }}>
              <AdCarousel ads={ads} onPressAd={onPressAd} />
            </View>
          )}

          {forYou.length > 0 && (
            <MasonrySection
              title="Pour vous"
              items={forYou}
              getSellerRating={() => undefined}
              wishlistIds={wishlistIds}
              onToggleWishlist={toggleWishlist}
              onPressItem={(item) => navigation.navigate('ProductDetail', { listing: item })}
            />
          )}

          <Text style={styles.sectionTitle}>Tendances du moment</Text>
          {listings.length === 0 ? (
            <Text style={styles.emptyText}>Aucun article pour l'instant.</Text>
          ) : (
            <View style={styles.grid}>
              {listings.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('ProductDetail', { listing: item })}
                >
                  <View style={styles.thumb}>
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={styles.thumbImage} />
                    ) : (
                      <Ionicons name="image-outline" size={26} color={colors.textMuted} />
                    )}
                    {item.boost_until && new Date(item.boost_until) > new Date() && (
                      <View style={styles.boostBadge}>
                        <Ionicons name="flash" size={10} color={colors.white} />
                        <Text style={styles.boostBadgeText}>En vedette</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
                  <Text style={styles.cardCity} numberOfLines={1}>{item.city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 50, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '600' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  card: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  thumb: {
    width: '100%',
    height: 110,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
    position: 'relative',
  },
  boostBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.orange,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  boostBadgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  thumbImage: { width: '100%', height: '100%' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  cardPrice: { fontSize: 13, fontWeight: '700', color: colors.orange, marginTop: 2 },
  cardCity: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
});
