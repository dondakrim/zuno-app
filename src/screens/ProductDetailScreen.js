import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, FlatList, Dimensions, Modal, TextInput, Share, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvatarGlyph } from '../components/Avatar';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId, ensureAccountComplete } from '../lib/deviceUser';
import { ILLEGAL_KEYWORDS } from '../lib/moderation';
import { usePrefs } from '../lib/prefs';
import ReportUserModal from '../components/ReportUserModal';
import { warrantyLabel } from '../lib/warranty';
import { useCart } from '../lib/cartState';
import { getSellerRating, getListingRating, countCompletedSales, TRUST_BADGE_THRESHOLD } from '../lib/reputation';

const REPORT_CATEGORIES = [...Object.keys(ILLEGAL_KEYWORDS), 'AUTRE'];

const screenWidth = Dimensions.get('window').width;
const GALLERY_WIDTH = screenWidth;
const HERO_HEIGHT = 340;
const TOP_OFFSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

export default function ProductDetailScreen({ route, navigation }) {
  const { listing } = route.params;
  const { formatPrice } = usePrefs();
  const [activeIndex, setActiveIndex] = useState(0);
  const [similar, setSimilar] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { inCart: cartItemId, toggle: handleToggleCart } = useCart(listing.id, navigation);
  const [wishlistId, setWishlistId] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showReportSeller, setShowReportSeller] = useState(false);
  const [reportCategory, setReportCategory] = useState(null);
  const [reportComment, setReportComment] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [sellerStats, setSellerStats] = useState({ average: null, count: 0, completedSales: 0 });
  const [listingRating, setListingRating] = useState({ average: null, count: 0 });
  const [sellerProfile, setSellerProfile] = useState(null);
  // Stock : vide = article unique (comportement habituel) ; un nombre = stock suivi.
  const [stock, setStock] = useState(typeof listing.stock === 'number' ? listing.stock : null);
  const [status, setStatus] = useState(listing.status || 'disponible');
  const [alertOn, setAlertOn] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const tracked = typeof stock === 'number';
  const soldOut = tracked ? stock <= 0 : status === 'vendu';
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
      getListingRating(listing.id),
      countCompletedSales(listing.vendeur_id),
      supabase.from('public_profiles').select('nom, photo_url, whatsapp, avatar_icon, avatar_color').eq('id', listing.vendeur_id).maybeSingle(),
    ]).then(([rating, listingRatingResult, completedSales, profileResult]) => {
      if (cancelled) return;
      setSellerStats({ ...rating, completedSales });
      setListingRating(listingRatingResult);
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

  // Stock et alerte « prévenez-moi » à jour à chaque ouverture de la fiche.
  useEffect(() => {
    let cancelled = false;
    async function loadStock() {
      const myId = await getDeviceUserId();
      const [{ data: fresh }, { data: alert }] = await Promise.all([
        supabase.from('listings').select('stock, status').eq('id', listing.id).maybeSingle(),
        supabase.from('stock_alerts').select('listing_id').eq('listing_id', listing.id).eq('user_id', myId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (fresh) {
        setStock(typeof fresh.stock === 'number' ? fresh.stock : null);
        setStatus(fresh.status || 'disponible');
      }
      setAlertOn(!!alert);
    }
    loadStock();
    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  const handleToggleAlert = async () => {
    if (alertBusy) return;
    const myId = await getDeviceUserId();
    setAlertBusy(true);
    if (alertOn) {
      await supabase.from('stock_alerts').delete().eq('listing_id', listing.id).eq('user_id', myId);
      setAlertOn(false);
      setAlertBusy(false);
      return;
    }
    const ok = await ensureAccountComplete(navigation, 'être prévenu(e) du retour en stock');
    if (!ok) { setAlertBusy(false); return; }
    const { error } = await supabase.from('stock_alerts').insert({ listing_id: listing.id, user_id: myId });
    setAlertBusy(false);
    if (error) {
      Alert.alert('Oups', "Impossible d'activer l'alerte pour le moment.");
      return;
    }
    setAlertOn(true);
    Alert.alert('Alerte activée 🔔', "On te prévient dès que cet article est de nouveau disponible.");
  };

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
    if (soldOut) {
      Alert.alert('Indisponible', tracked ? 'Cet article est actuellement en rupture de stock.' : 'Cet article a déjà été vendu.');
      return;
    }
    const ok = await ensureAccountComplete(navigation, 'acheter un article');
    if (!ok) return;
    navigation.navigate('Cart', { listing: { ...listing, stock } });
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

  const warrantyText = Number(listing.warranty_days) > 0 ? `Garantie ${warrantyLabel(listing.warranty_days)}` : listing.warranty_days === 0 ? 'Sans garantie' : null;
  const lowStock = tracked && stock > 0 && stock <= 3;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* ---------- Galerie plein écran ---------- */}
        <View style={styles.hero}>
          {gallery.length > 0 ? (
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
                <Image source={{ uri: item }} style={{ width: GALLERY_WIDTH, height: HERO_HEIGHT }} resizeMode="cover" />
              )}
            />
          ) : (
            <View style={styles.heroEmpty}><Ionicons name="image-outline" size={40} color={colors.textMuted} /></View>
          )}

          {soldOut ? (
            <View style={styles.soldVeil} pointerEvents="none">
              <View style={styles.soldPill}>
                <Ionicons name="alert-circle" size={16} color="#fff" />
                <Text style={styles.soldPillText}>{tracked ? 'Rupture de stock' : 'Vendu'}</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.topBar, { top: TOP_OFFSET }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {soldOut && tracked ? (
                <TouchableOpacity onPress={handleToggleAlert} style={[styles.roundBtn, alertOn && { backgroundColor: colors.orange }]} hitSlop={8}>
                  <Ionicons name={alertOn ? 'notifications' : 'notifications-outline'} size={20} color={alertOn ? '#fff' : colors.orange} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={handleToggleWishlist} style={styles.roundBtn} hitSlop={8}>
                <Ionicons name={isWishlisted ? 'bookmark' : 'bookmark-outline'} size={20} color={isWishlisted ? colors.orange : colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={styles.roundBtn} hitSlop={8}>
                <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {gallery.length > 1 ? (
            <>
              <View style={styles.counterChip}>
                <Ionicons name="images-outline" size={13} color="#fff" />
                <Text style={styles.counterChipText}>{activeIndex + 1}/{gallery.length}</Text>
              </View>
              <View style={styles.dotsRow}>
                {gallery.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* ---------- Fiche ---------- */}
        <View style={styles.sheet}>
          <View style={styles.chipRow}>
            {listing.condition ? (
              <View style={[styles.chip, { backgroundColor: colors.successBg }]}>
                <Text style={[styles.chipText, { color: colors.success }]}>{listing.condition}</Text>
              </View>
            ) : null}
            {warrantyText ? (
              <View style={[styles.chip, { backgroundColor: Number(listing.warranty_days) > 0 ? colors.successBg : colors.background }]}>
                <Ionicons name={Number(listing.warranty_days) > 0 ? 'shield-checkmark' : 'shield-outline'} size={13} color={Number(listing.warranty_days) > 0 ? colors.success : colors.textMuted} />
                <Text style={[styles.chipText, { color: Number(listing.warranty_days) > 0 ? colors.success : colors.textMuted }]}>{warrantyText}</Text>
              </View>
            ) : null}
            {listing.is_heavy ? (
              <View style={[styles.chip, { backgroundColor: colors.tintPurple }]}>
                <Ionicons name="cube-outline" size={13} color={colors.purple} />
                <Text style={[styles.chipText, { color: colors.purple }]}>Livraison à négocier</Text>
              </View>
            ) : null}
            {tracked && stock > 0 ? (
              <View style={[styles.chip, { backgroundColor: lowStock ? colors.tintOrange : colors.tintPurple }]}>
                <Ionicons name="layers-outline" size={13} color={lowStock ? colors.orange : colors.purple} />
                <Text style={[styles.chipText, { color: lowStock ? colors.orange : colors.purple }]}>
                  {lowStock ? `Plus que ${stock} !` : `${stock} en stock`}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(listing.price)}</Text>
            {listingRating.count > 0 ? (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={13} color="#F5A400" />
                <Text style={styles.ratingPillText}>{listingRating.average.toFixed(1)} ({listingRating.count})</Text>
              </View>
            ) : null}
          </View>
          {Number(listing.warranty_days) > 0 && listing.warranty_note ? (
            <Text style={styles.warrantyNote}>{listing.warranty_note}</Text>
          ) : null}

          {/* Stock */}
          {tracked && stock > 0 ? (
            <View style={styles.stockCard}>
              <View style={[styles.stockIcon, { backgroundColor: lowStock ? colors.tintOrange : colors.tintPurple }]}>
                <Ionicons name="cube" size={20} color={lowStock ? colors.orange : colors.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stockLabel}>Nombre d'articles disponibles</Text>
                {lowStock ? <Text style={styles.stockHint}>Dépêche-toi, il en reste peu !</Text> : null}
              </View>
              <Text style={[styles.stockNumber, lowStock && { color: colors.orange }]}>{stock}</Text>
            </View>
          ) : null}

          {soldOut ? (
            <View style={styles.soldBanner}>
              <View style={styles.soldBannerHead}>
                <Ionicons name="alert-circle" size={22} color={colors.danger} />
                <Text style={styles.soldBannerTitle}>
                  {tracked ? 'Article actuellement en rupture de stock' : 'Cet article a déjà été vendu'}
                </Text>
              </View>
              {tracked ? (
                <>
                  <Text style={styles.soldBannerText}>Le vendeur va le réapprovisionner. On peut te prévenir dès son retour.</Text>
                  <TouchableOpacity
                    style={[styles.notifyBtn, alertOn && styles.notifyBtnOn]}
                    onPress={handleToggleAlert}
                    disabled={alertBusy}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={alertOn ? 'notifications' : 'notifications-outline'} size={18} color={alertOn ? colors.success : '#fff'} />
                    <Text style={[styles.notifyBtnText, alertOn && { color: colors.success }]}>
                      {alertOn ? 'Alerte activée · Toucher pour annuler' : 'Prévenez-moi quand ce sera disponible'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          ) : null}

          {/* Infos clés */}
          <View style={styles.infoGrid}>
            <View style={styles.infoTile}>
              <Ionicons name="location-outline" size={18} color={colors.purple} />
              <Text style={styles.infoLabel}>Lieu</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{listing.city || 'Non précisé'}</Text>
            </View>
            <View style={styles.infoTile}>
              <Ionicons name="bicycle-outline" size={18} color={colors.purple} />
              <Text style={styles.infoLabel}>Livraison</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{listing.delai_livraison || 'À convenir'}</Text>
            </View>
            <View style={styles.infoTile}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.purple} />
              <Text style={styles.infoLabel}>Garantie</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{Number(listing.warranty_days) > 0 ? warrantyLabel(listing.warranty_days) : 'Aucune'}</Text>
            </View>
          </View>

          {listing.description ? (
            <View style={styles.block}>
              <Text style={styles.sectionTitle}>Présentation</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          {/* Vendeur */}
          <View style={styles.sellerCard}>
            <View style={styles.avatar}>
              {seller.avatarIcon ? (
                <View style={[styles.avatarIconWrap, { backgroundColor: seller.avatarColor }]}>
                  <AvatarGlyph icon={seller.avatarIcon} size={22} />
                </View>
              ) : seller.photo ? (
                <Image source={{ uri: seller.photo }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{seller.initials}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>{seller.name}</Text>
                {sellerStats.completedSales >= TRUST_BADGE_THRESHOLD && (
                  <Ionicons name="shield-checkmark" size={15} color={colors.success} />
                )}
              </View>
              <Text style={styles.sellerSubMeta}>
                {sellerStats.count > 0
                  ? `★ ${sellerStats.average.toFixed(1)} (${sellerStats.count} avis) · ${sellerStats.completedSales} ventes`
                  : listing.vendeur_id
                  ? 'Pas encore de ventes'
                  : 'Vendeur non identifié'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleToggleFavorite} style={[styles.followBtn, isFavorite && { backgroundColor: colors.tintOrange }]}>
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? colors.orange : colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!soldOut ? (
            <TouchableOpacity style={styles.linkRow} onPress={() => setShowOfferModal(true)}>
              <Ionicons name="pricetag-outline" size={16} color={colors.purple} />
              <Text style={styles.linkRowText}>Faire une offre à ce prix</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.reportRow}>
            <TouchableOpacity onPress={() => setShowReport(true)} style={styles.reportLink}>
              <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
              <Text style={styles.reportLinkText}>Signaler l'annonce</Text>
            </TouchableOpacity>
            {listing.vendeur_id ? (
              <TouchableOpacity onPress={() => setShowReportSeller(true)} style={styles.reportLink}>
                <Ionicons name="person-remove-outline" size={14} color={colors.textMuted} />
                <Text style={styles.reportLinkText}>Signaler le vendeur</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {similar.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={styles.sectionTitle}>Articles similaires</Text>
              <FlatList
                data={similar}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: spacing.sm, paddingTop: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.similarCard} onPress={() => navigation.push('ProductDetail', { listing: item })} activeOpacity={0.85}>
                    <View style={styles.similarThumb}>
                      {item.photo_url ? (
                        <Image source={{ uri: item.photo_url }} style={styles.similarThumbImage} />
                      ) : (
                        <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                      )}
                    </View>
                    <Text style={styles.similarTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.similarPrice}>{formatPrice(item.price)}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---------- Barre d'actions ---------- */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.barIconBtn} onPress={handleContact} activeOpacity={0.85}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.purple} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleToggleCart}
          disabled={soldOut}
          style={[styles.barIconBtn, cartItemId && { backgroundColor: colors.purple, borderColor: colors.purple }, soldOut && { opacity: 0.4 }]}
          activeOpacity={0.85}
        >
          <Ionicons name={cartItemId ? 'cart' : 'cart-outline'} size={22} color={cartItemId ? '#fff' : colors.purple} />
        </TouchableOpacity>
        {soldOut ? (
          tracked ? (
            <TouchableOpacity style={[styles.buyBtn, alertOn && { backgroundColor: colors.successBg }]} onPress={handleToggleAlert} activeOpacity={0.85}>
              <Ionicons name={alertOn ? 'notifications' : 'notifications-outline'} size={18} color={alertOn ? colors.success : '#fff'} />
              <Text style={[styles.buyBtnText, alertOn && { color: colors.success }]}>{alertOn ? 'Alerte activée' : 'Me prévenir'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.buyBtn, { backgroundColor: colors.border }]}>
              <Text style={[styles.buyBtnText, { color: colors.textMuted }]}>Vendu</Text>
            </View>
          )
        ) : (
          <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} activeOpacity={0.85}>
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.buyBtnText}>Acheter · {formatPrice(listing.price)}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ReportUserModal
        visible={showReportSeller}
        onClose={() => setShowReportSeller(false)}
        target={{ id: listing.vendeur_id, name: seller.name }}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { height: HERO_HEIGHT, backgroundColor: colors.background },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  soldVeil: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20,10,50,0.45)', alignItems: 'center', justifyContent: 'center' },
  soldPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  soldPillText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  counterChip: { position: 'absolute', right: 16, bottom: 44, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  counterChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dotsRow: { position: 'absolute', bottom: 44, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.65)' },
  dotActive: { backgroundColor: '#fff', width: 18 },

  sheet: { marginTop: -28, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, lineHeight: 28 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  price: { fontSize: 28, fontWeight: '800', color: colors.orange },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7E0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  ratingPillText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  warrantyNote: { color: colors.textMuted, fontSize: 12, marginTop: 6 },

  stockCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: radius.lg, padding: 14, marginTop: 16 },
  stockIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  stockLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  stockHint: { fontSize: 12, color: colors.orange, marginTop: 2, fontWeight: '600' },
  stockNumber: { fontSize: 28, fontWeight: '800', color: colors.purple },

  soldBanner: { backgroundColor: '#FDECEA', borderRadius: radius.lg, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#F5C6C2' },
  soldBannerHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soldBannerTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.danger },
  soldBannerText: { fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 },
  notifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 13, marginTop: 12 },
  notifyBtnOn: { backgroundColor: colors.successBg },
  notifyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  infoGrid: { flexDirection: 'row', gap: 10, marginTop: 18 },
  infoTile: { flex: 1, backgroundColor: colors.background, borderRadius: radius.lg, padding: 12, gap: 4 },
  infoLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  infoValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },

  block: { marginTop: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
  description: { fontSize: 15, color: colors.textSecondary, lineHeight: 23 },

  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginTop: 22, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  avatarIconWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  sellerName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, flexShrink: 1 },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerSubMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  followBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },

  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.tintPurple, borderRadius: radius.md, paddingVertical: 13, marginTop: 14 },
  linkRowText: { color: colors.purple, fontWeight: '700', fontSize: 14 },
  reportRow: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 14 },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reportLinkText: { fontSize: 12, color: colors.textMuted },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 14, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 10 },
  barIconBtn: { width: 50, height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: colors.purple, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  buyBtn: { flex: 1, height: 50, borderRadius: 16, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buyBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  similarSection: { marginTop: spacing.xl },
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

  reportPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  reportPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

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
