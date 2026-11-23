import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import ProductCard from './ProductCard';

// Répartit les articles en deux colonnes en alternant un sur deux : chaque
// carte garde la hauteur de son propre contenu (titre sur 1 ou 2 lignes),
// donc les deux colonnes se décalent naturellement, comme sur Pinterest —
// sans avoir besoin d'une vraie librairie de mise en page en briques.
function splitIntoColumns(items) {
  const left = [];
  const right = [];
  items.forEach((item, i) => (i % 2 === 0 ? left : right).push(item));
  return [left, right];
}

export default function MasonrySection({ title, items, onSeeAll, getSellerRating, wishlistIds, onToggleWishlist, onPressItem }) {
  if (!items || items.length === 0) return null;
  const [left, right] = splitIntoColumns(items);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity style={styles.seeAll} onPress={onSeeAll}>
            <Text style={styles.seeAllText}>Voir tout</Text>
            <View style={styles.seeAllArrowCircle}>
              <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          {left.map((item) => (
            <ProductCard
              key={item.id}
              listing={item}
              sellerRating={getSellerRating?.(item.vendeur_id)}
              isWishlisted={wishlistIds?.has(item.id)}
              onToggleWishlist={() => onToggleWishlist?.(item)}
              onPress={() => onPressItem?.(item)}
            />
          ))}
        </View>
        <View style={styles.column}>
          {right.map((item) => (
            <ProductCard
              key={item.id}
              listing={item}
              sellerRating={getSellerRating?.(item.vendeur_id)}
              isWishlisted={wishlistIds?.has(item.id)}
              onToggleWishlist={() => onToggleWishlist?.(item)}
              onPress={() => onPressItem?.(item)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontSize: 12, fontWeight: '600', color: colors.purple },
  seeAllArrowCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columns: { flexDirection: 'row', gap: spacing.sm },
  column: { flex: 1 },
});
