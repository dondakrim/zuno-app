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
import { useMode } from '../../context/ModeContext';
import { getSellerRating, countCompletedSales, TRUST_BADGE_THRESHOLD } from '../../lib/reputation';

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
  const [stats, setStats] = useState({ actives: 0, enAttente: 0, chiffreAffaires: 0, favoris: 0 });
  const [solde, setSolde] = useState(0);
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
      .select('identity_status, boutique_nom')
      .eq('id', myId)
      .maybeSingle();
    setIdentityStatus(userRow?.identity_status || 'non_soumise');
    setBoutiqueNom(userRow?.boutique_nom || '');

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
                <Text style={styles.soldeValue}>{solde.toLocaleString('fr-FR')} FCFA</Text>
                <Text style={styles.soldeHint}>
                  Basé sur les ventes déjà livrées ou récupérées
                </Text>
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
            </View>
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
});
