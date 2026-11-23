import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Avatars proposés dans "Modifier mon profil" : emojis et personnages, sur un
// fond pastel. L'avatar est enregistré dans la colonne avatar_icon sous la
// forme "emoji:🦁" (aucun changement de base de données). Les anciens
// avatars (noms d'icônes comme "paw") continuent de s'afficher normalement.
export const AVATAR_PALETTE = [
  { icon: 'emoji:🧑🏿', color: '#FDE8D4' },
  { icon: 'emoji:🧑🏾', color: '#E3F2FD' },
  { icon: 'emoji:🧑🏽', color: '#FDE2EC' },
  { icon: 'emoji:👩🏿', color: '#EDE7F6' },
  { icon: 'emoji:👩🏾', color: '#FFF3D6' },
  { icon: 'emoji:👩🏽', color: '#E0F5EC' },
  { icon: 'emoji:👨🏿', color: '#E0F5EC' },
  { icon: 'emoji:👨🏾', color: '#FDE8D4' },
  { icon: 'emoji:👨🏽', color: '#E3F2FD' },
  { icon: 'emoji:🧕🏾', color: '#FDE2EC' },
  { icon: 'emoji:🧕🏿', color: '#EDE7F6' },
  { icon: 'emoji:👳🏾', color: '#FFF3D6' },
  { icon: 'emoji:👴🏾', color: '#E3F2FD' },
  { icon: 'emoji:👵🏾', color: '#FDE2EC' },
  { icon: 'emoji:👧🏾', color: '#FFF3D6' },
  { icon: 'emoji:👦🏿', color: '#E0F5EC' },
  { icon: 'emoji:👶🏿', color: '#EDE7F6' },
  { icon: 'emoji:🧔🏿', color: '#FDE8D4' },
  { icon: 'emoji:🦁', color: '#FFF3D6' },
  { icon: 'emoji:🐪', color: '#FDE8D4' },
  { icon: 'emoji:🐘', color: '#E3F2FD' },
  { icon: 'emoji:🦒', color: '#FFF3D6' },
  { icon: 'emoji:🐎', color: '#EDE7F6' },
  { icon: 'emoji:🐐', color: '#E0F5EC' },
  { icon: 'emoji:🦅', color: '#E3F2FD' },
  { icon: 'emoji:🐊', color: '#E0F5EC' },
  { icon: 'emoji:🦓', color: '#EDE7F6' },
  { icon: 'emoji:🐆', color: '#FFF3D6' },
  { icon: 'emoji:🌴', color: '#E0F5EC' },
  { icon: 'emoji:🌍', color: '#E3F2FD' },
  { icon: 'emoji:🌅', color: '#FDE8D4' },
  { icon: 'emoji:🌵', color: '#E0F5EC' },
  { icon: 'emoji:🌺', color: '#FDE2EC' },
  { icon: 'emoji:🌙', color: '#EDE7F6' },
  { icon: 'emoji:⚽', color: '#E0F5EC' },
  { icon: 'emoji:☕', color: '#FDE8D4' },
  { icon: 'emoji:🚀', color: '#E3F2FD' },
  { icon: 'emoji:💎', color: '#EDE7F6' },
  { icon: 'emoji:🎧', color: '#FDE2EC' },
  { icon: 'emoji:📱', color: '#E3F2FD' },
  { icon: 'emoji:🛍️', color: '#FFF3D6' },
  { icon: 'emoji:🧿', color: '#E3F2FD' },
  { icon: 'emoji:⭐', color: '#FFF3D6' },
  { icon: 'emoji:🔥', color: '#FDE8D4' },
  { icon: 'emoji:👑', color: '#FFF3D6' },
  { icon: 'emoji:🎨', color: '#FDE2EC' },
];

export const isEmojiAvatar = (icon) => typeof icon === 'string' && icon.indexOf('emoji:') === 0;

// Dessine le contenu d'un avatar : un emoji ou une ancienne icône.
// "size" est la taille que l'on donnerait à une icône ; l'emoji s'adapte.
export function AvatarGlyph({ icon, size = 24, color = colors.white }) {
  if (isEmojiAvatar(icon)) {
    return (
      <Text
        allowFontScaling={false}
        style={{ fontSize: size * 1.1, lineHeight: size * 1.35, textAlign: 'center', includeFontPadding: false }}
      >
        {icon.slice(6)}
      </Text>
    );
  }
  return <Ionicons name={icon} size={size} color={color} />;
}

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
        <AvatarGlyph icon={avatarIcon} size={size * (isEmojiAvatar(avatarIcon) ? 0.52 : 0.55)} />
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
