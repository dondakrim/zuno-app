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

  const loadListings = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('listings').select('*').eq('status', 'disponible').eq('moderation_status', 'approved');
    query = vendeurId ? query.eq('vendeur_id', vendeurId) : query.eq('category', category);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) setListings(data);
    setLoading(false);
  }, [category, vendeurId]);

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
            <Text style={styles.emptyText}>
              Aucun article dans cette catégorie pour l'instant.
            </Text>
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
