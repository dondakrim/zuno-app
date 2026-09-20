import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId, resetIdentity } from '../lib/deviceUser';
import { useMode } from '../context/ModeContext';

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

const SALES_THRESHOLD = 3;
const DISMISS_KEY = 'zuno_merchant_suggestion_dismissed';

function StatusBadge({ status, modeLivraison }) {
  const isDelivered = status === 'livre';
  return (
    <View style={[styles.badge, isDelivered && styles.badgeSuccess]}>
      <Text style={[styles.badgeText, isDelivered && styles.badgeTextSuccess]}>
        {getStatusLabel(status, modeLivraison)}
      </Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { mode, switchMode } = useMode();
  const [tab, setTab] = useState('annonces');
  const [deviceId, setDeviceId] = useState('');
  const [profile, setProfile] = useState({ nom: '', ville: '', photo_url: null });
  const [myListings, setMyListings] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [reviewedOrderIds, setReviewedOrderIds] = useState([]);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    setDeviceId(myId);

    const { data: profileData } = await supabase
      .from('users')
      .select('nom, ville, photo_url')
      .eq('id', myId)
      .maybeSingle();
    if (profileData) setProfile(profileData);

    // Mes annonces, avec la commande et la livraison en cours si l'article
    // a déjà été acheté (pour pouvoir suivre / faire avancer la livraison).
    const { data: listings } = await supabase
      .from('listings')
      .select('*, orders(*, deliveries(*))')
      .eq('vendeur_id', myId)
      .order('created_at', { ascending: false });
    setMyListings(listings || []);

    // Une fois 3 ventes atteintes, on propose une seule fois de passer en
    // mode marchand (sauf si la personne a déjà décliné, ou y est déjà).
    const salesCount = (listings || []).reduce((sum, l) => sum + (l.orders?.length || 0), 0);
    if (salesCount >= SALES_THRESHOLD && mode !== 'marchand') {
      const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
      if (dismissed !== 'true') {
        Alert.alert(
          'Bravo, déjà ' + salesCount + ' ventes !',
          "Tu peux passer en mode marchand pour accéder à un tableau de bord dédié : statistiques, gestion des annonces et des commandes.",
          [
            {
              text: 'Plus tard',
              style: 'cancel',
              onPress: () => AsyncStorage.setItem(DISMISS_KEY, 'true'),
            },
            { text: 'Passer en mode marchand', onPress: () => switchMode('marchand') },
          ]
        );
      }
    }

    // Mes achats, avec leur statut de livraison.
    const { data: orders } = await supabase
      .from('orders')
      .select('*, listings(title, price, vendeur_id), deliveries(*)')
      .eq('acheteur_id', myId)
      .order('created_at', { ascending: false });
    setMyOrders(orders || []);

    const { data: reviews } = await supabase
      .from('reviews')
      .select('order_id')
      .eq('auteur_id', myId);
    setReviewedOrderIds((reviews || []).map((r) => r.order_id));

    setLoading(false);
  }, [mode, switchMode]);

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

  const openReviewModal = (order) => {
    setReviewStars(5);
    setReviewComment('');
    setReviewModal(order);
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    const myId = await getDeviceUserId();

    const { error } = await supabase.from('reviews').insert({
      order_id: reviewModal.id,
      auteur_id: myId,
      cible_id: reviewModal.listings?.vendeur_id,
      note: reviewStars,
      commentaire: reviewComment.trim() || null,
    });

    if (error) {
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }

    setReviewModal(null);
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
            await resetIdentity();
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
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {profile.nom && profile.nom !== 'Toi (test)' ? profile.nom.slice(0, 2).toUpperCase() : 'TU'}
            </Text>
          )}
        </View>
        <Text style={styles.name}>
          {profile.nom && profile.nom !== 'Toi (test)' ? profile.nom : 'Complète ton profil'}
        </Text>
        {profile.ville ? <Text style={styles.villeText}>{profile.ville}</Text> : null}
        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Ionicons name="pencil-outline" size={12} color={colors.white} />
          <Text style={styles.editProfileButtonText}>Modifier mon profil</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleResetIdentity} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Changer d'identité (test messagerie)</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.merchantButton}
        onPress={() => switchMode(mode === 'marchand' ? 'visiteur' : 'marchand')}
      >
        <Ionicons name="storefront-outline" size={20} color={colors.white} />
        <Text style={styles.merchantButtonText}>
          {mode === 'marchand' ? 'Repasser en mode visiteur' : 'Passer en mode marchand'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

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
                      <StatusBadge status={delivery.statut_livraison} modeLivraison={order.mode_livraison} />
                      {NEXT_STATUS[delivery.statut_livraison] && (
                        <TouchableOpacity
                          onPress={() => handleAdvanceDelivery(delivery)}
                          style={styles.advanceButton}
                        >
                          <Text style={styles.advanceButtonText}>
                            Marquer « {getStatusLabel(NEXT_STATUS[delivery.statut_livraison], order.mode_livraison)} »
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
                    <StatusBadge status={delivery.statut_livraison} modeLivraison={item.mode_livraison} />
                    <Text style={styles.deliveryAddress} numberOfLines={1}>
                      {delivery.adresse}
                    </Text>
                  </View>
                )}
                {delivery?.statut_livraison === 'livre' && (
                  reviewedOrderIds.includes(item.id) ? (
                    <Text style={styles.alreadyReviewedText}>Avis envoyé, merci !</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.reviewButton}
                      onPress={() => openReviewModal(item)}
                    >
                      <Ionicons name="star-outline" size={14} color={colors.orange} />
                      <Text style={styles.reviewButtonText}>Laisser un avis</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={!!reviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ton avis sur le vendeur</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {reviewModal?.listings?.title}
            </Text>

            <View style={styles.starsPickerRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity key={i} onPress={() => setReviewStars(i)}>
                  <Ionicons
                    name={i <= reviewStars ? 'star' : 'star-outline'}
                    size={32}
                    color={colors.orange}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              placeholder="Un commentaire (facultatif)"
              placeholderTextColor={colors.textMuted}
              value={reviewComment}
              onChangeText={setReviewComment}
              style={styles.modalInput}
              multiline
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setReviewModal(null)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitButton} onPress={submitReview}>
                <Text style={styles.modalSubmitText}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    overflow: 'hidden',
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  name: { color: colors.white, fontSize: 15, fontWeight: '600' },
  deviceId: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 28 },
  villeText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  editProfileButtonText: { color: colors.white, fontSize: 11, fontWeight: '700' },
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
  merchantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.purple,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  merchantButtonText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.white },
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
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewButtonText: { fontSize: 12, color: colors.orange, fontWeight: '600' },
  alreadyReviewedText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: spacing.md },
  starsPickerRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 13,
    marginBottom: spacing.md,
  },
  modalButtonRow: { flexDirection: 'row', gap: spacing.sm },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.textPrimary, fontWeight: '600' },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modalSubmitText: { color: colors.white, fontWeight: '700' },
});
