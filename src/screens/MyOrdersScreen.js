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
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

const TABS = [
  { key: 'panier', label: 'Panier', icon: 'cart-outline' },
  { key: 'en_cours', label: 'En cours', icon: 'time-outline' },
  { key: 'expedies', label: 'Expédiés', icon: 'airplane-outline' },
  { key: 'favoris', label: 'Boutiques', icon: 'heart-outline' },
];

const STATUS_LABELS = {
  a_traiter: 'À traiter',
  pris_en_charge: 'Pris en charge',
  en_cours: 'En cours de livraison',
  livre: 'Livré',
};

export default function MyOrdersScreen({ navigation }) {
  const [tab, setTab] = useState('panier');
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);
  const [processingOrders, setProcessingOrders] = useState([]);
  const [shippedOrders, setShippedOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();

    const { data: cart } = await supabase
      .from('cart_items')
      .select('*, listings(*)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });
    setCartItems((cart || []).filter((i) => i.listings));

    const { data: orders } = await supabase
      .from('orders')
      .select('*, listings(title, price, photo_url), deliveries(*)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });

    const all = orders || [];
    setProcessingOrders(
      all.filter((o) => ['a_traiter', 'pris_en_charge'].includes(o.deliveries?.[0]?.statut_livraison))
    );
    setShippedOrders(
      all.filter((o) => ['en_cours', 'livre'].includes(o.deliveries?.[0]?.statut_livraison))
    );

    const { data: favData } = await supabase
      .from('favorite_shops')
      .select('id, vendeur_id, users!favorite_shops_vendeur_id_fkey(nom)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });
    setFavorites(favData || []);

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

  const renderOrderCard = (order) => {
    const delivery = order.deliveries?.[0];
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
            <Text style={styles.cardTitle} numberOfLines={1}>{order.listings?.title}</Text>
            <Text style={styles.cardSubtitle}>
              {Number(order.montant).toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        </View>
        {delivery && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {STATUS_LABELS[delivery.statut_livraison] || delivery.statut_livraison}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes commandes</Text>
        <View style={{ width: 22 }} />
      </View>

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
                      title: item.users?.nom || 'Boutique',
                    })
                  }
                >
                  <View style={styles.cardRow}>
                    <View style={styles.shopAvatar}>
                      <Ionicons name="storefront-outline" size={18} color={colors.white} />
                    </View>
                    <Text style={[styles.cardTitle, { flex: 1 }]}>{item.users?.nom || 'Boutique'}</Text>
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
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  shopAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
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
});
