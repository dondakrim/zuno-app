import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// La palette proposée dans "Modifier mon profil" — icône + couleur de
// fond, comme alternative à une vraie photo. Réutilisée aussi pour
// l'affichage (ProfileScreen, fiche produit...).
export const AVATAR_PALETTE = [
  { icon: 'person', color: colors.purple },
  { icon: 'happy', color: colors.orange },
  { icon: 'sparkles', color: colors.success },
  { icon: 'planet', color: '#0B6BA8' },
  { icon: 'paw', color: '#8B5CF6' },
  { icon: 'leaf', color: '#16A34A' },
  { icon: 'flame', color: '#DC2626' },
  { icon: 'star', color: '#D97706' },
  { icon: 'rocket', color: '#0891B2' },
  { icon: 'flower', color: '#DB2777' },
  { icon: 'football', color: '#65A30D' },
  { icon: 'diamond', color: '#4F46E5' },
];

export default function Avatar({ photoUrl, avatarIcon, avatarColor, size = 56 }) {
  const style = [
    styles.circle,
    { width: size, height: size, borderRadius: size / 2 },
  ];

  if (photoUrl) {
    return (
      <View style={style}>
        <Image source={{ uri: photoUrl }} style={styles.image} />
      </View>
    );
  }

  if (avatarIcon) {
    return (
      <View style={[style, { backgroundColor: avatarColor || colors.purple }]}>
        <Ionicons name={avatarIcon} size={size * 0.55} color={colors.white} />
      </View>
    );
  }

  return (
    <View style={[style, { backgroundColor: colors.orange }]}>
      <Ionicons name="person" size={size * 0.5} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
