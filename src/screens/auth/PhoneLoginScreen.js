import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

// Indicatif du Niger. On pourra proposer plusieurs pays plus tard.
const COUNTRY_CODE = '+227';

export default function PhoneLoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const digits = phone.replace(/\s/g, '');
    if (digits.length < 8) {
      Alert.alert('Numéro invalide', 'Vérifie ton numéro de téléphone.');
      return;
    }
    const fullPhone = COUNTRY_CODE + digits;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setSending(false);

    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    navigation.navigate('OtpVerify', { phone: fullPhone });
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoLetter}>Z</Text>
        </View>
        <Text style={styles.brand}>zuno</Text>
      </View>

      <Text style={styles.title}>Connexion</Text>
      <Text style={styles.subtitle}>
        Entre ton numéro de téléphone, on t'envoie un code par SMS.
      </Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>{COUNTRY_CODE}</Text>
        <TextInput
          placeholder="90 00 00 00"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSend} disabled={sending}>
        <Text style={styles.buttonText}>{sending ? 'Envoi…' : 'Recevoir le code'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  logoIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: colors.white, fontWeight: '700', fontSize: 17 },
  brand: { color: colors.purple, fontWeight: '700', fontSize: 22 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  prefix: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, height: 48, textAlignVertical: 'center',
    fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface, lineHeight: 46,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    height: 48, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 15,
  },
  button: { backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
