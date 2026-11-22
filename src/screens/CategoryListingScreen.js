import React, { useState, useCallback } from 'react';
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

export default function CategoryListingScreen({ route, navigation }) {
  const { formatPrice } = usePrefs();
  const { category, vendeurId, title } = route.params;
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  // Catégorie vide : une pub et des articles à découvrir plutôt qu'un écran blanc.
  const [ad, setAd] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const loadFiller = useCallback(async () => {
    const [adsRes, sugRes] = await Promise.all([
      supabase.from('ads').select('*').eq('active', true).in('placement', ['tous', 'accueil']).order('position', { ascending: true }),
      supabase.from('listings').select('*').eq('status', 'disponible').eq('moderation_status', 'approved').order('created_at', { ascending: false }).limit(40),
    ]);
    const ads = (adsRes.data || []).filter((a) => !a.target_category || a.target_category === category);
    ads.sort((a, b) => (b.target_category === category) - (a.target_category === category));
    setAd(ads[0] || null);
    const now = new Date();
    const ranked = (sugRes.data || [])
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
      if (data.length === 0 && !vendeurId) loadFiller();
    }
    setLoading(false);
  }, [category, vendeurId, loadFiller]);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings])
  );

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title || category}</Text>
        {vendeurId ? (
          <TouchableOpacity onPress={() => setReportOpen(true)} hitSlop={10}>
            <Ionicons name="flag-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </GradientHeader>
      {vendeurId ? (
        <ReportUserModal visible={reportOpen} onClose={() => setReportOpen(false)} target={{ id: vendeurId, name: title }} />
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
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

                {ad ? (
                  ad.image_url ? (
                    <ImageBackground
                      source={{ uri: ad.image_url }}
                      style={[styles.adBox, { backgroundColor: ad.color || colors.purple }]}
                      imageStyle={{ borderRadius: radius.md }}
                      resizeMode="cover"
                    >
                      {ad.title || ad.subtitle ? (
                        <View style={styles.adOverlay}>
                          {ad.title ? <Text style={styles.adTitle}>{ad.title}</Text> : null}
                          {ad.subtitle ? <Text style={styles.adSub}>{ad.subtitle}</Text> : null}
                        </View>
                      ) : null}
                    </ImageBackground>
                  ) : (
                    <View style={[styles.adBox, { backgroundColor: ad.color || colors.purple }]}>
                      {ad.title ? <Text style={styles.adTitle}>{ad.title}</Text> : null}
                      {ad.subtitle ? <Text style={styles.adSub}>{ad.subtitle}</Text> : null}
                    </View>
                  )
                ) : null}

                {suggestions.length > 0 ? (
                  <View>
                    <Text style={styles.sugTitle}>Ça pourrait t'intéresser</Text>
                    <View style={styles.sugGrid}>
                      {suggestions.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.card, styles.sugCard]}
                          onPress={() => navigation.navigate('ProductDetail', { listing: item })}
                        >
                          <View style={styles.thumb}>
                            {item.photo_url ? (
                              <Image source={{ uri: item.photo_url }} style={styles.thumbImage} />
                            ) : (
                              <Ionicons name="image-outline" size={26} color={colors.textMuted} />
                            )}
                          </View>
                          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
                          <Text style={styles.cardCity} numberOfLines={1}>{item.city}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
                  <Text style={styles.backLinkText}>Voir les autres catégories</Text>
                </TouchableOpacity>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('ProductDetail', { listing: item })}
            >
              <View style={styles.thumb}>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.thumbImage} />
                ) : (
                  <Ionicons name="image-outline" size={26} color={colors.textMuted} />
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardPrice}>
                {formatPrice(item.price)}
              </Text>
              <Text style={styles.cardCity} numberOfLines={1}>{item.city}</Text>
            </TouchableOpacity>
          )}
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
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tintOrange, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 19 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orange, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 11, marginTop: spacing.md },
  emptyButtonText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  adBox: { height: 110, borderRadius: radius.md, padding: spacing.md, justifyContent: 'center', overflow: 'hidden', marginTop: spacing.sm },
  adOverlay: { backgroundColor: 'rgba(0,0,0,0.35)', padding: spacing.sm, borderRadius: radius.sm, alignSelf: 'flex-start' },
  adTitle: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  adSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  sugTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  sugGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sugCard: { flex: 0, width: '48.5%' },
  backLink: { alignItems: 'center', paddingVertical: spacing.lg },
  backLinkText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
  card: {
    flex: 1,
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
  },
  thumbImage: { width: '100%', height: '100%' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  cardPrice: { fontSize: 13, fontWeight: '700', color: colors.orange, marginTop: 2 },
  cardCity: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
});
