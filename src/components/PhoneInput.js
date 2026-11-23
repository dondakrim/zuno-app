import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { COUNTRIES, DEFAULT_COUNTRY } from '../data/countries';

// Découpe une valeur déjà stockée (ex: "+225 07 00 00 00 00") pour
// retrouver le pays correspondant et la partie locale du numéro, afin de
// pré-remplir correctement le champ quand on modifie un numéro existant.
function splitValue(value) {
  if (!value) return { country: DEFAULT_COUNTRY, local: '' };
  const found = COUNTRIES.find((c) => value.startsWith(c.dialCode));
  if (found) {
    return { country: found, local: value.slice(found.dialCode.length).trim() };
  }
  return { country: DEFAULT_COUNTRY, local: value };
}

export default function PhoneInput({ value, onChangeValue, placeholder }) {
  const initial = splitValue(value);
  const [country, setCountry] = useState(initial.country);
  const [local, setLocal] = useState(initial.local);
  const [showPicker, setShowPicker] = useState(false);

  // Si la valeur change depuis l'extérieur (par exemple au chargement
  // d'un profil existant, après un appel réseau), on se resynchronise.
  useEffect(() => {
    const parsed = splitValue(value);
    setCountry(parsed.country);
    setLocal(parsed.local);
  }, [value]);

  const updateLocal = (text) => {
    setLocal(text);
    onChangeValue(`${country.dialCode} ${text}`.trim());
  };

  const selectCountry = (c) => {
    setCountry(c);
    setShowPicker(false);
    onChangeValue(`${c.dialCode} ${local}`.trim());
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.countryButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.flag}>{country.flag}</Text>
        <Text style={styles.dialCode}>{country.dialCode}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </TouchableOpacity>
      <TextInput
        placeholder={placeholder || '90 00 00 00'}
        placeholderTextColor={colors.textMuted}
        value={local}
        onChangeText={updateLocal}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choisis un pays</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.countryRow} onPress={() => selectCountry(item)}>
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.dialCode}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 44,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  flag: { fontSize: 16 },
  dialCode: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 44,
    paddingHorizontal: spacing.md,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '60%',
  },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryName: { flex: 1, fontSize: 14, color: colors.textPrimary },
});
