import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { categories } from '../data/mockListings';
import { supabase } from '../lib/supabase';

export default function SearchScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const activeFilterCount =
    (category ? 1 : 0) + (city.trim() ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);

    let query = supabase.from('listings').select('*').eq('status', 'disponible');

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rechercher</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Nom de l'article"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
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

        {loading ? (
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
                <View style={styles.thumb}>
                  {item.photo_url ? (
                    <Ionicons name="image" size={22} color={colors.textMuted} />
                  ) : (
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>
                    {Number(item.price).toLocaleString('fr-FR')} FCFA · {item.city}
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
  header: {
    backgroundColor: colors.purple,
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '600' },
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
