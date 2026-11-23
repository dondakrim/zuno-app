import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius } from '../../theme/colors';
import { categories } from '../../data/mockListings';
import { supabase } from '../../lib/supabase';
import { getDeviceUserId } from '../../lib/deviceUser';
import { registerForPushNotifications } from '../../lib/pushNotifications';

const CATEGORY_ICONS = {
  'Mode et vêtements': 'shirt-outline',
  'Électronique et téléphones': 'phone-portrait-outline',
  'Maison et électroménager': 'home-outline',
  'Véhicules et pièces': 'car-outline',
  Autres: 'pricetag-outline',
};

const MIN_INTERESTS = 3;

export default function InterestsScreen({ onDone }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (cat) => {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleContinue = async () => {
    if (selected.length < MIN_INTERESTS) {
      Alert.alert(
        'Encore un peu',
        `Choisis au moins ${MIN_INTERESTS} centres d'intérêt pour continuer (${selected.length}/${MIN_INTERESTS} pour l'instant).`
      );
      return;
    }

    setSaving(true);
    const myId = await getDeviceUserId();

    await supabase.from('users').update({ interets: selected }).eq('id', myId);
    await AsyncStorage.setItem('zuno_onboarding_done', 'true');
    await registerForPushNotifications();

    setSaving(false);
    onDone();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoLetter}>Z</Text>
        </View>
        <Text style={styles.brand}>zuno</Text>
      </View>

      <Text style={styles.title}>Qu'est-ce qui t'intéresse ?</Text>
      <Text style={styles.subtitle}>
        Choisis au moins {MIN_INTERESTS} centres d'intérêt pour qu'on te préviennent des
        nouveautés et des tendances qui te correspondent.
      </Text>

      <View style={styles.grid}>
        {categories.map((cat) => {
          const active = selected.includes(cat);
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.tile, active && styles.tileActive]}
              onPress={() => toggle(cat)}
            >
              <Ionicons
                name={CATEGORY_ICONS[cat] || 'pricetag-outline'}
                size={26}
                color={active ? colors.white : colors.purple}
              />
              <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>{cat}</Text>
              {active && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.counter}>
        {selected.length}/{MIN_INTERESTS} sélectionnés
      </Text>

      <TouchableOpacity
        style={[styles.continueButton, selected.length < MIN_INTERESTS && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={saving}
      >
        <Text style={styles.continueButtonText}>{saving ? 'Un instant…' : 'Continuer'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: 70 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  logoIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: colors.white, fontWeight: '700', fontSize: 15 },
  brand: { color: colors.purple, fontWeight: '700', fontSize: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 19 },
  grid: { gap: spacing.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    position: 'relative',
  },
  tileActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  tileLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  tileLabelActive: { color: colors.white },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginVertical: spacing.md },
  continueButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
