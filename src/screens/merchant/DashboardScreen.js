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
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { getDeviceUserId } from '../../lib/deviceUser';
import { useMode } from '../../context/ModeContext';
import { getSellerRating, countCompletedSales, TRUST_BADGE_THRESHOLD } from '../../lib/reputation';
import { COUNTRIES } from '../../data/countries';

const PAYOUT_FEE_RATE = 0.02; // 2% prélevés par Zuno sur chaque reversement

function StarRating({ average, count }) {
  if (!count) {
    return <Text style={styles.noRatingText}>Pas encore d'avis</Text>;
  }
  const rounded = Math.round(average);
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rounded ? 'star' : 'star-outline'}
          size={15}
          color={colors.orange}
        />
      ))}
      <Text style={styles.ratingText}>
        {average.toFixed(1)} ({count})
      </Text>
    </View>
  );
}

export default function MerchantDashboardScreen({ navigation }) {
  const { switchMode } = useMode();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [boostByListing, setBoostByListing] = useState({});
  const [stats, setStats] = useState({ actives: 0, enAttente: 0, chiffreAffaires: 0, favoris: 0 });
  const [solde, setSolde] = useState(0);
  const [dejaDemande, setDejaDemande] = useState(0);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutChannels, setPayoutChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [myTelephone, setMyTelephone] = useState('');
  const [recentOrders, setRecentOrders] = useState([]);
  const [rating, setRating] = useState({ average: null, count: 0 });
  const [completedSales, setCompletedSales] = useState(0);
  const [identityStatus, setIdentityStatus] = useState('non_soumise');
  const [boutiqueNom, setBoutiqueNom] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();

    const { data: myListings } = await supabase
      .from('listings')
      .select('*, orders(*, deliveries(*))')
      .eq('vendeur_id', myId)
      .order('created_at', { ascending: false });

    const listingIds = (myListings || []).map((l) => l.id);
    if (listingIds.length > 0) {
      const { data: boosts } = await supabase
        .from('boost_requests')
        .select('*')
        .in('listing_id', listingIds)
        .eq('status', 'en_attente');
      const map = {};
      (boosts || []).forEach((b) => {
        map[b.listing_id] = b;
      });
      setBoostByListing(map);
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('*, listings!inner(vendeur_id, title, photo_url), deliveries(*)')
      .eq('listings.vendeur_id', myId)
      .order('created_at', { ascending: false });

    const { count: favCount } = await supabase
      .from('favorite_shops')
      .select('id', { count: 'exact', head: true })
      .eq('vendeur_id', myId);

    const [ratingResult, completedResult] = await Promise.all([
      getSellerRating(myId),
      countCompletedSales(myId),
    ]);

    const { data: userRow } = await supabase
      .from('users')
      .select('identity_status, boutique_nom, telephone')
      .eq('id', myId)
      .maybeSingle();
    setIdentityStatus(userRow?.identity_status || 'non_soumise');
    setBoutiqueNom(userRow?.boutique_nom || '');
    setMyTelephone(userRow?.telephone?.startsWith('local-') ? '' : userRow?.telephone || '');
    setPayoutPhone(userRow?.telephone?.startsWith('local-') ? '' : userRow?.telephone || '');

    const { data: payoutsExistants } = await supabase
      .from('payout_requests')
      .select('amount_requested')
      .eq('vendeur_id', myId)
      .neq('status', 'refuse');
    const totalDejaDemande = (payoutsExistants || []).reduce((sum, p) => sum + Number(p.amount_requested || 0), 0);
    setDejaDemande(totalDejaDemande);

    const allOrders = (orders || []).filter((o) => o.deliveries?.[0]?.statut_livraison !== 'annulee');
    const enAttente = allOrders.filter(
      (o) => o.deliveries?.[0]?.statut_livraison && o.deliveries[0].statut_livraison !== 'livre'
    ).length;
    const chiffreAffaires = allOrders.reduce((sum, o) => sum + Number(o.montant || 0), 0);
    const soldeDisponible = allOrders
      .filter((o) => o.deliveries?.[0]?.statut_livraison === 'livre')
      .reduce((sum, o) => sum + Number(o.montant || 0), 0);

    setListings(myListings || []);
    setStats({
      actives: (myListings || []).filter((l) => l.status === 'disponible').length,
      enAttente,
      chiffreAffaires,
      favoris: favCount || 0,
    });
    setSolde(soldeDisponible);
    setRecentOrders(allOrders.slice(0, 3));
    setRating(ratingResult);
    setCompletedSales(completedResult);
    setLoading(false);
  }, []);

  const netSolde = Math.max(solde - dejaDemande, 0);

  const openPayoutModal = async () => {
    if (netSolde <= 0) {
      Alert.alert('Aucun solde disponible', "Tu n'as pas encore de solde disponible pour un reversement.");
      return;
    }

    // Déduit le pays probable depuis l'indicatif du téléphone, pour ne
    // proposer que les canaux pertinents (Wave au Sénégal, MyNITA au
    // Niger...). Si rien ne correspond, propose tout, par sécurité.
    const country = COUNTRIES.find((c) => myTelephone.startsWith(c.dialCode));
    let query = supabase.from('payment_methods').select('*').eq('active', true).order('display_order');
    if (country) query = query.eq('country_code', country.code);
    const { data } = await query;

    let channels = data || [];
    if (channels.length === 0) {
      const { data: allChannels } = await supabase.from('payment_methods').select('*').eq('active', true).order('display_order');
      channels = allChannels || [];
    }

    setPayoutChannels(channels);
    setSelectedChannel(channels[0] || null);
    setPayoutAmount(String(netSolde));
    setShowPayoutModal(true);
  };

  const submitPayout = async () => {
    const amount = Number(payoutAmount);
    if (!selectedChannel) {
      Alert.alert('Choisis un canal', 'Sélectionne un moyen pour recevoir ton reversement.');
      return;
    }
    if (!payoutPhone.trim()) {
      Alert.alert('Numéro manquant', 'Indique le numéro sur lequel recevoir le reversement.');
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert('Montant invalide', 'Indique un montant valide.');
      return;
    }
    if (amount > netSolde) {
      Alert.alert('Montant trop élevé', `Ton solde disponible est de ${netSolde.toLocaleString('fr-FR')} FCFA.`);
      return;
    }

    setSubmittingPayout(true);
    const myId = await getDeviceUserId();
    const feeAmount = Math.round(amount * PAYOUT_FEE_RATE);
    const amountToPay = amount - feeAmount;

    const { error } = await supabase.from('payout_requests').insert({
      vendeur_id: myId,
      amount_requested: amount,
      fee_amount: feeAmount,
      amount_to_pay: amountToPay,
      payout_channel: selectedChannel.provider_key,
      payout_channel_label: selectedChannel.provider_name,
      payout_phone: payoutPhone.trim(),
    });

    setSubmittingPayout(false);

    if (error) {
      Alert.alert('Erreur', "Impossible d'envoyer la demande : " + error.message);
      return;
    }

    setShowPayoutModal(false);
    Alert.alert(
      'Demande envoyée',
      `Tu recevras ${amountToPay.toLocaleString('fr-FR')} FCFA via ${selectedChannel.provider_name} (2% de frais Zuno déduits). Traitement sous quelques jours.`
    );
    loadDashboard();
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const handleDeleteListing = (listing) => {
    Alert.alert(
      'Retirer cette annonce ?',
      `« ${listing.title} » ne sera plus visible par les acheteurs. Cette action est définitive.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('listings').delete().eq('id', listing.id);
            if (error) {
              Alert.alert('Erreur', `Détail technique : ${error.message}`);
              return;
            }
            loadDashboard();
          },
        },
      ]
    );
  };

  const handleBoostListing = (listing) => {
    Alert.alert(
      'Mettre en avant cette annonce',
      "« " + listing.title + " » apparaîtra en priorité dans Tendances pendant 3 jours, pour 500 FCFA. Le paiement se fait pour l'instant par mobile money, confirmé manuellement (le paiement en ligne automatique arrive bientôt). Continuer ?",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Demander la mise en avant',
          onPress: async () => {
            const myId = await getDeviceUserId();
            const { error } = await supabase.from('boost_requests').insert({
              listing_id: listing.id,
              vendeur_id: myId,
              amount: 500,
              duration_days: 3,
            });
            if (error) {
              Alert.alert('Erreur', `Détail technique : ${error.message}`);
              return;
            }
            Alert.alert(
              'Demande envoyée',
              "On te contactera pour le règlement des 500 FCFA. L'annonce sera mise en avant dès la confirmation du paiement."
            );
            loadDashboard();
          },
        },
      ]
    );
  };

  const isTrusted = completedSales >= TRUST_BADGE_THRESHOLD;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{boutiqueNom || 'Ma boutique'}</Text>
          <TouchableOpacity onPress={() => switchMode('visiteur')} style={styles.switchButton}>
            <Ionicons name="swap-horizontal" size={14} color={colors.white} />
            <Text style={styles.switchButtonText}>Mode visiteur</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.reputationRow}>
          <StarRating average={rating.average} count={rating.count} />
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {identityStatus === 'verifiee' && (
              <View style={styles.identityBadge}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.white} />
                <Text style={styles.identityBadgeText}>Identité vérifiée</Text>
              </View>
            )}
            {isTrusted && (
              <View style={styles.trustBadge}>
                <Ionicons name="shield-checkmark" size={13} color={colors.white} />
                <Text style={styles.trustBadgeText}>Vendeur de confiance</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.identityLink}
          onPress={() => navigation.navigate('IdentityVerification')}
        >
          <Ionicons name="id-card-outline" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.identityLinkText}>
            {identityStatus === 'verifiee' ? "Voir ma vérification d'identité" : "Vérifier mon identité"}
          </Text>
          <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListHeaderComponent={
            <View>
              <View style={styles.soldeCard}>
                <Text style={styles.soldeLabel}>Solde disponible</Text>
                <Text style={styles.soldeValue}>{netSolde.toLocaleString('fr-FR')} FCFA</Text>
                <Text style={styles.soldeHint}>
                  {dejaDemande > 0
                    ? `${dejaDemande.toLocaleString('fr-FR')} FCFA déjà en cours de reversement`
                    : 'Basé sur les ventes déjà livrées ou récupérées'}
                </Text>
                <TouchableOpacity style={styles.payoutButton} onPress={openPayoutModal}>
                  <Ionicons name="cash-outline" size={16} color={colors.purple} />
                  <Text style={styles.payoutButtonText}>Demander un reversement</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.actives}</Text>
                  <Text style={styles.statLabel}>Annonces actives</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.enAttente}</Text>
                  <Text style={styles.statLabel}>Commandes en attente</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.chiffreAffaires.toLocaleString('fr-FR')}</Text>
                  <Text style={styles.statLabel}>FCFA de ventes</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.favoris}</Text>
                  <Text style={styles.statLabel}>Fois en favori</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.newListingButton}
                onPress={() => navigation.navigate('PostListing')}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                <Text style={styles.newListingButtonText}>Déposer une nouvelle annonce</Text>
              </TouchableOpacity>

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Dernières commandes</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Commandes')}>
                  <Text style={styles.seeAllText}>Tout voir</Text>
                </TouchableOpacity>
              </View>

              {recentOrders.length === 0 ? (
                <Text style={styles.emptyText}>Aucune commande pour l'instant.</Text>
              ) : (
                recentOrders.map((order) => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.thumb}>
                      {order.listings?.photo_url ? (
                        <Image source={{ uri: order.listings.photo_url }} style={styles.thumbImage} />
                      ) : (
                        <Ionicons name="cube-outline" size={18} color={colors.textMuted} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderTitle} numberOfLines={1}>{order.listings?.title}</Text>
                      <Text style={styles.orderSubtitle}>
                        {Number(order.montant).toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                  </View>
                ))
              )}

              <Text style={styles.sectionTitle}>Mes annonces</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Tu n'as pas encore d'annonce. Utilise le bouton ci-dessus pour publier la première.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.listingCard}>
              <TouchableOpacity
                style={styles.listingCardRow}
                onPress={() => navigation.navigate('ProductDetail', { listing: item })}
              >
                <View style={styles.thumb}>
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={styles.thumbImage} />
                  ) : (
                    <Ionicons name="image-outline" size={18} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.orderSubtitle}>
                    {Number(item.price).toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
                <View style={[styles.soldBadge, item.status === 'vendu' && styles.soldBadgeSold]}>
                  <Text style={[styles.soldBadgeText, item.status === 'vendu' && styles.soldBadgeTextSold]}>
                    {item.status === 'vendu' ? 'Vendu' : 'En vente'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleDeleteListing(item)}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.removeButtonText}>Retirer l'annonce</Text>
              </TouchableOpacity>

              {item.status !== 'vendu' && (
                <>
                  {item.boost_until && new Date(item.boost_until) > new Date() ? (
                    <View style={styles.boostActiveBadge}>
                      <Ionicons name="flash" size={12} color={colors.orange} />
                      <Text style={styles.boostActiveBadgeText}>
                        En vedette jusqu'au {new Date(item.boost_until).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  ) : boostByListing[item.id] ? (
                    <View style={styles.boostActiveBadge}>
                      <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.boostPendingText}>En attente de paiement (500 FCFA)</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.boostButton} onPress={() => handleBoostListing(item)}>
                      <Ionicons name="flash-outline" size={14} color={colors.purple} />
                      <Text style={styles.boostButtonText}>Mettre en avant (500 FCFA / 3j)</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={showPayoutModal} transparent animationType="slide" onRequestClose={() => setShowPayoutModal(false)}>
        <View style={styles.payoutOverlay}>
          <View style={styles.payoutCard}>
            <ScrollView>
              <Text style={styles.payoutTitle}>Demander un reversement</Text>
              <Text style={styles.payoutSubtitle}>
                Solde disponible : {netSolde.toLocaleString('fr-FR')} FCFA
              </Text>

              <Text style={styles.payoutLabel}>Montant à reverser</Text>
              <TextInput
                style={styles.payoutInput}
                keyboardType="numeric"
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                placeholder="Montant en FCFA"
              />

              <Text style={styles.payoutLabel}>Canal de reversement</Text>
              {payoutChannels.length === 0 ? (
                <Text style={styles.payoutHint}>Aucun canal disponible pour l'instant.</Text>
              ) : (
                <View style={styles.channelsWrap}>
                  {payoutChannels.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.channelChip, selectedChannel?.id === c.id && styles.channelChipActive]}
                      onPress={() => setSelectedChannel(c)}
                    >
                      <Text style={[styles.channelChipText, selectedChannel?.id === c.id && styles.channelChipTextActive]}>
                        {c.provider_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.payoutLabel}>Numéro pour recevoir l'argent</Text>
              <TextInput
                style={styles.payoutInput}
                keyboardType="phone-pad"
                value={payoutPhone}
                onChangeText={setPayoutPhone}
                placeholder="+227 90 00 00 00"
              />

              {Number(payoutAmount) > 0 && (
                <View style={styles.feePreview}>
                  <Text style={styles.feePreviewText}>
                    Frais Zuno (2%) : -{Math.round(Number(payoutAmount) * PAYOUT_FEE_RATE).toLocaleString('fr-FR')} FCFA
                  </Text>
                  <Text style={styles.feePreviewTotal}>
                    Tu recevras : {(Number(payoutAmount) - Math.round(Number(payoutAmount) * PAYOUT_FEE_RATE)).toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
              )}

              <View style={styles.payoutActionsRow}>
                <TouchableOpacity style={styles.payoutCancelBtn} onPress={() => setShowPayoutModal(false)}>
                  <Text style={styles.payoutCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.payoutSubmitBtn}
                  onPress={submitPayout}
                  disabled={submittingPayout}
                >
                  {submittingPayout ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.payoutSubmitText}>Envoyer la demande</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '700' },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  switchButtonText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  reputationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginLeft: 4 },
  noRatingText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  trustBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  identityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0B6BA8',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  identityBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  identityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  identityLinkText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  soldeCard: {
    backgroundColor: colors.purple,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  soldeLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  soldeValue: { color: colors.white, fontSize: 26, fontWeight: '700', marginTop: 4 },
  soldeHint: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4, textAlign: 'center' },
  payoutButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white,
    borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 16, marginTop: 12,
  },
  payoutButtonText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
  payoutOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  payoutCard: {
    backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, maxHeight: '85%',
  },
  payoutTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  payoutSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  payoutLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md, marginBottom: 6 },
  payoutInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, backgroundColor: colors.surface,
  },
  payoutHint: { fontSize: 13, color: colors.textMuted },
  channelsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  channelChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  channelChipActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  channelChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  channelChipTextActive: { color: colors.white },
  feePreview: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  feePreviewText: { fontSize: 12, color: colors.textSecondary },
  feePreviewTotal: { fontSize: 15, fontWeight: '800', color: colors.success, marginTop: 4 },
  payoutActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.lg },
  payoutCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center',
  },
  payoutCancelText: { color: colors.textSecondary, fontWeight: '700' },
  payoutSubmitBtn: {
    flex: 2, paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.purple, alignItems: 'center',
  },
  payoutSubmitText: { color: colors.white, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.purple },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  newListingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  newListingButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  seeAllText: { fontSize: 12, color: colors.orange, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.md },
  orderCard: {
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
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  orderTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  orderSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  listingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  listingCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  soldBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
  },
  soldBadgeSold: { backgroundColor: colors.background },
  soldBadgeText: { fontSize: 10, fontWeight: '700', color: colors.success },
  soldBadgeTextSold: { color: colors.textMuted },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignSelf: 'flex-start',
  },
  removeButtonText: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  boostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  boostButtonText: { fontSize: 12, color: colors.purple, fontWeight: '700' },
  boostActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  boostActiveBadgeText: { fontSize: 11, color: colors.orange, fontWeight: '700' },
  boostPendingText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});
