import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';

const CONDITION_INFO = {
  Neuf: { icon: 'sparkles', color: colors.success },
  'Bon état': { icon: 'checkmark-circle', color: colors.purple },
  Usé: { icon: 'time', color: colors.textMuted },
};

// Carte utilisée dans toutes les grilles de l'accueil (en vedette,
// nouveautés, sections par catégorie). sellerRating est la note MOYENNE DU
// VENDEUR (les avis sont liés au vendeur, pas à un article précis dans
// Zuno) — c'est la meilleure approximation disponible d'une note par
// article.
export default function ProductCard({ listing, sellerRating, isWishlisted, onToggleWishlist, onPress }) {
  const hasPromo = listing.promo_price && Number(listing.promo_price) < Number(listing.price);
  const conditionInfo = CONDITION_INFO[listing.condition];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageWrapper}>
        {listing.photo_url ? (
          <Image source={{ uri: listing.photo_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={26} color={colors.textMuted} />
          </View>
        )}

        {hasPromo && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>Promo</Text>
          </View>
        )}

        {conditionInfo && (
          <View style={[styles.conditionBadge, hasPromo && { top: 28 }]}>
            <Ionicons name={conditionInfo.icon} size={10} color={conditionInfo.color} />
            <Text style={[styles.conditionBadgeText, { color: conditionInfo.color }]}>
              {listing.condition}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.heartButton}
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleWishlist?.();
          }}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={16}
            color={isWishlisted ? colors.orange : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {typeof sellerRating === 'number' && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#F5A623" />
          <Text style={styles.ratingText}>{sellerRating.toFixed(1)}</Text>
        </View>
      )}

      <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>

      <View style={styles.priceRow}>
        {hasPromo && (
          <Text style={styles.oldPrice}>
            {Number(listing.price).toLocaleString('fr-FR')} FCFA
          </Text>
        )}
        <Text style={styles.price}>
          {Number(hasPromo ? listing.promo_price : listing.price).toLocaleString('fr-FR')} FCFA
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 4 / 3.4,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  promoBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.orange,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promoBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  conditionBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  conditionBadgeText: { fontSize: 9, fontWeight: '700' },
  heartButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  ratingText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  title: { fontSize: 13, color: colors.textPrimary, lineHeight: 17, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  oldPrice: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  price: { fontSize: 14, fontWeight: '700', color: colors.orange },
});
