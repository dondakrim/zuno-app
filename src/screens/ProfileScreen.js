import React, { useState, useCallback, useMemo } from 'react';
import { usePrefs } from '../lib/prefs';
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
import GradientHeader from '../components/GradientHeader';

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

const SALES_THRESHOLD = 5;
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

// Une ligne du bloc de menu (icône dans une pastille, titre, flèche).
function MenuRow({ icon, label, hint, onPress, last }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, !last && styles.menuRowBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={colors.orange} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {hint ? <Text style={styles.menuHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { formatPrice } = usePrefs();
  const { mode, switchMode } = useMode();
  const [tab, setTab] = useState('annonces');
  const [deviceId, setDeviceId] = useState('');
  const [profile, setProfile] = useState({ nom: '', ville: '', photo_url: null, telephone: '' });
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
      .select('nom, ville, telephone, photo_url, avatar_icon, avatar_color, merchant_status')
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

    // Après SALES_THRESHOLD ventes, on propose une seule fois de demander un
    // compte marchand (sauf si la personne a déjà décliné, ou l'a déjà).
    const salesCount = (listings || []).reduce((sum, l) => sum + (l.orders?.length || 0), 0);
    if (salesCount >= SALES_THRESHOLD && mode !== 'marchand' && profileData?.merchant_status === 'aucun') {
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
            { text: 'Demander un compte marchand', onPress: () => navigation.navigate('BecomeMerchant') },
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

  const salesCount = useMemo(
    () => myListings.reduce((sum, l) => sum + (l.orders?.length || 0), 0),
    [myListings]
  );

  const hasName = profile.nom && profile.nom !== 'Toi (test)';
  const hasFullName = hasName && profile.nom.trim().split(/\s+/).length >= 2;
  const hasPhone = !!profile.telephone && !String(profile.telephone).startsWith('local-');
  const missing = [];
  if (!hasFullName) missing.push('ton prénom et ton nom');
  if (!hasPhone) missing.push('ton numéro de téléphone');
  const profileIncomplete = missing.length > 0;
  const listingsData = tab === 'annonces' ? myListings : myOrders;

  // Carte « marchand » : le texte dépend de l'état du compte.
  const merchantStatus = profile.merchant_status;
  let merchantTitle = 'Devenir marchand';
  let merchantSub = 'Un tableau de bord pour vendre plus';
  let merchantIcon = 'storefront-outline';
  if (mode === 'marchand') {
    merchantTitle = 'Repasser en mode visiteur';
    merchantSub = 'Tu es en mode marchand';
    merchantIcon = 'swap-horizontal-outline';
  } else if (merchantStatus === 'actif') {
    merchantTitle = 'Passer en mode marchand';
    merchantSub = 'Statistiques, annonces et commandes';
  } else if (merchantStatus === 'demande') {
    merchantTitle = 'Demande en cours d’examen';
    merchantSub = 'On te prévient dès que c’est validé';
    merchantIcon = 'time-outline';
  }

  const onMerchantPress = () => {
    if (mode === 'marchand') return switchMode('visiteur');
    if (merchantStatus === 'actif') return switchMode('marchand');
    navigation.navigate('BecomeMerchant');
  };

  const renderHeader = () => (
    <View>
      <GradientHeader style={styles.profileHeader}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            {profile.avatar_icon ? (
              <View style={[styles.avatarIconWrap, { backgroundColor: profile.avatar_color }]}>
                <Ionicons name={profile.avatar_icon} size={36} color={colors.white} />
              </View>
            ) : profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {hasName ? profile.nom.slice(0, 2).toUpperCase() : 'TU'}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.name}>{hasName ? profile.nom : 'Bienvenue sur Zuno'}</Text>
        {profile.ville ? (
          <View style={styles.villeRow}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.villeText}>{profile.ville}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={13} color={colors.white} />
          <Text style={styles.editProfileButtonText}>Modifier mon profil</Text>
        </TouchableOpacity>
        {__DEV__ ? (
          <TouchableOpacity onPress={handleResetIdentity} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Changer d'identité (test)</Text>
          </TouchableOpacity>
        ) : null}
      </GradientHeader>

      {/* Chiffres clés, posés à cheval sur le bandeau */}
      <View style={styles.statsCard}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{myListings.length}</Text>
          <Text style={styles.statLabel}>Annonces</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{salesCount}</Text>
          <Text style={styles.statLabel}>Ventes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{myOrders.length}</Text>
          <Text style={styles.statLabel}>Achats</Text>
        </View>
      </View>

      {profileIncomplete ? (
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.completeCard}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <View style={styles.completeIcon}>
            <Ionicons name="person-circle-outline" size={26} color={colors.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.completeTitle}>Complète ton profil</Text>
            <Text style={styles.completeSub}>Il manque {missing.join(' et ')}. Cela prend 1 minute.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.orange} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity activeOpacity={0.85} onPress={onMerchantPress}>
        <GradientHeader style={styles.merchantCard}>
          <View style={styles.merchantIcon}>
            <Ionicons name={merchantIcon} size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.merchantTitle}>{merchantTitle}</Text>
            <Text style={styles.merchantSub}>{merchantSub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
        </GradientHeader>
      </TouchableOpacity>

      <View style={styles.menuCard}>
        <MenuRow
          icon="receipt-outline"
          label="Mes commandes"
          hint="Suivi de tes achats et ventes"
          onPress={() => navigation.navigate('MyOrders')}
        />
        <MenuRow
          icon="apps-outline"
          label="Compte, aide et informations"
          hint="Paramètres, favoris, service client…"
          onPress={() => navigation.navigate('Account')}
          last
        />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'annonces' && styles.tabButtonActive]}
          onPress={() => setTab('annonces')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'annonces' && styles.tabTextActive]}>
            Mes annonces
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'achats' && styles.tabButtonActive]}
          onPress={() => setTab('achats')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'achats' && styles.tabTextActive]}>
            Mes achats
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />;
    }
    const isAnnonces = tab === 'annonces';
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCircle}>
          <Ionicons
            name={isAnnonces ? 'pricetag-outline' : 'bag-handle-outline'}
            size={30}
            color={colors.orange}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isAnnonces ? "Pas encore d'annonce" : 'Aucun achat pour le moment'}
        </Text>
        <Text style={styles.emptyText}>
          {isAnnonces
            ? 'Publie ton premier article en moins de deux minutes.'
            : 'Découvre les articles près de chez toi.'}
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          activeOpacity={0.85}
          onPress={() =>
            isAnnonces
              ? navigation.navigate('Accueil', { screen: 'PostListing' })
              : navigation.navigate('Boutique')
          }
        >
          <Ionicons
            name={isAnnonces ? 'add-circle-outline' : 'search-outline'}
            size={16}
            color={colors.white}
          />
          <Text style={styles.emptyButtonText}>
            {isAnnonces ? 'Publier une annonce' : 'Parcourir les articles'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    if (tab === 'annonces') {
      const order = item.orders?.[0];
      const delivery = order?.deliveries?.[0];
      const onSale = item.status === 'disponible';
      return (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardRow}
            activeOpacity={0.7}
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
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
            </View>
            <View style={[styles.saleChip, onSale ? styles.saleChipOn : styles.saleChipSold]}>
              <Text style={[styles.saleChipText, onSale ? styles.saleChipTextOn : styles.saleChipTextSold]}>
                {onSale ? 'En vente' : 'Vendu'}
              </Text>
            </View>
          </TouchableOpacity>
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
            <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.listings?.title}
            </Text>
            <Text style={styles.cardPrice}>{Number(item.montant).toLocaleString('fr-FR')} FCFA</Text>
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
        {delivery?.statut_livraison === 'livre' &&
          (reviewedOrderIds.includes(item.id) ? (
            <Text style={styles.alreadyReviewedText}>Avis envoyé, merci !</Text>
          ) : (
            <TouchableOpacity style={styles.reviewButton} onPress={() => openReviewModal(item)}>
              <Ionicons name="star-outline" size={14} color={colors.orange} />
              <Text style={styles.reviewButtonText}>Laisser un avis</Text>
            </TouchableOpacity>
          ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={loading ? [] : listingsData}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
      />

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

const shadow = {
  shadowColor: '#1B0A5C',
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const styles = StyleSheet.create({
  completeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.tintOrange,
    borderWidth: 1,
    borderColor: colors.orange,
  },
  completeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  completeSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  container: { flex: 1, backgroundColor: colors.background },

  // ----- En-tête
  profileHeader: {
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 54,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    padding: 2,
    marginBottom: spacing.sm,
  },
  avatar: {
    flex: 1,
    borderRadius: 44,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 24 },
  avatarImage: { width: '100%', height: '100%' },
  avatarIconWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.white, fontSize: 20, fontWeight: '800' },
  villeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  villeText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    marginTop: spacing.md,
  },
  editProfileButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  resetButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  resetButtonText: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },

  // ----- Chiffres clés
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginHorizontal: spacing.lg,
    marginTop: -32,
    paddingVertical: spacing.md,
    ...shadow,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.purple },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  // ----- Carte marchand
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 18,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  merchantIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantTitle: { fontSize: 15, fontWeight: '800', color: colors.white },
  merchantSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.78)', marginTop: 2 },

  // ----- Bloc de menu
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    overflow: 'hidden',
    ...shadow,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.tintOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  menuHint: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },

  // ----- Onglets
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: colors.orange },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  tabTextActive: { color: colors.white },

  // ----- Cartes d'annonces / d'achats
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  cardPrice: { fontSize: 13, fontWeight: '700', color: colors.orange, marginTop: 3 },
  saleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  saleChipOn: { backgroundColor: colors.successBg },
  saleChipSold: { backgroundColor: colors.border },
  saleChipText: { fontSize: 11, fontWeight: '700' },
  saleChipTextOn: { color: colors.success },
  saleChipTextSold: { color: colors.textSecondary },

  // ----- État vide
  emptyWrap: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.tintOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    marginTop: spacing.md,
  },
  emptyButtonText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  // ----- Livraison
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

  // ----- Fenêtre d'avis
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
