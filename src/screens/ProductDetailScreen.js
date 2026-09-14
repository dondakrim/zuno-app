import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

const screenWidth = Dimensions.get('window').width;
const GALLERY_WIDTH = screenWidth - spacing.lg * 2;

export default function ProductDetailScreen({ route, navigation }) {
  const { listing } = route.params;
  const [activeIndex, setActiveIndex] = useState(0);
  const [similar, setSimilar] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  // Les annonces publiées avant l'ajout du carrousel n'ont qu'une seule
  // photo (photo_url) : on retombe dessus si `photos` n'existe pas.
  const gallery = listing.photos?.length ? listing.photos : listing.photo_url ? [listing.photo_url] : [];
  // Les annonces créées avant la connexion par téléphone n'ont pas
  // encore de vendeur identifié : on affiche un repère temporaire.
  const seller = listing.seller || { name: 'Vendeur Zuno', rating: 5, sales: 0, initials: 'VZ' };

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

  useEffect(() => {
    let cancelled = false;
    async function loadSimilar() {
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('category', listing.category)
        .eq('status', 'disponible')
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

  const handleBuy = () => {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md }}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </TouchableOpacity>

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

      <Text style={styles.title}>{listing.title}</Text>
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
          <Text style={styles.avatarText}>{seller.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sellerName}>{seller.name}</Text>
          <Text style={styles.sellerMeta}>
            {seller.rating} · {seller.sales} ventes
          </Text>
        </View>
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
  },
  avatarText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  sellerName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sellerMeta: { fontSize: 12, color: colors.textSecondary },
  favoriteButton: { padding: spacing.xs },
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
