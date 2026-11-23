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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { categories as DEFAULT_CATEGORIES } from '../data/mockListings';
import { supabase } from '../lib/supabase';
import { useMode } from '../context/ModeContext';
import { PHONE_AUTH_ENABLED } from '../config';
import { getDeviceUserId, ensureAccountComplete } from '../lib/deviceUser';
import MasonrySection from '../components/MasonrySection';
import GradientHeader from '../components/GradientHeader';
import EventsSection from '../components/EventsSection';
import ServiceRequests from '../components/ServiceRequests';
import { useCategories, useCategoryTree } from '../lib/useCategories';

// Fonds doux alternés pour les pastilles de catégories.
const CATEGORY_TINTS = ['#EEE9FF', '#FFF0E3', '#E4F5EE', '#E6F0FB', '#FCE9F1', '#FFF6D9'];

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
  // Catégories pilotées par le tableau de bord (liste intégrée tant qu'il est vide).
  const categories = useCategories(DEFAULT_CATEGORIES);
  const categoryTree = useCategoryTree();
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
      .in('placement', ['tous', 'accueil'])
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
  const [menuProfile, setMenuProfile] = useState(null);
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

  // Les avis sont liés aux commandes : la vue `seller_ratings` (base de données)
  // calcule la moyenne par vendeur, sans les avis masqués.
  const loadSellerRatings = useCallback(async (currentListings) => {
    const vendeurIds = [...new Set(currentListings.map((l) => l.vendeur_id).filter(Boolean))];
    if (vendeurIds.length === 0) return;
    const { data } = await supabase.from('seller_ratings').select('vendeur_id, avg_note').in('vendeur_id', vendeurIds);
    const averages = {};
    (data || []).forEach((r) => {
      averages[r.vendeur_id] = Number(r.avg_note);
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
      // Ensuite, les annonces du pays choisi passent avant les autres.
      const aHere = a.country === country.code;
      const bHere = b.country === country.code;
      if (aHere && !bHere) return -1;
      if (!aHere && bHere) return 1;
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
    AsyncStorage.setItem('zuno_country', c.code).catch(() => {});
  };

  // Retrouve le pays choisi lors d'une précédente visite.
  useEffect(() => {
    AsyncStorage.getItem('zuno_country')
      .then((code) => {
        const saved = COUNTRIES.find((c) => c.code === code && c.available);
        if (saved) setCountry(saved);
      })
      .catch(() => {});
  }, []);

  const openMenu = async () => {
    setMenuVisible(true);
    try {
      const myId = await getDeviceUserId();
      const { data } = await supabase
        .from('users')
        .select('nom, photo_url, avatar_icon, avatar_color, merchant_status')
        .eq('id', myId)
        .maybeSingle();
      if (data) setMenuProfile(data);
    } catch (e) {
      // on garde le menu sans photo si le chargement échoue
    }
  };

  const goToAccount = () => {
    setMenuVisible(false);
    navigation.navigate('Moi', { screen: 'Account' });
  };

  const onMerchantMenu = () => {
    setMenuVisible(false);
    if (menuProfile?.merchant_status === 'actif') {
      switchMode('marchand');
    } else {
      navigation.navigate('Moi', { screen: 'BecomeMerchant' });
    }
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
      <GradientHeader>
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
          <TouchableOpacity onPress={openMenu} style={styles.headerIconButton}>
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

      </GradientHeader>

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
              contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
              renderItem={({ item, index }) => {
                const dbIcon = categoryTree.find((c) => c.label === item)?.icon;
                const tint = CATEGORY_TINTS[index % CATEGORY_TINTS.length];
                return (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('CategoryListing', { category: item })}
                    style={styles.categoryItem}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: tint }]}>
                      {dbIcon ? (
                        <Text style={styles.categoryEmoji}>{dbIcon}</Text>
                      ) : (
                        <Ionicons
                          name={CATEGORY_ICONS[item] || 'pricetag-outline'}
                          size={24}
                          color={colors.purple}
                        />
                      )}
                    </View>
                    <Text style={styles.categoryLabel} numberOfLines={2}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <ServiceRequests navigation={navigation} defaultCountry={country?.code} />

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
                <EventsSection
                  getSellerRating={getSellerRating}
                  wishlistIds={wishlistIds}
                  onToggleWishlist={handleToggleWishlist}
                  onPressItem={(item) => navigation.navigate('ProductDetail', { listing: item })}
                />

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

      {/* Menu principal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.menuPanel}>
            <GradientHeader style={styles.menuHead}>
              <View style={styles.menuAvatar}>
                {menuProfile?.avatar_icon ? (
                  <View style={[styles.menuAvatarFill, { backgroundColor: menuProfile.avatar_color }]}>
                    <Ionicons name={menuProfile.avatar_icon} size={22} color={colors.white} />
                  </View>
                ) : menuProfile?.photo_url ? (
                  <Image source={{ uri: menuProfile.photo_url }} style={styles.menuAvatarImg} />
                ) : (
                  <Ionicons name="person" size={22} color={colors.white} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuName} numberOfLines={1}>
                  {menuProfile?.nom && menuProfile.nom !== 'Toi (test)' ? menuProfile.nom : 'Bienvenue sur Zuno'}
                </Text>
                <Text style={styles.menuSub}>
                  {menuProfile?.merchant_status === 'actif' ? 'Compte marchand' : 'Compte particulier'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMenuVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </GradientHeader>

            <TouchableOpacity
              style={styles.menuCta}
              activeOpacity={0.85}
              onPress={() => goToMenuItem('PostListing')}
            >
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.menuCtaText}>Déposer une annonce</Text>
            </TouchableOpacity>

            <View style={styles.menuList}>
              <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('MessagesList')}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.orange} />
                </View>
                <Text style={styles.menuItemLabel}>Messages</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Moi')}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name="person-outline" size={18} color={colors.orange} />
                </View>
                <Text style={styles.menuItemLabel}>Mon profil</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); navigation.navigate('Moi', { screen: 'MyOrders' }); }}
              >
                <View style={styles.menuItemIcon}>
                  <Ionicons name="receipt-outline" size={18} color={colors.orange} />
                </View>
                <Text style={styles.menuItemLabel}>Mes commandes</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={onMerchantMenu}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name="storefront-outline" size={18} color={colors.orange} />
                </View>
                <Text style={styles.menuItemLabel}>
                  {menuProfile?.merchant_status === 'actif'
                    ? 'Passer en mode marchand'
                    : menuProfile?.merchant_status === 'demande'
                    ? 'Demande marchand en cours'
                    : 'Devenir marchand'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={goToAccount}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name="apps-outline" size={18} color={colors.orange} />
                </View>
                <Text style={styles.menuItemLabel}>Compte, aide et infos</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Settings')}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name="settings-outline" size={18} color={colors.orange} />
                </View>
                <Text style={styles.menuItemLabel}>Paramètres</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.menuLogout} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={styles.menuLogoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
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
  categoryItem: { alignItems: 'center', width: 76 },
  categoryIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryEmoji: { fontSize: 26 },
  categoryIconActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  categoryLabel: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', lineHeight: 14, minHeight: 28 },
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
  menuOverlay: { flex: 1, backgroundColor: 'rgba(15,5,50,0.45)' },
  menuPanel: {
    position: 'absolute',
    top: 56,
    right: spacing.md,
    width: 292,
    backgroundColor: colors.surface,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  menuHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  menuAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.orange,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  menuAvatarImg: { width: '100%', height: '100%' },
  menuAvatarFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  menuName: { color: colors.white, fontSize: 15, fontWeight: '800' },
  menuSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, marginTop: 1 },
  menuCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingVertical: 12,
  },
  menuCtaText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  menuList: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.xs,
  },
  menuItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.tintOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  menuLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingVertical: 14,
  },
  menuLogoutText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
});
