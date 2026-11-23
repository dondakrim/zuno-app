// Bandeau violet dégradé commun à toutes les pages — src/components/GradientHeader.js
// Dégradé fait avec de fines bandes de couleur : aucune bibliothèque native,
// donc compatible avec EAS Update.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const FROM = [30, 7, 99];   // #1E0763
const TO = [91, 33, 201];   // #5B21C9
const BANDS = 36;

const bandColor = (i) => {
  const t = i / (BANDS - 1);
  const c = FROM.map((v, k) => Math.round(v + (TO[k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// Utilisation :
//   <GradientHeader style={{ paddingTop: 56, paddingBottom: 40, paddingHorizontal: 20 }}>
//     ...contenu...
//   </GradientHeader>
export default function GradientHeader({ children, style, glow = true }) {
  return (
    <View style={[s.wrap, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: BANDS }).map((_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: bandColor(i) }} />
        ))}
      </View>
      {glow ? <View style={s.glowOrange} pointerEvents="none" /> : null}
      {glow ? <View style={s.glowWhite} pointerEvents="none" /> : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.purple },
  glowOrange: { position: 'absolute', right: -70, top: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.orange, opacity: 0.18 },
  glowWhite: { position: 'absolute', left: -80, bottom: -100, width: 220, height: 220, borderRadius: 110, backgroundColor: '#fff', opacity: 0.08 },
});