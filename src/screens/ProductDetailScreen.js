import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, FlatList, Dimensions, Modal, TextInput, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId, ensureAccountComplete } from '../lib/deviceUser';
import { ILLEGAL_KEYWORDS } from '../lib/moderation';
import { getSellerRating, countCompletedSales, TRUST_BADGE_THRESHOLD } from '../lib/reputation';

const REPORT_CATEGORIES = [...Object.keys(ILLEGAL_KEYWORDS), 'AUTRE'];

const screenWidth = Dimensions.get('window').width;
const GALLERY_WIDTH = screenWidth - spacing.lg * 2;

export default function ProductDetailScreen({ route, navigation }) {
  const { listing } = route.params;
  const [activeIndex, setActiveIndex] = useState(0);
  const [similar, setSimilar] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistId, setWishlistId] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState(null);
  const [reportComment, setReportComment] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [sellerStats, setSellerStats] = useState({ average: null, count: 0, completedSales: 0 });
  const [sellerProfile, setSellerProfile] = useState(null);
  // Les annonces publiées avant l'ajout du carrousel n'ont qu'une seule
  // photo (photo_url) : on retombe dessus si `photos` n'existe pas.
  const gallery = listing.photos?.length ? listing.photos : listing.photo_url ? [listing.photo_url] : [];
  // Les annonces créées avant la connexion par téléphone n'ont pas
  // encore de vendeur identifié, ou son profil n'a pas encore été rempli :
  // on affiche un repère temporaire dans ces cas-là.
  const seller = sellerProfile?.nom
    ? {
        name: sellerProfile.nom,
        initials: sellerProfile.nom.slice(0, 2).toUpperCase(),
        photo: sellerProfile.photo_url,
        avatarIcon: sellerProfile.avatar_icon,
        avatarColor: sellerProfile.avatar_color,
        whatsapp: sellerProfile.whatsapp,
      }
    : { name: 'Vendeur Zuno', initials: 'VZ', photo: null, avatarIcon: null, avatarColor: null, whatsapp: null };

  useEffect(() => {
    if (!listing.vendeur_id) return;
    let cancelled = false;
    Promise.all([
      getSellerRating(listing.vendeur_id),
      countCompletedSales(listing.vendeur_id),
      supabase.from('public_profiles').select('nom, photo_url, whatsapp, avatar_icon, avatar_color').eq('id', listing.vendeur_id).maybeSingle(),
    ]).then(([rating, completedSales, profileResult]) => {
      if (cancelled) return;
      setSellerStats({ ...rating, completedSales });
      if (profileResult.data?.nom && profileResult.data.nom !== 'Toi (test)') {
        setSellerProfile(profileResult.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [listing.vendeur_id]);

  useEffect(() => {
    if (!listing.vendeur_id) return;
    let cancelled = false;
    async function loadFavoriteState() {
      const myId = await getDeviceUserId();
      const { data } = await supabase
        .from('favorite_shops')
        .select('id')
        .eq('acheteur_id', myId)
        .eq('vendeur_id', listing.vendeur_id)
        .maybeSingle();
      if (!cancelled && data) {
        setIsFavorite(true);
        setFavoriteId(data.id);
      }
    }
    loadFavoriteState();
    return () => {
      cancelled = true;
    };
  }, [listing.vendeur_id]);

  useEffect(() => {
    let cancelled = false;
    async function loadWishlistState() {
      const myId = await getDeviceUserId();
      const { data } = await supabase
        .from('wishlist_items')
        .select('id')
        .eq('acheteur_id', myId)
        .eq('listing_id', listing.id)
        .maybeSingle();
      if (!cancelled && data) {
        setIsWishlisted(true);
        setWishlistId(data.id);
      }
    }
    loadWishlistState();
    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  const handleToggleFavorite = async () => {
    if (!listing.vendeur_id) {
      Alert.alert(
        'Boutique non identifiée',
        "Cette annonce a été créée avant l'activation des favoris."
      );
      return;
    }
    const myId = await getDeviceUserId();

    if (isFavorite) {
      await supabase.from('favorite_shops').delete().eq('id', favoriteId);
      setIsFavorite(false);
      setFavoriteId(null);
    } else {
      const { data } = await supabase
        .from('favorite_shops')
        .insert({ acheteur_id: myId, vendeur_id: listing.vendeur_id })
        .select()
        .single();
      setIsFavorite(true);
      setFavoriteId(data?.id || null);
    }
  };

  const handleToggleWishlist = async () => {
    const myId = await getDeviceUserId();
    if (isWishlisted) {
      await supabase.from('wishlist_items').delete().eq('id', wishlistId);
      setIsWishlisted(false);
      setWishlistId(null);
    } else {
      const ok = await ensureAccountComplete(navigation, 'mettre un article de côté');
      if (!ok) return;
      const { data } = await supabase
        .from('wishlist_items')
        .insert({ acheteur_id: myId, listing_id: listing.id })
        .select()
        .single();
      setIsWishlisted(true);
      setWishlistId(data?.id || null);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${listing.title} — ${Number(listing.price).toLocaleString('fr-FR')} FCFA sur Zuno (${listing.city || 'Niger'}). Trouve-le en cherchant "${listing.title}" dans l'appli Zuno !`,
      });
    } catch (e) {
      // L'utilisateur a simplement annulé le partage, rien à faire.
    }
  };

  const handleSendOffer = async () => {
    const amount = Number(offerAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Montant invalide', 'Indique un montant valide pour ton offre.');
      return;
    }
    if (!listing.vendeur_id) {
      Alert.alert('Vendeur non identifié', "Impossible de faire une offre sur cette annonce.");
      return;
    }

    setSendingOffer(true);
    const myId = await getDeviceUserId();

    const { error } = await supabase.from('offers').insert({
      listing_id: listing.id,
      buyer_id: myId,
      seller_id: listing.vendeur_id,
      montant: amount,
    });

    if (error) {
      setSendingOffer(false);
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }

    await supabase.from('messages').insert({
      listing_id: listing.id,
      expediteur_id: myId,
      destinataire_id: listing.vendeur_id,
      contenu: `💰 Offre : ${amount.toLocaleString('fr-FR')} FCFA pour « ${listing.title} » (prix affiché : ${Number(listing.price).toLocaleString('fr-FR')} FCFA)`,
    });

    setSendingOffer(false);
    setShowOfferModal(false);
    setOfferAmount('');
    navigation.navigate('Chat', {
      listingId: listing.id,
      listingTitle: listing.title,
      otherUserId: listing.vendeur_id,
    });
  };

  useEffect(() => {
    let cancelled = false;
    async function loadSimilar() {
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('category', listing.category)
        .eq('status', 'disponible')
        .eq('moderation_status', 'approved')
        .neq('id', listing.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (!cancelled) setSimilar(data || []);
    }
    loadSimilar();
    return () => {
      cancelled = true;
    };
  }, [listing.id, listing.category]);

  const handleBuy = async () => {
    const ok = await ensureAccountComplete(navigation, 'acheter un article');
    if (!ok) return;
    navigation.navigate('Cart', { listing });
  };

  const handleContact = () => {
    if (!listing.vendeur_id) {
      Alert.alert(
        'Vendeur non identifié',
        "Cette annonce a été créée avant l'activation de la messagerie, impossible de contacter son auteur."
      );
      return;
    }
    navigation.navigate('Chat', {
      listingId: listing.id,
      listingTitle: listing.title,
      otherUserId: listing.vendeur_id,
    });
  };

  const handleSendReport = async () => {
    if (!reportCategory) {
      Alert.alert('Catégorie manquante', 'Choisis le motif du signalement.');
      return;
    }
    setSendingReport(true);
    const myId = await getDeviceUserId();

    await supabase.from('moderation_queue').insert({
      listing_id: listing.id,
      source: 'user_report',
      category: reportCategory === 'AUTRE' ? 'OTHER_ILLEGAL' : reportCategory,
      reporter_id: myId,
      reporter_comment: reportComment.trim() || null,
    });

    await supabase.from('moderation_logs').insert({
      listing_id: listing.id,
      actor_type: 'user',
      actor_id: myId,
      action: 'user_report',
      details: { category: reportCategory, comment: reportComment.trim() },
    });

    setSendingReport(false);
    setShowReport(false);
    setReportCategory(null);
    setReportComment('');
    Alert.alert('Signalement envoyé', 'Merci, notre équipe va vérifier cette annonce.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowReport(true)} style={styles.reportLink}>
          <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
          <Text style={styles.reportLinkText}>Signaler</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.image}>
        {gallery.length > 0 ? (
          <>
            <FlatList
              data={gallery}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / GALLERY_WIDTH);
                setActiveIndex(index);
              }}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={[styles.photoImage, { width: GALLERY_WIDTH }]} />
              )}
            />
            {gallery.length > 1 && (
              <View style={styles.dotsRow}>
                {gallery.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </>
        ) : (
          <Ionicons name="image-outline" size={32} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.titleRow}>
        <Text style={[styles.title, { flex: 1 }]}>{listing.title}</Text>
        <TouchableOpacity onPress={handleToggleWishlist} style={styles.iconButton}>
          <Ionicons
            name={isWishlisted ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isWishlisted ? colors.orange : colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
          <Ionicons name="share-social-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.price}>{Number(listing.price).toLocaleString('fr-FR')} FCFA</Text>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{listing.condition}</Text>
      </View>

      {listing.description ? (
        <View style={styles.presentationSection}>
          <Text style={styles.sectionTitle}>Présentation</Text>
          <Text style={styles.description}>{listing.description}</Text>
        </View>
      ) : null}

      {listing.delai_livraison && (
        <View style={styles.deliveryInfo}>
          <Ionicons name="bicycle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.deliveryInfoText}>
            Livraison estimée : {listing.delai_livraison}
          </Text>
        </View>
      )}

      <View style={styles.sellerRow}>
        <View style={styles.avatar}>
          {seller.avatarIcon ? (
            <View style={[styles.avatarIconWrap, { backgroundColor: seller.avatarColor }]}>
              <Ionicons name={seller.avatarIcon} size={20} color={colors.white} />
            </View>
          ) : seller.photo ? (
            <Image source={{ uri: seller.photo }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{seller.initials}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.sellerNameRow}>
            <Text style={styles.sellerName}>{seller.name}</Text>
            {sellerStats.completedSales >= TRUST_BADGE_THRESHOLD && (
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            )}
          </View>
          <Text style={styles.sellerMeta}>
            {sellerStats.count > 0
              ? `★ ${sellerStats.average.toFixed(1)} (${sellerStats.count} avis) · ${sellerStats.completedSales} ventes`
              : listing.vendeur_id
              ? "Pas encore d'avis"
              : 'Vendeur non identifié'}
          </Text>
        </View>
        {seller.whatsapp && (
          <TouchableOpacity
            onPress={() => {
              const digits = seller.whatsapp.replace(/[^0-9]/g, '');
              const message = encodeURIComponent(`Bonjour, je suis intéressé(e) par « ${listing.title} » sur Zuno.`);
              Linking.openURL(`https://wa.me/${digits}?text=${message}`);
            }}
            style={styles.whatsappButton}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleToggleFavorite} style={styles.favoriteButton}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorite ? colors.orange : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleContact}>
          <Text style={styles.secondaryButtonText}>Contacter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleBuy}>
          <Text style={styles.primaryButtonText}>Acheter</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.offerLink}
        onPress={() => setShowOfferModal(true)}
      >
        <Ionicons name="pricetag-outline" size={14} color={colors.purple} />
        <Text style={styles.offerLinkText}>Faire une offre à ce prix</Text>
      </TouchableOpacity>

      <Modal visible={showOfferModal} transparent animationType="fade" onRequestClose={() => setShowOfferModal(false)}>
        <View style={styles.offerModalOverlay}>
          <View style={styles.offerModalCard}>
            <Text style={styles.offerModalTitle}>Faire une offre</Text>
            <Text style={styles.offerModalSubtitle}>
              Prix affiché : {Number(listing.price).toLocaleString('fr-FR')} FCFA
            </Text>
            <TextInput
              placeholder="Ton offre en FCFA"
              placeholderTextColor={colors.textMuted}
              value={offerAmount}
              onChangeText={setOfferAmount}
              keyboardType="numeric"
              style={styles.offerInput}
              autoFocus
            />
            <View style={styles.offerModalButtons}>
              <TouchableOpacity
                style={styles.offerModalCancel}
                onPress={() => setShowOfferModal(false)}
              >
                <Text style={styles.offerModalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.offerModalSend}
                onPress={handleSendOffer}
                disabled={sendingOffer}
              >
                <Text style={styles.offerModalSendText}>
                  {sendingOffer ? 'Envoi…' : "Envoyer l'offre"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {similar.length > 0 && (
        <View style={styles.similarSection}>
          <Text style={styles.sectionTitle}>Articles similaires</Text>
          <FlatList
            data={similar}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.similarCard}
                onPress={() => navigation.push('ProductDetail', { listing: item })}
              >
                <View style={styles.similarThumb}>
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={styles.similarThumbImage} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  )}
                </View>
                <Text style={styles.similarTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.similarPrice}>
                  {Number(item.price).toLocaleString('fr-FR')} FCFA
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <Modal visible={showReport} animationType="slide" onRequestClose={() => setShowReport(false)}>
        <View style={styles.reportModalContainer}>
          <View style={styles.reportModalHeader}>
            <Text style={styles.reportModalTitle}>Signaler cette annonce</Text>
            <TouchableOpacity onPress={() => setShowReport(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={styles.reportLabel}>Motif</Text>
            <View style={styles.reportPillRow}>
              {REPORT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setReportCategory(cat)}
                  style={[styles.reportPill, reportCategory === cat && styles.reportPillActive]}
                >
                  <Text
                    style={[
                      styles.reportPillText,
                      reportCategory === cat && styles.reportPillTextActive,
                    ]}
                  >
                    {cat.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.reportLabel}>Précision (facultatif)</Text>
            <TextInput
              placeholder="Décris ce qui te semble poser problème…"
              placeholderTextColor={colors.textMuted}
              value={reportComment}
              onChangeText={setReportComment}
              style={styles.reportInput}
              multiline
            />
          </ScrollView>
          <View style={styles.reportModalFooter}>
            <TouchableOpacity
              style={styles.reportSendButton}
              onPress={handleSendReport}
              disabled={sendingReport}
            >
              <Text style={styles.reportSendButtonText}>
                {sendingReport ? 'Envoi…' : 'Envoyer le signalement'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  image: {
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  photoImage: { height: '100%' },
  dotsRow: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: { backgroundColor: colors.white, width: 16 },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  price: { fontSize: 20, fontWeight: '700', color: colors.orange, marginTop: 4, marginBottom: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  badgeText: { color: colors.success, fontSize: 12, fontWeight: '600' },
  presentationSection: { marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  description: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  deliveryInfoText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  avatarIconWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  sellerName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerMeta: { fontSize: 12, color: colors.textSecondary },
  favoriteButton: { padding: spacing.xs },
  whatsappButton: { padding: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconButton: { padding: spacing.xs },
  offerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  offerLinkText: { fontSize: 13, color: colors.purple, fontWeight: '600' },
  offerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  offerModalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  offerModalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  offerModalSubtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md },
  offerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 46,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  offerModalButtons: { flexDirection: 'row', gap: spacing.sm },
  offerModalCancel: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  offerModalCancelText: { color: colors.textPrimary, fontWeight: '600' },
  offerModalSend: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.orange,
    alignItems: 'center',
  },
  offerModalSendText: { color: colors.white, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '600' },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '600' },
  similarSection: { marginTop: spacing.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reportLinkText: { fontSize: 12, color: colors.textMuted },
  reportModalContainer: { flex: 1, backgroundColor: colors.background },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reportModalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  reportLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.sm },
  reportPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  reportPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reportPillActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  reportPillText: { fontSize: 11, color: colors.textPrimary },
  reportPillTextActive: { color: colors.white, fontWeight: '600' },
  reportInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reportModalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  reportSendButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reportSendButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  similarCard: {
    width: 130,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  similarThumb: {
    width: '100%',
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  similarThumbImage: { width: '100%', height: '100%' },
  similarTitle: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  similarPrice: { fontSize: 12, color: colors.orange, fontWeight: '700', marginTop: 2 },
});
