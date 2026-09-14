import React, { useState, useCallback } from 'react';
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
import { supabase } from '../lib/supabase';

export default function TrendingScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    // En attendant un vrai suivi des vues/favoris, "tendance" correspond
    // ici aux annonces les plus récentes, toutes catégories confondues.
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'disponible')
      .order('created_at', { ascending: false })
      .limit(40);
    if (!error && data) setListings(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrending();
    }, [loadTrending])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tendances</Text>
      </View>

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
            <Text style={styles.emptyText}>Aucun article pour l'instant.</Text>
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
                {Number(item.price).toLocaleString('fr-FR')} FCFA
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
  },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '600' },
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
