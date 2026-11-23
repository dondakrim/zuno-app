import React, { useState, useCallback, useMemo } from 'react';
import { usePrefs } from '../lib/prefs';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import GradientHeader from '../components/GradientHeader';
import { supabase } from '../lib/supabase';
import ReportUserModal from '../components/ReportUserModal';

const SORTS = [
  { key: 'recent', label: 'Récents', icon: 'time-outline' },
  { key: 'asc', label: 'Prix croissant', icon: 'trending-up-outline' },
  { key: 'desc', label: 'Prix décroissant', icon: 'trending-down-outline' },
];

export default function CategoryListingScreen({ route, navigation }) {
  const { formatPrice } = usePrefs();
  const { category, vendeurId, title } = route.params;
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [sort, setSort] = useState('recent');
  // Bannière fine + articles à découvrir quand la catégorie est vide.
  const [ad, setAd] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const loadAd = useCallback(async () => {
    const { data } = await supabase
      .from('ads')
      .select('*')
      .eq('active', true)
      .in('placement', ['tous', 'accueil'])
      .order('position', { ascending: true });
    const ads = (data || []).filter((a) => !a.target_category || a.target_category === category);
    ads.sort((a, b) => (b.target_category === category) - (a.target_category === category));
    setAd(ads[0] || null);
  }, [category]);

  const loadSuggestions = useCallback(async () => {
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'disponible')
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(40);
    const now = new Date();
    const ranked = (data || [])
      .filter((l) => l.category !== category)
      .sort((a, b) => {
        const ab = a.boost_until && new Date(a.boost_until) > now;
        const bb = b.boost_until && new Date(b.boost_until) > now;
        if (ab !== bb) return ab ? -1 : 1;
        return (b.priority || 0) - (a.priority || 0);
      });
    setSuggestions(ranked.slice(0, 6));
  }, [category]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('listings').select('*').eq('status', 'disponible').eq('moderation_status', 'approved');
    query = vendeurId ? query.eq('vendeur_id', vendeurId) : query.eq('category', category);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      setListings(data);
      if (data.length === 0 && !vendeurId) loadSuggestions();
    }
    if (!vendeurId) loadAd();
    setLoading(false);
  }, [category, vendeurId, loadAd, loadSuggestions]);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings])
  );

  const sorted = useMemo(() => {
    const arr = [...listings];
    if (sort === 'asc') arr.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === 'desc') arr.sort((a, b) => Number(b.price) - Number(a.price));
    // Les articles en rupture passent en dernier.
    const isOut = (l) => typeof l.stock === 'number' && l.stock <= 0;
    arr.sort((a, b) => Number(isOut(a)) - Number(isOut(b)));
    if (arr.length % 2 === 1) arr.push({ id: '__pad', pad: true });
    return arr;
  }, [listings, sort]);

  const realCount = listings.length;

  const renderCard = (item, extraStyle) => {
    const tracked = typeof item.stock === 'number';
    const out = tracked && item.stock <= 0;
    const low = tracked && item.stock > 0 && item.stock <= 3;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, extraStyle]}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('ProductDetail', { listing: item })}
      >
        <View style={styles.thumb}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={[styles.thumbImage, out && { opacity: 0.45 }]} />
          ) : (
            <Ionicons name="image-outline" size={28} color={colors.textMuted} />
          )}
          {out ? (
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Ionicons name="alert-circle" size={11} color="#fff" />
              <Text style={styles.badgeText}>Rupture</Text>
            </View>
          ) : low ? (
            <View style={[styles.badge, { backgroundColor: colors.orange }]}>
              <Ionicons name="flame" size={11} color="#fff" />
              <Text style={styles.badgeText}>Plus que {item.stock}</Text>
            </View>
          ) : item.condition ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(30,20,60,0.72)' }]}>
              <Text style={styles.badgeText}>{item.condition}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={styles.cardCity} numberOfLines={1}>{item.city || 'Non précisé'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const Banner = () => {
    if (vendeurId) return null;
    if (ad && ad.image_url) {
      return (
        <ImageBackground
          source={{ uri: ad.image_url }}
          style={[styles.banner, { backgroundColor: ad.color || colors.purple }]}
          imageStyle={{ borderRadius: 16 }}
          resizeMode="cover"
        >
          {ad.title || ad.subtitle ? (
            <View style={styles.bannerOverlay}>
              {ad.title ? <Text style={styles.bannerTitle} numberOfLines={1}>{ad.title}</Text> : null}
              {ad.subtitle ? <Text style={styles.bannerSub} numberOfLines={1}>{ad.subtitle}</Text> : null}
            </View>
          ) : null}
        </ImageBackground>
      );
    }
    if (ad) {
      return (
        <View style={[styles.banner, { backgroundColor: ad.color || colors.purple }]}>
          <View style={{ flex: 1 }}>
            {ad.title ? <Text style={styles.bannerTitle} numberOfLines={1}>{ad.title}</Text> : null}
            {ad.subtitle ? <Text style={styles.bannerSub} numberOfLines={1}>{ad.subtitle}</Text> : null}
          </View>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: colors.purple }]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('PostListing')}
      >
        <View style={styles.bannerIcon}>
          <Ionicons name="pricetag" size={20} color={colors.orange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle} numberOfLines={1}>Tu as quelque chose à vendre ?</Text>
          <Text style={styles.bannerSub} numberOfLines={1}>Publie ton annonce en 2 minutes</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View>
      {Banner()}
      {realCount > 1 ? (
        <View style={styles.sortRow}>
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSort(s.key)}
                activeOpacity={0.85}
              >
                <Ionicons name={s.icon} size={13} color={active ? '#fff' : colors.textSecondary} />
                <Text style={[styles.sortText, active && { color: '#fff' }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title || category}</Text>
          {!loading ? (
            <Text style={styles.headerSub}>
              {realCount === 0 ? 'Aucun article' : realCount === 1 ? '1 article' : `${realCount} articles`}
            </Text>
          ) : null}
        </View>
        {vendeurId ? (
          <TouchableOpacity onPress={() => setReportOpen(true)} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="flag-outline" size={18} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </GradientHeader>
      {vendeurId ? (
        <ReportUserModal visible={reportOpen} onClose={() => setReportOpen(false)} target={{ id: vendeurId, name: title }} />
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: spacing.lg, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader()}
          ListEmptyComponent={
            vendeurId ? (
              <Text style={styles.emptyText}>Ce vendeur n'a pas d'article en vente pour l'instant.</Text>
            ) : (
              <View>
                <View style={styles.emptyBox}>
                  <View style={styles.emptyCircle}>
                    <Ionicons name="sparkles-outline" size={28} color={colors.orange} />
                  </View>
                  <Text style={styles.emptyTitle}>Pas encore d'article ici</Text>
                  <Text style={styles.emptySub}>
                    Sois le premier à vendre dans « {title || category} » : ton annonce sera la plus vue.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('PostListing')}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={colors.white} />
                    <Text style={styles.emptyButtonText}>Publier une annonce</Text>
                  </TouchableOpacity>
                </View>

                {suggestions.length > 0 ? (
                  <View>
                    <Text style={styles.sugTitle}>Ça pourrait t'intéresser</Text>
                    <View style={styles.sugGrid}>
                      {suggestions.map((item) => renderCard(item, styles.sugCard))}
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
                  <Text style={styles.backLinkText}>Voir les autres catégories</Text>
                </TouchableOpacity>
              </View>
            )
          }
          renderItem={({ item }) => (item.pad ? <View style={{ flex: 1 }} /> : renderCard(item))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.purple,
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },

  banner: { height: 72, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', marginBottom: 14 },
  bannerOverlay: { backgroundColor: 'rgba(0,0,0,0.38)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, maxWidth: '85%' },
  bannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  bannerSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 2 },

  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sortChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  sortChipActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  sortText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  emptyBox: { alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tintOrange, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 19 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orange, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 11, marginTop: spacing.md },
  emptyButtonText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  sugTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  sugGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sugCard: { flex: 0, width: '47.8%' },
  backLink: { alignItems: 'center', paddingVertical: spacing.lg },
  backLinkText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },

  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#1B1530',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  thumb: { width: '100%', height: 140, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, minHeight: 34, lineHeight: 17 },
  cardPrice: { fontSize: 15, fontWeight: '800', color: colors.orange, marginTop: 4 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  cardCity: { fontSize: 11, color: colors.textSecondary, flexShrink: 1 },
});
