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
import { colors, spacing, radius } from '../theme/colors';
import GradientHeader from '../components/GradientHeader';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

const TABS = [
  { key: 'panier', label: 'Panier', icon: 'cart-outline' },
  { key: 'envies', label: 'Envies', icon: 'bookmark-outline' },
  { key: 'en_cours', label: 'En cours', icon: 'time-outline' },
  { key: 'expedies', label: 'Expédiés', icon: 'airplane-outline' },
  { key: 'favoris', label: 'Boutiques', icon: 'heart-outline' },
];

const STATUS_LABELS = {
  a_traiter: 'À traiter',
  pris_en_charge: 'Pris en charge',
  en_cours: 'En cours de livraison',
  livre: 'Livré',
  annulee: 'Annulée',
};

const DISPUTE_CATEGORIES = [
  { key: 'non_recu', label: "Je n'ai pas reçu l'article" },
  { key: 'non_conforme_description', label: "L'article ne correspond pas à l'annonce" },
  { key: 'vendeur_injoignable', label: 'Le vendeur ne répond plus' },
  { key: 'autre', label: 'Autre problème' },
];

function getStatusLabel(status, modeLivraison) {
  if (modeLivraison === 'pickup') {
    if (status === 'en_cours') return 'Prêt pour le retrait';
    if (status === 'livre') return 'Récupéré';
  }
  return STATUS_LABELS[status] || status;
}

const STEP_INDEX = { a_traiter: 0, pris_en_charge: 1, en_cours: 2, livre: 3 };

const NEXT_HINT = {
  a_traiter: "Ta commande est enregistrée. Le vendeur va la confirmer très bientôt.",
  pris_en_charge: "Le vendeur prépare ton article.",
  en_cours: "Ton colis est en route. Tu seras prévenu(e) à l'arrivée.",
  en_cours_pickup: 'Ton article est prêt : va le récupérer chez le vendeur.',
  livre: 'Commande terminée. Pense à laisser un avis au vendeur.',
  livre_pickup: 'Article récupéré. Pense à laisser un avis au vendeur.',
  annulee: 'Cette commande a été annulée.',
};

function OrderTracker({ status, pickup }) {
  if (status === 'annulee') {
    return (
      <View style={trackStyles.cancelled}>
        <Ionicons name="close-circle" size={18} color={colors.danger} />
        <Text style={trackStyles.cancelledText}>{NEXT_HINT.annulee}</Text>
      </View>
    );
  }
  const idx = STEP_INDEX[status] ?? 0;
  const steps = [
    { label: 'Commande\npassée', icon: 'receipt' },
    { label: 'Préparation', icon: 'cube' },
    { label: pickup ? 'Prêt au\nretrait' : 'En\nlivraison', icon: pickup ? 'storefront' : 'car' },
    { label: pickup ? 'Récupéré' : 'Livré', icon: 'checkmark-done' },
  ];
  const hint = NEXT_HINT[(status === 'en_cours' || status === 'livre') && pickup ? status + '_pickup' : status] || '';
  return (
    <View style={trackStyles.wrap}>
      <View style={trackStyles.row}>
        {steps.map((st, i) => {
          const done = i < idx || (idx === 3 && i === 3);
          const current = i === idx && idx < 3;
          return (
            <View key={st.label} style={trackStyles.stepCol}>
              {i > 0 ? <View style={[trackStyles.line, i <= idx && trackStyles.lineDone]} /> : null}
              <View
                style={[
                  trackStyles.circle,
                  done && trackStyles.circleDone,
                  current && trackStyles.circleCurrent,
                ]}
              >
                <Ionicons
                  name={done ? 'checkmark' : st.icon}
                  size={done ? 15 : 14}
                  color={done || current ? colors.white : colors.textMuted}
                />
              </View>
              <Text style={[trackStyles.label, i <= idx && trackStyles.labelActive]}>{st.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={trackStyles.hintBox}>
        <Ionicons name="information-circle-outline" size={15} color={colors.orange} />
        <Text style={trackStyles.hintText}>{hint}</Text>
      </View>
    </View>
  );
}

const trackStyles = StyleSheet.create({
  wrap: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row' },
  stepCol: { flex: 1, alignItems: 'center' },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circleDone: { backgroundColor: colors.success, borderColor: colors.success },
  circleCurrent: { backgroundColor: colors.orange, borderColor: colors.orange },
  line: { position: 'absolute', top: 13, left: '-50%', right: '50%', height: 3, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.success },
  label: { marginTop: 6, textAlign: 'center', fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  labelActive: { color: colors.textPrimary },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.tintOrange,
  },
  hintText: { flex: 1, fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
  cancelled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.tintRed,
  },
  cancelledText: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' },
});

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function MyOrdersScreen({ navigation }) {
  const [tab, setTab] = useState('panier');
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);
  const [processingOrders, setProcessingOrders] = useState([]);
  const [shippedOrders, setShippedOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [disputedOrderIds, setDisputedOrderIds] = useState(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();

    const { data: cart } = await supabase
      .from('cart_items')
      .select('*, listings(*)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });
    setCartItems((cart || []).filter((i) => i.listings));

    const { data: wish } = await supabase
      .from('wishlist_items')
      .select('id, listing_id, listings(*)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });
    setWishlist((wish || []).filter((i) => i.listings));

    const { data: orders } = await supabase
      .from('orders')
      .select('*, listings(title, price, photo_url, vendeur_id), deliveries(*)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });

    const all = orders || [];
    setProcessingOrders(
      all.filter((o) =>
        ['a_traiter', 'pris_en_charge', 'annulee'].includes(o.deliveries?.[0]?.statut_livraison)
      )
    );
    setShippedOrders(
      all.filter((o) => ['en_cours', 'livre'].includes(o.deliveries?.[0]?.statut_livraison))
    );

    const { data: disputes } = await supabase
      .from('order_disputes')
      .select('order_id, status')
      .eq('opened_by', myId);
    setDisputedOrderIds(new Set((disputes || []).map((d) => d.order_id)));

    const { data: favData } = await supabase
      .from('favorite_shops')
      .select('id, vendeur_id')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });

    const vendeurIds = [...new Set((favData || []).map((f) => f.vendeur_id).filter(Boolean))];
    let profilesById = {};
    if (vendeurIds.length > 0) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, nom, boutique_nom')
        .in('id', vendeurIds);
      (profiles || []).forEach((p) => {
        profilesById[p.id] = p;
      });
    }
    setFavorites((favData || []).map((f) => ({ ...f, users: profilesById[f.vendeur_id] || null })));

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleRemoveFromCart = async (id) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', id);
    if (error) {
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }
    loadAll();
  };

  const handleRemoveFavorite = async (id) => {
    await supabase.from('favorite_shops').delete().eq('id', id);
    loadAll();
  };

  const handleRemoveWishlist = async (id) => {
    await supabase.from('wishlist_items').delete().eq('id', id);
    loadAll();
  };

  const handleCancelOrder = (order) => {
    Alert.alert(
      'Annuler cette commande ?',
      "Le vendeur n'a pas encore commencé à la traiter, tu peux encore l'annuler sans frais.",
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Annuler la commande',
          style: 'destructive',
          onPress: async () => {
            const delivery = order.deliveries?.[0];
            await supabase.from('orders').update({ statut: 'annulee' }).eq('id', order.id);
            if (delivery) {
              await supabase
                .from('deliveries')
                .update({ statut_livraison: 'annulee' })
                .eq('id', delivery.id);
            }
            if (order.listing_id) {
              await supabase
                .from('listings')
                .update({ status: 'disponible' })
                .eq('id', order.listing_id);
            }
            loadAll();
          },
        },
      ]
    );
  };

  const handleReportProblem = (order) => {
    Alert.alert(
      'Quel est le problème ?',
      'Choisis la raison qui correspond le mieux — le vendeur et notre équipe seront prévenus.',
      [
        ...DISPUTE_CATEGORIES.map((cat) => ({
          text: cat.label,
          onPress: async () => {
            const myId = await getDeviceUserId();
            const { error } = await supabase.from('order_disputes').insert({
              order_id: order.id,
              opened_by: myId,
              category: cat.key,
            });
            if (error) {
              Alert.alert('Erreur', `Détail technique : ${error.message}`);
              return;
            }
            loadAll();
            Alert.alert(
              'Signalement envoyé',
              'Préviens aussi directement le vendeur via la messagerie pour accélérer la résolution.',
              [
                {
                  text: 'Contacter le vendeur',
                  onPress: () => {
                    if (order.listings?.vendeur_id) {
                      navigation.navigate('Chat', {
                        listingId: order.listing_id,
                        listingTitle: order.listings?.title,
                        otherUserId: order.listings.vendeur_id,
                      });
                    }
                  },
                },
                { text: 'Plus tard', style: 'cancel' },
              ]
            );
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const renderOrderCard = (order) => {
    const delivery = order.deliveries?.[0];
    const isDisputed = disputedOrderIds.has(order.id);
    const canCancel = delivery?.statut_livraison === 'a_traiter';
    const canReport =
      !canCancel && delivery?.statut_livraison !== 'annulee' && !isDisputed;
    const showActions = canCancel || canReport || (order.listings?.vendeur_id && delivery?.statut_livraison !== 'annulee');

    return (
      <View key={order.id} style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.thumb}>
            {order.listings?.photo_url ? (
              <Image source={{ uri: order.listings.photo_url }} style={styles.thumbImage} />
            ) : (
              <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderRef}>ZN-CMD-{String(order.reference_number).padStart(6, '0')}</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>{order.listings?.title}</Text>
            <Text style={styles.cardSubtitle}>
              {Number(order.montant).toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        </View>

        <Text style={styles.dateText}>Commandé le {formatDate(order.created_at)}</Text>

        <OrderTracker status={delivery?.statut_livraison || 'a_traiter'} pickup={order.mode_livraison === 'pickup'} />

        {isDisputed && (
          <View style={[styles.badgeRow, { marginTop: spacing.md }]}>
            <View style={styles.disputeBadge}>
              <Ionicons name="alert-circle" size={12} color={colors.white} />
              <Text style={styles.disputeBadgeText}>Litige en cours</Text>
            </View>
          </View>
        )}

        {showActions && (
          <View style={styles.actionRow}>
            {canCancel && (
              <TouchableOpacity onPress={() => handleCancelOrder(order)} style={styles.actionButton}>
                <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                <Text style={styles.actionButtonText}>Annuler la commande</Text>
              </TouchableOpacity>
            )}
            {order.listings?.vendeur_id && delivery?.statut_livraison !== 'annulee' && (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Chat', {
                    listingId: order.listing_id,
                    listingTitle: order.listings?.title,
                    otherUserId: order.listings.vendeur_id,
                  })
                }
                style={styles.actionButton}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.purple} />
                <Text style={styles.actionButtonTextPurple}>Contacter le vendeur</Text>
              </TouchableOpacity>
            )}
            {canReport && (
              <TouchableOpacity onPress={() => handleReportProblem(order)} style={styles.actionButton}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.actionButtonTextMuted}>Signaler un problème</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const counts = {
    panier: cartItems.length,
    envies: wishlist.length,
    en_cours: processingOrders.length,
    expedies: shippedOrders.length,
    favoris: favorites.length,
  };

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes commandes</Text>
        <View style={{ width: 22 }} />
      </GradientHeader>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabButton, active && styles.tabButtonActive]}
              onPress={() => setTab(t.key)}
            >
              <Ionicons name={t.icon} size={16} color={active ? colors.white : colors.textPrimary} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                {t.label}
              </Text>
              {counts[t.key] > 0 ? (
                <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>{counts[t.key]}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <View style={{ flex: 1, padding: spacing.lg }}>
          {tab === 'panier' && (
            <FlatList
              data={cartItems}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Ton panier est vide.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => navigation.navigate('ProductDetail', { listing: item.listings })}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.thumb}>
                      {item.listings.photo_url ? (
                        <Image source={{ uri: item.listings.photo_url }} style={styles.thumbImage} />
                      ) : (
                        <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.listings.title}</Text>
                      <Text style={styles.cardSubtitle}>
                        Qté {item.quantity} ·{' '}
                        {(item.listings.price * item.quantity).toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveFromCart(item.id)} style={{ padding: spacing.xs }}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          {tab === 'en_cours' && (
            <FlatList
              data={processingOrders}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune commande en cours de traitement.</Text>}
              renderItem={({ item }) => renderOrderCard(item)}
            />
          )}

          {tab === 'envies' && (
            <FlatList
              data={wishlist}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Aucun article mis de côté. Appuie sur l'icône marque-page sur une fiche produit
                  pour l'ajouter ici.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => navigation.navigate('ProductDetail', { listing: item.listings })}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.thumb}>
                      {item.listings.photo_url ? (
                        <Image source={{ uri: item.listings.photo_url }} style={styles.thumbImage} />
                      ) : (
                        <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.listings.title}</Text>
                      <Text style={styles.cardSubtitle}>
                        {Number(item.listings.price).toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveWishlist(item.id)} style={{ padding: spacing.xs }}>
                      <Ionicons name="bookmark" size={18} color={colors.orange} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          {tab === 'expedies' && (
            <FlatList
              data={shippedOrders}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune commande expédiée pour l'instant.</Text>}
              renderItem={({ item }) => renderOrderCard(item)}
            />
          )}

          {tab === 'favoris' && (
            <FlatList
              data={favorites}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Aucune boutique favorite. Appuie sur le cœur à côté d'un vendeur pour l'ajouter.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate('CategoryListing', {
                      vendeurId: item.vendeur_id,
                      title: item.users?.boutique_nom || item.users?.nom || 'Boutique',
                    })
                  }
                >
                  <View style={styles.cardRow}>
                    <View style={styles.shopAvatar}>
                      <Ionicons name="storefront-outline" size={18} color={colors.white} />
                    </View>
                    <Text style={[styles.cardTitle, { flex: 1 }]}>{item.users?.boutique_nom || item.users?.nom || 'Boutique'}</Text>
                    <TouchableOpacity onPress={() => handleRemoveFavorite(item.id)} style={{ padding: spacing.xs }}>
                      <Ionicons name="heart" size={18} color={colors.orange} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
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
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabLabel: { fontSize: 10, color: colors.textPrimary, fontWeight: '600' },
  tabLabelActive: { color: colors.white },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  shopAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  orderRef: { fontSize: 10, fontWeight: '700', color: colors.purple, marginBottom: 2 },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  statusBadgeCancelled: { backgroundColor: colors.tintRed },
  statusBadgeTextCancelled: { color: colors.danger },
  disputeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  disputeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionButtonText: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  dateText: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  actionButtonTextPurple: { fontSize: 12, color: colors.purple, fontWeight: '600' },
  countBadge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: { backgroundColor: colors.white },
  countText: { fontSize: 9, fontWeight: '800', color: colors.white },
  countTextActive: { color: colors.orange },
  actionButtonTextMuted: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
});
