import React, { useState, useCallback, useMemo } from 'react';
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
import GradientHeader from '../../components/GradientHeader';
import OrderTracker from '../../components/OrderTracker';

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
  non_recu: 'Article non reçu',
  non_conforme_description: 'Article non conforme',
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

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MerchantOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('tous');
  const [disputesByOrder, setDisputesByOrder] = useState({});
  const [advancing, setAdvancing] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    const { data } = await supabase
      .from('orders')
      .select('*, listings!inner(vendeur_id, title, photo_url, vendeur_id), deliveries(*)')
      .eq('listings.vendeur_id', myId)
      .order('created_at', { ascending: false });

    const acheteurIds = [...new Set((data || []).map((o) => o.acheteur_id).filter(Boolean))];
    let acheteurById = {};
    if (acheteurIds.length > 0) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, nom')
        .in('id', acheteurIds);
      (profiles || []).forEach((p) => {
        acheteurById[p.id] = p;
      });
    }
    setOrders((data || []).map((o) => ({ ...o, acheteur: acheteurById[o.acheteur_id] || null })));

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

  const doAdvance = async (delivery, next) => {
    setAdvancing(delivery.id);
    const { error } = await supabase
      .from('deliveries')
      .update({ statut_livraison: next })
      .eq('id', delivery.id);
    setAdvancing(null);
    if (error) {
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }
    loadOrders();
  };

  // Demande une confirmation : le changement prévient l'acheteur
  const handleAdvance = (delivery, order) => {
    const next = NEXT_STATUS[delivery.statut_livraison];
    if (!next) return;
    const label = getStatusLabel(next, order.mode_livraison);
    Alert.alert(
      `Marquer « ${label} » ?`,
      "L'acheteur sera prévenu automatiquement.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => doAdvance(delivery, next) },
      ]
    );
  };

  const statusOf = (o) => o.deliveries?.[0]?.statut_livraison;
  const counts = useMemo(() => {
    const c = { tous: orders.length };
    FILTERS.forEach((f) => {
      if (f.key !== 'tous') c[f.key] = orders.filter((o) => statusOf(o) === f.key).length;
    });
    return c;
  }, [orders]);

  const filtered = filter === 'tous' ? orders : orders.filter((o) => statusOf(o) === filter);
  const toProcess = counts.a_traiter || 0;

  const renderOrder = ({ item }) => {
    const delivery = item.deliveries?.[0];
    const dispute = disputesByOrder[item.id];
    const status = delivery?.statut_livraison || 'a_traiter';
    const next = delivery ? NEXT_STATUS[delivery.statut_livraison] : null;
    const isNew = status === 'a_traiter';

    return (
      <View style={[styles.card, isNew && styles.cardNew]}>
        {isNew ? (
          <View style={styles.newTag}>
            <Ionicons name="flash" size={11} color={colors.white} />
            <Text style={styles.newTagText}>Nouvelle commande</Text>
          </View>
        ) : null}

        <View style={styles.cardRow}>
          <View style={styles.thumb}>
            {item.listings?.photo_url ? (
              <Image source={{ uri: item.listings.photo_url }} style={styles.thumbImage} />
            ) : (
              <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ref}>ZN-CMD-{String(item.reference_number || '').padStart(6, '0')}</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.listings?.title}</Text>
            <Text style={styles.amount}>
              {Number(item.montant).toLocaleString('fr-FR')} FCFA
              <Text style={styles.qty}>  ·  Qté {item.quantite || 1}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.metaBox}>
          <View style={styles.metaLine}>
            <Ionicons name="person-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {item.acheteur?.nom || delivery?.nom_contact || 'Acheteur'}
            </Text>
          </View>
          {delivery?.telephone_contact ? (
            <View style={styles.metaLine}>
              <Ionicons name="call-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>
                {delivery.nom_contact ? `${delivery.nom_contact} · ` : ''}
                {delivery.telephone_contact}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaLine}>
            <Ionicons name={item.mode_livraison === 'pickup' ? 'storefront-outline' : 'car-outline'} size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {item.mode_livraison === 'pickup' ? 'Retrait chez toi' : 'Livraison'} · {formatDate(item.created_at)}
            </Text>
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

        {delivery ? (
          <OrderTracker status={status} pickup={item.mode_livraison === 'pickup'} role="seller" />
        ) : null}

        {delivery ? (
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Chat', {
                  listingId: item.listing_id,
                  listingTitle: item.listings?.title,
                  otherUserId: item.acheteur_id,
                })
              }
              style={[styles.chatButton, dispute && styles.chatButtonDanger]}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={dispute ? colors.danger : colors.purple} />
              <Text style={[styles.chatButtonText, dispute && { color: colors.danger }]}>
                Contacter l'acheteur
              </Text>
            </TouchableOpacity>

            {next ? (
              <TouchableOpacity
                onPress={() => handleAdvance(delivery, item)}
                style={styles.advanceButton}
                disabled={advancing === delivery.id}
                activeOpacity={0.85}
              >
                {advancing === delivery.id ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="arrow-forward-circle" size={16} color={colors.white} />
                    <Text style={styles.advanceButtonText} numberOfLines={1}>
                      {getStatusLabel(next, item.mode_livraison)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <Text style={styles.headerTitle}>Commandes reçues</Text>
        <Text style={styles.headerSub}>
          {toProcess > 0
            ? `${toProcess} commande${toProcess > 1 ? 's' : ''} à traiter`
            : 'Tout est à jour 👌'}
        </Text>
      </GradientHeader>

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
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
              {counts[item.key] > 0 ? (
                <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>{counts[item.key]}</Text>
                </View>
              ) : null}
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
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={30} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Aucune commande ici</Text>
              <Text style={styles.emptyText}>
                Quand un acheteur commandera un de tes articles, il apparaîtra ici.
              </Text>
            </View>
          }
          renderItem={renderOrder}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 3 },

  filterRow: { flexGrow: 0, marginTop: spacing.md },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12.5, color: colors.textPrimary, fontWeight: '600' },
  filterChipTextActive: { color: colors.white },
  countBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.tintOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: { backgroundColor: colors.white },
  countText: { fontSize: 10, fontWeight: '800', color: colors.orange },
  countTextActive: { color: colors.orange },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardNew: { borderColor: colors.orange },
  newTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.orange,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  newTagText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  cardRow: { flexDirection: 'row', gap: spacing.md },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  ref: { fontSize: 10, fontWeight: '700', color: colors.purple, marginBottom: 2 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  amount: { fontSize: 14, fontWeight: '800', color: colors.orange, marginTop: 3 },
  qty: { fontSize: 12, fontWeight: '500', color: colors.textMuted },

  metaBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    gap: 5,
  },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, fontSize: 12, color: colors.textSecondary },

  disputeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  disputeBannerTitle: { fontSize: 12, fontWeight: '700', color: colors.white },
  disputeBannerText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  chatButtonDanger: { borderColor: colors.danger },
  chatButtonText: { fontSize: 12.5, fontWeight: '700', color: colors.purple },
  advanceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.orange,
  },
  advanceButtonText: { fontSize: 12.5, color: colors.white, fontWeight: '800', flexShrink: 1 },

  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.xl },
});
