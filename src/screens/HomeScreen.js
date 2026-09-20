import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { categories } from '../data/mockListings';
import { supabase } from '../lib/supabase';
import { useMode } from '../context/ModeContext';
import { PHONE_AUTH_ENABLED } from '../config';
import { getDeviceUserId, ensureAccountComplete } from '../lib/deviceUser';
import MasonrySection from '../components/MasonrySection';

const CATEGORY_ICONS = {
  'Mode et vêtements': 'shirt-outline',
  'Électronique et téléphones': 'phone-portrait-outline',
  'Maison et électroménager': 'home-outline',
  'Véhicules et pièces': 'car-outline',
  Autres: 'ellipsis-horizontal-circle-outline',
};

// Bannières publicitaires internes, en attendant un vrai système de
// promotions gérées par les vendeurs.
// Bannières de secours, utilisées uniquement tant qu'aucune publicité n'a
// été ajoutée depuis le tableau de bord admin (table `ads`).
const FALLBACK_ADS = [
  { id: 'ad-1', title: 'Bienvenue sur Zuno', subtitle: 'Achète et vends d\'occasion partout au Niger', color: '#2E0B8C' },
  { id: 'ad-2', title: 'Vends en 5 minutes', subtitle: 'Publie une annonce avec photos en quelques clics', color: '#FF6A00' },
  { id: 'ad-3', title: 'Discute en direct', subtitle: 'Contacte les vendeurs sans quitter l\'appli', color: '#1D9E75' },
  { id: 'ad-4', title: 'Livraison suivie', subtitle: 'Suis ta commande du dépôt à la livraison', color: '#0B6BA8' },
];

const screenWidth = Dimensions.get('window').width;
const AD_WIDTH = screenWidth - spacing.lg * 2;

// Les six pays actifs pour le lancement. Prête à en ajouter d'autres
// plus tard sans rien changer d'autre dans l'appli.
const COUNTRIES = [
  { code: 'NE', name: 'Niger', flag: '🇳🇪', available: true },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', available: true },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', available: true },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', available: true },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', available: true },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', available: true },
];

export default function HomeScreen({ navigation }) {
  const { switchMode } = useMode();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [ads, setAds] = useState(FALLBACK_ADS);
  const adListRef = useRef(null);

  const loadAds = useCallback(async () => {
    const { data } = await supabase
      .from('ads')
      .select('*')
      .eq('active', true)
      .order('position', { ascending: true });
    if (data && data.length > 0) setAds(data);
  }, []);

  // Fait défiler le carrousel publicitaire tout seul, une bannière toutes
  // les 4 secondes, et revient au début une fois la dernière atteinte.
  useEffect(() => {
    const interval = setInterval(() => {
      setAdIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % ads.length;
        adListRef.current?.scrollToOffset({ offset: nextIndex * AD_WIDTH, animated: true });
        return nextIndex;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [ads.length]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [sellerRatings, setSellerRatings] = useState({});
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const loadUnreadNotifications = useCallback(async () => {
    const myId = await getDeviceUserId();
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', myId)
      .eq('read', false);
    setHasUnreadNotifications((count || 0) > 0);
  }, []);

  const loadWishlist = useCallback(async () => {
    const myId = await getDeviceUserId();
    const { data } = await supabase.from('wishlist_items').select('listing_id').eq('acheteur_id', myId);
    setWishlistIds(new Set((data || []).map((w) => w.listing_id)));
  }, []);

  const handleToggleWishlist = useCallback(
    async (listing) => {
      const myId = await getDeviceUserId();
      if (wishlistIds.has(listing.id)) {
        await supabase
          .from('wishlist_items')
          .delete()
          .eq('acheteur_id', myId)
          .eq('listing_id', listing.id);
      } else {
        const ok = await ensureAccountComplete(navigation, 'mettre un article de côté');
        if (!ok) return;
        await supabase.from('wishlist_items').insert({ acheteur_id: myId, listing_id: listing.id });
      }
      loadWishlist();
    },
    [wishlistIds, loadWishlist, navigation]
  );

  // Les avis sont liés au vendeur, pas à un article précis : on calcule
  // une moyenne par vendeur en une seule requête, plutôt qu'une par carte.
  const loadSellerRatings = useCallback(async (currentListings) => {
    const vendeurIds = [...new Set(currentListings.map((l) => l.vendeur_id).filter(Boolean))];
    if (vendeurIds.length === 0) return;
    const { data } = await supabase.from('reviews').select('cible_id, note').in('cible_id', vendeurIds);
    const totals = {};
    (data || []).forEach((r) => {
      if (!totals[r.cible_id]) totals[r.cible_id] = { sum: 0, count: 0 };
      totals[r.cible_id].sum += r.note;
      totals[r.cible_id].count += 1;
    });
    const averages = {};
    Object.keys(totals).forEach((id) => {
      averages[id] = totals[id].sum / totals[id].count;
    });
    setSellerRatings(averages);
  }, []);

  const fetchListings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    // Va chercher les annonces réellement enregistrées dans Supabase,
    // les plus récentes en premier.
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'disponible')
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setListings(data);
      loadSellerRatings(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [loadSellerRatings]);

  // Recharge la liste à chaque fois qu'on revient sur cet écran
  // (par exemple juste après avoir publié une annonce, ou ajouté une
  // publicité depuis le tableau de bord admin).
  useFocusEffect(
    useCallback(() => {
      fetchListings();
      loadAds();
      loadWishlist();
      loadUnreadNotifications();
    }, [fetchListings, loadAds, loadWishlist, loadUnreadNotifications])
  );

  const filtered = listings.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategory = !activeCategory || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Nouveautés : les annonces les plus récentes.
  const newArrivals = listings.slice(0, 8);
  // En vedette : d'abord les annonces boostées ou avec une priorité fixée
  // depuis le tableau de bord admin, puis les prix les plus élevés.
  const now = new Date();
  const featured = [...listings]
    .sort((a, b) => {
      const aBoosted = a.boost_until && new Date(a.boost_until) > now;
      const bBoosted = b.boost_until && new Date(b.boost_until) > now;
      if (aBoosted && !bBoosted) return -1;
      if (!aBoosted && bBoosted) return 1;
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return b.price - a.price;
    })
    .slice(0, 8);
  // Une section par catégorie qui a au moins un article, limitée à 8
  // articles chacune sur l'accueil (le reste via "Voir tout").
  const categorySections = categories
    .map((cat) => ({ name: cat, items: listings.filter((l) => l.category === cat).slice(0, 8) }))
    .filter((section) => section.items.length > 0);

  const getSellerRating = (vendeurId) =>
    vendeurId && sellerRatings[vendeurId] !== undefined ? sellerRatings[vendeurId] : undefined;

  const handleSelectCountry = (c) => {
    if (!c.available) {
      setCountryModalVisible(false);
      return;
    }
    setCountry(c);
    setCountryModalVisible(false);
  };

  const goToMenuItem = (screen) => {
    setMenuVisible(false);
    navigation.navigate(screen);
  };

  const handleLogout = () => {
    setMenuVisible(false);
    if (!PHONE_AUTH_ENABLED) {
      Alert.alert(
        'Déconnexion indisponible',
        "La connexion par téléphone est actuellement désactivée pour les tests, il n'y a donc pas de session à quitter. Utilise \"Changer d'identité\" dans Paramètres si tu veux simuler un autre utilisateur."
      );
      return;
    }
    Alert.alert('Déconnexion', 'Veux-tu vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.brandText}>zuno</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Panier')} style={styles.headerIconButton}>
            <Ionicons name="cart-outline" size={22} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.headerIconButton}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.white} />
            {hasUnreadNotifications && <View style={styles.notificationDot} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerIconButton}>
            <Ionicons name="menu-outline" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.subHeader}>
        <TouchableOpacity style={styles.countryPill} onPress={() => setCountryModalVisible(true)}>
          <Text style={styles.countryFlag}>{country.flag}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textPrimary} />
        </TouchableOpacity>
        <TextInput
          placeholder="Rechercher un article"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchListings(true)} />
            }
          >
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={categories}
              keyExtractor={(item) => item}
              style={styles.categoryRow}
              contentContainerStyle={{ gap: spacing.md }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => navigation.navigate('CategoryListing', { category: item })}
                  style={styles.categoryItem}
                >
                  <View style={styles.categoryIcon}>
                    <Ionicons
                      name={CATEGORY_ICONS[item] || 'pricetag-outline'}
                      size={20}
                      color={colors.purple}
                    />
                  </View>
                  <Text style={styles.categoryLabel} numberOfLines={1}>
                    {item.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <FlatList
              ref={adListRef}
              data={ads}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              style={{ marginTop: spacing.lg }}
              onMomentumScrollEnd={(e) => {
                setAdIndex(Math.round(e.nativeEvent.contentOffset.x / AD_WIDTH));
              }}
              renderItem={({ item }) =>
                item.image_url ? (
                  <ImageBackground
                    source={{ uri: item.image_url }}
                    style={[styles.adSlide, { width: AD_WIDTH, backgroundColor: item.color || colors.purple }]}
                    imageStyle={{ borderRadius: radius.md }}
                    resizeMode="cover"
                  >
                    {(item.title || item.subtitle) && (
                      <View style={styles.adTextOverlay}>
                        {item.title ? <Text style={styles.adTitle}>{item.title}</Text> : null}
                        {item.subtitle ? <Text style={styles.adSubtitle}>{item.subtitle}</Text> : null}
                      </View>
                    )}
                  </ImageBackground>
                ) : (
                  <View style={[styles.adSlide, { width: AD_WIDTH, backgroundColor: item.color || colors.purple }]}>
                    {item.title ? <Text style={styles.adTitle}>{item.title}</Text> : null}
                    {item.subtitle ? <Text style={styles.adSubtitle}>{item.subtitle}</Text> : null}
                  </View>
                )
              }
            />
            <View style={styles.dotsRow}>
              {ads.map((_, i) => (
                <View key={i} style={[styles.dot, i === adIndex && styles.dotActive]} />
              ))}
            </View>

            {search.trim() ? (
              <MasonrySection
                title="Résultats"
                items={filtered}
                getSellerRating={getSellerRating}
                wishlistIds={wishlistIds}
                onToggleWishlist={handleToggleWishlist}
                onPressItem={(item) => navigation.navigate('ProductDetail', { listing: item })}
              />
            ) : (
              <>
                <MasonrySection
                  title="Articles en vedette"
                  items={featured}
                  onSeeAll={() => navigation.navigate('Tendances')}
                  getSellerRating={getSellerRating}
                  wishlistIds={wishlistIds}
                  onToggleWishlist={handleToggleWishlist}
                  onPressItem={(item) => navigation.navigate('ProductDetail', { listing: item })}
                />

                <MasonrySection
                  title="Nouveaux articles"
                  items={newArrivals}
                  onSeeAll={() => navigation.navigate('Tendances')}
                  getSellerRating={getSellerRating}
                  wishlistIds={wishlistIds}
                  onToggleWishlist={handleToggleWishlist}
                  onPressItem={(item) => navigation.navigate('ProductDetail', { listing: item })}
                />

                {categorySections.map((section) => (
                  <MasonrySection
                    key={section.name}
                    title={section.name}
                    items={section.items}
                    onSeeAll={() => navigation.navigate('CategoryListing', { category: section.name })}
                    getSellerRating={getSellerRating}
                    wishlistIds={wishlistIds}
                    onToggleWishlist={handleToggleWishlist}
                    onPressItem={(item) => navigation.navigate('ProductDetail', { listing: item })}
                  />
                ))}

                {listings.length === 0 && (
                  <Text style={styles.emptyText}>
                    Aucune annonce pour l'instant. Sois le premier à en publier une !
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>

      {/* Sélection du pays */}
      <Modal
        visible={countryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCountryModalVisible(false)}
        >
          <View style={styles.countrySheet}>
            <Text style={styles.sheetTitle}>Choisir un pays</Text>
            {COUNTRIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={styles.countryRow}
                onPress={() => handleSelectCountry(c)}
              >
                <Text style={styles.countryFlag}>{c.flag}</Text>
                <Text style={[styles.countryName, !c.available && styles.countryNameDisabled]}>
                  {c.name}
                </Text>
                {c.code === country.code && (
                  <Ionicons name="checkmark" size={18} color={colors.orange} />
                )}
                {!c.available && <Text style={styles.comingSoon}>Bientôt</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Menu Profil / Paramètres / Déconnexion */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuRow} onPress={() => goToMenuItem('PostListing')}>
              <Ionicons name="add-circle-outline" size={18} color={colors.orange} />
              <Text style={[styles.menuLabel, { color: colors.orange, fontWeight: '700' }]}>
                Déposer une annonce
              </Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setMenuVisible(false);
                switchMode('marchand');
              }}
            >
              <Ionicons name="storefront-outline" size={18} color={colors.purple} />
              <Text style={styles.menuLabel}>Passer en mode marchand</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuRow} onPress={() => goToMenuItem('MessagesList')}>
              <Ionicons name="mail-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.menuLabel}>Messages</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => goToMenuItem('Moi')}>
              <Ionicons name="person-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.menuLabel}>Profil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => goToMenuItem('Settings')}>
              <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.menuLabel}>Paramètres</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={[styles.menuLabel, { color: colors.danger }]}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.purple,
    paddingTop: 50,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 26, height: 26, borderRadius: 7 },
  brandText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIconButton: { padding: 2, position: 'relative' },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.purple,
  },
  subHeader: {
    backgroundColor: colors.purple,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 44,
    paddingHorizontal: spacing.sm,
  },
  countryFlag: { fontSize: 18 },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  categoryRow: { flexGrow: 0 },
  categoryItem: { alignItems: 'center', width: 64 },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  categoryIconActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  categoryLabel: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  categoryLabelActive: { color: colors.orange, fontWeight: '700' },
  adSlide: {
    height: 110,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  adTextOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  adTitle: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  adSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.orange, width: 16 },
  sliderSection: { marginTop: spacing.lg },
  sliderTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  gridCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  gridThumb: {
    width: '100%',
    height: 110,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  sliderCard: {
    width: 120,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  sliderThumb: {
    width: '100%',
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  sliderThumbImage: { width: '100%', height: '100%' },
  sliderCardTitle: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  sliderCardPrice: { fontSize: 12, color: colors.orange, fontWeight: '700', marginTop: 2 },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
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
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xl,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  countrySheet: {
    position: 'absolute',
    top: 100,
    left: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    width: 220,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  countryName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  countryNameDisabled: { color: colors.textMuted },
  comingSoon: { fontSize: 10, color: colors.textMuted },
  menuSheet: {
    position: 'absolute',
    top: 95,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    width: 190,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  menuLabel: { fontSize: 14, color: colors.textPrimary },
});
