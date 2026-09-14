import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

const STATUS_LABELS = {
  a_traiter: 'À traiter',
  pris_en_charge: 'Pris en charge',
  en_cours: 'En cours de livraison',
  livre: 'Livré',
};

const NEXT_STATUS = {
  a_traiter: 'pris_en_charge',
  pris_en_charge: 'en_cours',
  en_cours: 'livre',
  livre: null,
};

function StatusBadge({ status }) {
  const isDelivered = status === 'livre';
  return (
    <View style={[styles.badge, isDelivered && styles.badgeSuccess]}>
      <Text style={[styles.badgeText, isDelivered && styles.badgeTextSuccess]}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const [tab, setTab] = useState('annonces');
  const [deviceId, setDeviceId] = useState('');
  const [myListings, setMyListings] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    setDeviceId(myId);

    // Mes annonces, avec la commande et la livraison en cours si l'article
    // a déjà été acheté (pour pouvoir suivre / faire avancer la livraison).
    const { data: listings } = await supabase
      .from('listings')
      .select('*, orders(*, deliveries(*))')
      .eq('vendeur_id', myId)
      .order('created_at', { ascending: false });
    setMyListings(listings || []);

    // Mes achats, avec leur statut de livraison.
    const { data: orders } = await supabase
      .from('orders')
      .select('*, listings(title, price), deliveries(*)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });
    setMyOrders(orders || []);

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAdvanceDelivery = async (delivery) => {
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
    loadData();
  };

  const handleResetIdentity = () => {
    Alert.alert(
      "Changer d'identité de test",
      'Utile uniquement pour tester la messagerie et les commandes seul, sans deuxième téléphone : tu vas devenir un tout nouvel utilisateur de test sur cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Changer',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('zuno_device_user_id');
            await loadData();
            Alert.alert('Fait', 'Tu es maintenant un nouvel utilisateur de test.');
          },
        },
      ]
    );
  };

  const listingsData = tab === 'annonces' ? myListings : myOrders;

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>TU</Text>
        </View>
        <Text style={styles.name}>Toi (test)</Text>
        <Text style={styles.deviceId}>Identité de test : ...{deviceId.slice(-6)}</Text>
        <TouchableOpacity onPress={handleResetIdentity} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Changer d'identité (test messagerie)</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.ordersButton}
        onPress={() => navigation.navigate('MyOrders')}
      >
        <Ionicons name="receipt-outline" size={20} color={colors.orange} />
        <Text style={styles.ordersButtonText}>Mes commandes</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'annonces' && styles.tabButtonActive]}
          onPress={() => setTab('annonces')}
        >
          <Text style={[styles.tabText, tab === 'annonces' && styles.tabTextActive]}>
            Mes annonces
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'achats' && styles.tabButtonActive]}
          onPress={() => setTab('achats')}
        >
          <Text style={[styles.tabText, tab === 'achats' && styles.tabTextActive]}>
            Mes achats
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={listingsData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'annonces'
                ? "Tu n'as pas encore publié d'annonce."
                : "Tu n'as encore rien acheté."}
            </Text>
          }
          renderItem={({ item }) => {
            if (tab === 'annonces') {
              const order = item.orders?.[0];
              const delivery = order?.deliveries?.[0];
              return (
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.thumb}>
                      <Ionicons name="image-outline" size={18} color={colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text style={styles.cardSubtitle}>
                        {item.status === 'disponible' ? 'En vente' : 'Vendu'} ·{' '}
                        {Number(item.price).toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                  </View>
                  {delivery && (
                    <View style={styles.deliveryRow}>
                      <StatusBadge status={delivery.statut_livraison} />
                      {NEXT_STATUS[delivery.statut_livraison] && (
                        <TouchableOpacity
                          onPress={() => handleAdvanceDelivery(delivery)}
                          style={styles.advanceButton}
                        >
                          <Text style={styles.advanceButtonText}>
                            Marquer « {STATUS_LABELS[NEXT_STATUS[delivery.statut_livraison]]} »
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            }

            const delivery = item.deliveries?.[0];
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.thumb}>
                    <Ionicons name="cube-outline" size={18} color={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.listings?.title}</Text>
                    <Text style={styles.cardSubtitle}>
                      {Number(item.montant).toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                </View>
                {delivery && (
                  <View style={styles.deliveryRow}>
                    <StatusBadge status={delivery.statut_livraison} />
                    <Text style={styles.deliveryAddress} numberOfLines={1}>
                      {delivery.adresse}
                    </Text>
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
  profileHeader: {
    backgroundColor: colors.purple,
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  name: { color: colors.white, fontSize: 15, fontWeight: '600' },
  deviceId: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  resetButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  resetButtonText: { color: colors.white, fontSize: 11 },
  ordersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  ordersButtonText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  tabRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  tabTextActive: { color: colors.white },
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
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
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
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  badgeSuccess: { backgroundColor: colors.successBg },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  badgeTextSuccess: { color: colors.success },
  advanceButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.orange,
  },
  advanceButtonText: { fontSize: 11, color: colors.white, fontWeight: '600' },
  deliveryAddress: { fontSize: 11, color: colors.textMuted, flex: 1, textAlign: 'right' },
});
