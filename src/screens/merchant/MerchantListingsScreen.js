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
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { getDeviceUserId } from '../../lib/deviceUser';

export default function MerchantListingsScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadListings = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('vendeur_id', myId)
      .order('created_at', { ascending: false });
    setListings(data || []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes annonces</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PostListing')}>
          <Ionicons name="add-circle" size={26} color={colors.orange} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Tu n'as pas encore publié d'annonce. Appuie sur le + en haut pour commencer.
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
                  <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>
                  {Number(item.price).toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
              <View style={[styles.statusBadge, item.status !== 'disponible' && styles.statusBadgeSold]}>
                <Text style={[styles.statusText, item.status !== 'disponible' && styles.statusTextSold]}>
                  {item.status === 'disponible' ? 'En vente' : 'Vendu'}
                </Text>
              </View>
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
  },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
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
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.orange, fontWeight: '700', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
  },
  statusBadgeSold: { backgroundColor: colors.background },
  statusText: { fontSize: 11, fontWeight: '600', color: colors.success },
  statusTextSold: { color: colors.textMuted },
});
