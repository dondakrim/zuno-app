import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { getDeviceUserId } from '../../lib/deviceUser';

const STATUS_LABELS = {
  a_traiter: 'À traiter',
  pris_en_charge: 'Pris en charge',
  en_cours: 'En cours de livraison',
  livre: 'Livré',
  annulee: 'Annulée',
};

const NEXT_STATUS = {
  a_traiter: 'pris_en_charge',
  pris_en_charge: 'en_cours',
  en_cours: 'livre',
  livre: null,
  annulee: null,
};

function getStatusLabel(status, modeLivraison) {
  if (modeLivraison === 'pickup') {
    if (status === 'en_cours') return 'Prêt pour le retrait';
    if (status === 'livre') return 'Récupéré';
  }
  return STATUS_LABELS[status] || status;
}

const DISPUTE_LABELS = {
  non_recu: "Article non reçu",
  non_conforme_description: "Article non conforme",
  vendeur_injoignable: 'Vendeur injoignable',
  autre: 'Autre problème',
};

const FILTERS = [
  { key: 'tous', label: 'Toutes' },
  { key: 'a_traiter', label: 'À traiter' },
  { key: 'pris_en_charge', label: 'Pris en charge' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'livre', label: 'Livrées' },
];

export default function MerchantOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('tous');
  const [disputesByOrder, setDisputesByOrder] = useState({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    const { data } = await supabase
      .from('orders')
      .select('*, listings!inner(vendeur_id, title, photo_url, vendeur_id), deliveries(*), acheteur:users!orders_acheteur_id_fkey(nom)')
      .eq('listings.vendeur_id', myId)
      .order('created_at', { ascending: false });
    setOrders(data || []);

    const orderIds = (data || []).map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: disputes } = await supabase
        .from('order_disputes')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });
      const map = {};
      (disputes || []).forEach((d) => {
        if (!map[d.order_id]) map[d.order_id] = d;
      });
      setDisputesByOrder(map);
    } else {
      setDisputesByOrder({});
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const handleAdvance = async (delivery) => {
    const next = NEXT_STATUS[delivery.statut_livraison];
    if (!next) return;
    const { error } = await supabase
      .from('deliveries')
      .update({ statut_livraison: next })
      .eq('id', delivery.id);
    if (error) {
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }
    loadOrders();
  };

  const filtered =
    filter === 'tous'
      ? orders
      : orders.filter((o) => o.deliveries?.[0]?.statut_livraison === filter);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commandes reçues</Text>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f.key}
        style={styles.filterRow}
        contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => {
          const active = item.key === filter;
          return (
            <TouchableOpacity
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucune commande dans cette catégorie.</Text>
          }
          renderItem={({ item }) => {
            const delivery = item.deliveries?.[0];
            const dispute = disputesByOrder[item.id];
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.thumb}>
                    {item.listings?.photo_url ? (
                      <Image source={{ uri: item.listings.photo_url }} style={styles.thumbImage} />
                    ) : (
                      <Ionicons name="cube-outline" size={18} color={colors.textMuted} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.listings?.title}</Text>
                    <Text style={styles.cardSubtitle}>
                      {Number(item.montant).toLocaleString('fr-FR')} FCFA · Qté {item.quantite || 1}
                    </Text>
                    {delivery?.nom_contact && (
                      <Text style={styles.contactText}>
                        {delivery.nom_contact} · {delivery.telephone_contact}
                      </Text>
                    )}
                  </View>
                </View>

                {dispute && (
                  <View style={styles.disputeBanner}>
                    <Ionicons name="alert-circle" size={16} color={colors.white} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.disputeBannerTitle}>
                        Litige signalé par {item.acheteur?.nom || "l'acheteur"}
                      </Text>
                      <Text style={styles.disputeBannerText}>
                        {DISPUTE_LABELS[dispute.category] || dispute.category} ·{' '}
                        {dispute.status === 'ouvert' ? 'En attente de traitement' : dispute.status}
                      </Text>
                    </View>
                  </View>
                )}

                {delivery && (
                  <View style={styles.deliveryRow}>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>
                        {getStatusLabel(delivery.statut_livraison, item.mode_livraison)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {dispute && (
                        <TouchableOpacity
                          onPress={() =>
                            navigation.navigate('Chat', {
                              listingId: item.listing_id,
                              listingTitle: item.listings?.title,
                              otherUserId: item.acheteur_id,
                            })
                          }
                          style={styles.contactBuyerButton}
                        >
                          <Text style={styles.contactBuyerButtonText}>Contacter l'acheteur</Text>
                        </TouchableOpacity>
                      )}
                      {NEXT_STATUS[delivery.statut_livraison] && (
                        <TouchableOpacity
                          onPress={() => handleAdvance(delivery)}
                          style={styles.advanceButton}
                        >
                          <Text style={styles.advanceButtonText}>
                            Marquer « {getStatusLabel(NEXT_STATUS[delivery.statut_livraison], item.mode_livraison)} »
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
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
  },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '700' },
  filterRow: { flexGrow: 0, marginTop: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12, color: colors.textPrimary },
  filterChipTextActive: { color: colors.white, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardRow: { flexDirection: 'row', gap: spacing.sm },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  contactText: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  advanceButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.orange,
  },
  advanceButtonText: { fontSize: 11, color: colors.white, fontWeight: '600' },
  disputeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  disputeBannerTitle: { fontSize: 12, fontWeight: '700', color: colors.white },
  disputeBannerText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  contactBuyerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  contactBuyerButtonText: { fontSize: 11, color: colors.danger, fontWeight: '600' },
});
