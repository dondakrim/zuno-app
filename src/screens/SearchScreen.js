import React, { useState, useCallback } from 'react';
import { usePrefs } from '../lib/prefs';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { categories } from '../data/mockListings';
import { supabase } from '../lib/supabase';
import { getUserInterests, matchesInterest } from '../lib/recommendations';
import useWishlist from '../lib/useWishlist';
import GradientHeader from '../components/GradientHeader';
import MasonrySection from '../components/MasonrySection';

export default function SearchScreen({ navigation }) {
  const { formatPrice } = usePrefs();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Parcours par catégorie et par centre d'intérêt (quand aucune recherche n'est lancée)
  const [allListings, setAllListings] = useState([]);
  const [interests, setInterests] = useState([]);
  const [browseCat, setBrowseCat] = useState(null);
  const [browseLoading, setBrowseLoading] = useState(true);
  const { wishlistIds, loadWishlist, toggleWishlist } = useWishlist(navigation);

  const loadBrowse = useCallback(async () => {
    setBrowseLoading(true);
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'disponible')
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(150);
    setAllListings(data || []);
    setInterests(await getUserInterests());
    setBrowseLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBrowse();
      loadWishlist();
    }, [loadBrowse, loadWishlist])
  );

  const openProduct = (item) => navigation.navigate('ProductDetail', { listing: item });
  const forYou = allListings.filter((l) => matchesInterest(l.category, interests)).slice(0, 8);
  const sections = categories
    .map((cat) => ({ name: cat, items: allListings.filter((l) => l.category === cat) }))
    .filter((sec) => sec.items.length > 0);

  const activeFilterCount =
    (category ? 1 : 0) + (city.trim() ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);

    let query = supabase.from('listings').select('*').eq('status', 'disponible').eq('moderation_status', 'approved');

    if (search.trim()) query = query.ilike('title', `%${search.trim()}%`);
    if (category) query = query.eq('category', category);
    if (city.trim()) query = query.ilike('city', `%${city.trim()}%`);
    if (minPrice) query = query.gte('price', Number(minPrice));
    if (maxPrice) query = query.lte('price', Number(maxPrice));

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) setResults(data);
    setLoading(false);
  }, [search, category, city, minPrice, maxPrice]);

  const handleReset = () => {
    setCategory(null);
    setCity('');
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <Text style={styles.headerTitle}>Boutiques</Text>
        <Text style={styles.headerSub}>Par catégorie et selon tes centres d'intérêt</Text>
      </GradientHeader>

      <View style={styles.body}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Nom de l'article"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={(t) => { setSearch(t); if (!t.trim()) setSearched(false); }}
            onSubmitEditing={runSearch}
            style={styles.searchInput}
          />
          <TouchableOpacity
            style={[styles.filterToggle, activeFilterCount > 0 && styles.filterToggleActive]}
            onPress={() => setFiltersOpen((v) => !v)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? colors.white : colors.textPrimary}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {filtersOpen && (
          <View style={styles.filterPanel}>
            <Text style={styles.filterLabel}>Catégorie</Text>
            <View style={styles.chipRow}>
              {categories.map((c) => {
                const active = c === category;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(active ? null : c)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterLabel}>Prix (FCFA)</Text>
            <View style={styles.priceRow}>
              <TextInput
                placeholder="Min"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={minPrice}
                onChangeText={setMinPrice}
                style={[styles.priceInput, { marginRight: spacing.sm }]}
              />
              <TextInput
                placeholder="Max"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
                style={styles.priceInput}
              />
            </View>

            <Text style={styles.filterLabel}>Ville</Text>
            <TextInput
              placeholder="Ex: Niamey"
              placeholderTextColor={colors.textMuted}
              value={city}
              onChangeText={setCity}
              style={styles.cityInput}
            />

            <View style={styles.filterButtonRow}>
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={runSearch}>
                <Text style={styles.applyButtonText}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!filtersOpen && (
          <TouchableOpacity style={styles.searchButton} onPress={runSearch}>
            <Text style={styles.searchButtonText}>Rechercher</Text>
          </TouchableOpacity>
        )}

        {!searched && !loading ? (
          browseLoading ? (
            <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.xs }}>
                {[null, ...categories].map((c) => {
                  const active = c === browseCat;
                  return (
                    <TouchableOpacity key={c || 'all'} onPress={() => setBrowseCat(c)} style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{c || 'Tout'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {browseCat ? (
                <MasonrySection
                  title={browseCat}
                  items={allListings.filter((l) => l.category === browseCat)}
                  getSellerRating={() => undefined}
                  wishlistIds={wishlistIds}
                  onToggleWishlist={toggleWishlist}
                  onPressItem={openProduct}
                />
              ) : (
                <>
                  {forYou.length > 0 && (
                    <MasonrySection
                      title="Pour vous"
                      items={forYou}
                      getSellerRating={() => undefined}
                      wishlistIds={wishlistIds}
                      onToggleWishlist={toggleWishlist}
                      onPressItem={openProduct}
                    />
                  )}
                  {sections.map((sec) => (
                    <MasonrySection
                      key={sec.name}
                      title={sec.name}
                      items={sec.items.slice(0, 8)}
                      onSeeAll={() => setBrowseCat(sec.name)}
                      getSellerRating={() => undefined}
                      wishlistIds={wishlistIds}
                      onToggleWishlist={toggleWishlist}
                      onPressItem={openProduct}
                    />
                  ))}
                  {allListings.length === 0 && (
                    <Text style={styles.emptyText}>Aucun article pour l'instant.</Text>
                  )}
                </>
              )}
            </ScrollView>
          )
        ) : loading ? (
          <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}
            ListEmptyComponent={
              searched ? (
                <Text style={styles.emptyText}>Aucun article ne correspond à ta recherche.</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('ProductDetail', { listing: item })}
              >
                <View style={[styles.thumb, { overflow: 'hidden' }]}>
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>
                    {formatPrice(item.price)} · {item.city}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 50, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '600' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.purple,
    borderRadius: radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterCountText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  filterPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { fontSize: 12, color: colors.textPrimary },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  priceRow: { flexDirection: 'row' },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    height: 40,
    paddingHorizontal: spacing.sm,
  },
  cityInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    height: 40,
    paddingHorizontal: spacing.sm,
  },
  filterButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  resetButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  resetButtonText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  applyButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.orange,
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 13, fontWeight: '600', color: colors.white },
  searchButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.orange,
    alignItems: 'center',
  },
  searchButtonText: { fontSize: 13, fontWeight: '600', color: colors.white },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
});
