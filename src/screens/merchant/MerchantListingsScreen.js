import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
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

  const updateStock = async (item, next) => {
    const value = Math.max(0, Math.min(99999, next));
    const prev = listings;
    setListings((l) => l.map((x) => (x.id === item.id ? { ...x, stock: value } : x)));
    const myId = await getDeviceUserId();
    const { error } = await supabase
      .from('listings')
      .update({ stock: value })
      .eq('id', item.id)
      .eq('vendeur_id', myId);
    if (error) {
      setListings(prev);
      Alert.alert('Oups', "Impossible de modifier le stock pour le moment.");
    }
  };

  const stopTracking = (item) => {
    Alert.alert('Article unique', "Revenir à un article unique (sans compteur de stock) ?", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Oui',
        onPress: async () => {
          const myId = await getDeviceUserId();
          const { error } = await supabase.from('listings').update({ stock: null }).eq('id', item.id).eq('vendeur_id', myId);
          if (error) { Alert.alert('Oups', 'Modification impossible.'); return; }
          setListings((l) => l.map((x) => (x.id === item.id ? { ...x, stock: null } : x)));
        },
      },
    ]);
  };

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
          renderItem={({ item }) => {
            const tracked = typeof item.stock === 'number';
            const out = tracked ? item.stock <= 0 : item.status !== 'disponible';
            const badgeLabel = tracked ? (out ? 'Rupture' : 'En vente') : item.status === 'disponible' ? 'En vente' : 'Vendu';
            return (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardTop}
                  onPress={() => navigation.navigate('ProductDetail', { listing: item })}
                  activeOpacity={0.85}
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
                  <View style={[styles.statusBadge, out && styles.statusBadgeSold]}>
                    <Text style={[styles.statusText, out && styles.statusTextSold]}>{badgeLabel}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.stockRow}>
                  {tracked ? (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stockLabel}>Stock disponible</Text>
                        <TouchableOpacity onPress={() => stopTracking(item)}>
                          <Text style={styles.stockLink}>Article unique ?</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => updateStock(item, item.stock - 1)}
                          disabled={item.stock <= 0}
                        >
                          <Ionicons name="remove" size={18} color={item.stock <= 0 ? colors.textMuted : colors.purple} />
                        </TouchableOpacity>
                        <Text style={[styles.stepValue, item.stock <= 0 && { color: colors.danger }]}>{item.stock}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => updateStock(item, item.stock + 1)}>
                          <Ionicons name="add" size={18} color={colors.purple} />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stockLabel}>Article unique</Text>
                        <Text style={styles.stockHint}>Aucun compteur affiché aux acheteurs</Text>
                      </View>
                      <TouchableOpacity style={styles.addStockBtn} onPress={() => updateStock(item, item.status === 'disponible' ? 1 : 0)}>
                        <Ionicons name="layers-outline" size={15} color={colors.purple} />
                        <Text style={styles.addStockText}>Gérer le stock</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                {tracked && out ? (
                  <Text style={styles.outNote}>Rupture : les clients peuvent activer « Prévenez-moi ». Remets du stock pour les alerter automatiquement.</Text>
                ) : null}
              </View>
            );
          }}
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
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  stockLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  stockHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  stockLink: { fontSize: 11, color: colors.purple, marginTop: 2, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 999, padding: 4 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 40, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  addStockBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tintPurple, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  addStockText: { color: colors.purple, fontWeight: '700', fontSize: 12 },
  outNote: { fontSize: 11, color: colors.danger, marginTop: 8, lineHeight: 16 },
  card: {
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
