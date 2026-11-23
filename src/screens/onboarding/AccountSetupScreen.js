import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { getDeviceUserId } from '../../lib/deviceUser';
import PhoneInput from '../../components/PhoneInput';
import { DEFAULT_COUNTRY } from '../../data/countries';

export default function AccountSetupScreen({ onDone, navigation }) {
  // Utilisé à deux endroits : pendant l'accueil initial (onDone fourni
  // directement en prop), ou ouvert depuis une action de l'appli (achat,
  // publication, favori...) via la navigation classique, avec un simple
  // retour en arrière une fois terminé.
  const finish = onDone || (() => navigation?.goBack());
  const [telephone, setTelephone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    const finalWhatsapp = sameAsPhone ? telephone.trim() : whatsapp.trim();

    if (telephone.replace(/\D/g, '').length < 7) {
      Alert.alert('Numéro invalide', 'Indique un numéro de téléphone valide.');
      return;
    }
    if (finalWhatsapp.replace(/\D/g, '').length < 7) {
      Alert.alert('Numéro WhatsApp invalide', 'Indique un numéro WhatsApp valide.');
      return;
    }
    if (email.trim() && !email.includes('@')) {
      Alert.alert('Email invalide', "L'adresse email ne semble pas valide.");
      return;
    }

    setSaving(true);
    const myId = await getDeviceUserId();
    const { error } = await supabase
      .from('users')
      .update({
        telephone: telephone.trim(),
        whatsapp: finalWhatsapp,
        email: email.trim() || null,
      })
      .eq('id', myId);
    setSaving(false);

    if (error) {
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }

    finish();
  };

  return (
    <View style={styles.container}>
      {navigation && (
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoLetter}>Z</Text>
        </View>
        <Text style={styles.brand}>zuno</Text>
      </View>

      <Text style={styles.title}>Crée ton compte</Text>
      <Text style={styles.subtitle}>
        Ton numéro de téléphone et ton numéro WhatsApp sont nécessaires pour que les autres
        utilisateurs puissent te contacter facilement.
      </Text>

      <Text style={styles.label}>Numéro de téléphone</Text>
      <PhoneInput value={telephone} onChangeValue={setTelephone} />

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setSameAsPhone((v) => !v)}>
        <Ionicons
          name={sameAsPhone ? 'checkbox' : 'square-outline'}
          size={20}
          color={sameAsPhone ? colors.orange : colors.textMuted}
        />
        <Text style={styles.checkboxText}>Mon numéro WhatsApp est le même</Text>
      </TouchableOpacity>

      {!sameAsPhone && (
        <>
          <Text style={styles.label}>Numéro WhatsApp</Text>
          <PhoneInput value={whatsapp} onChangeValue={setWhatsapp} />
        </>
      )}

      <Text style={styles.label}>Adresse email (facultatif)</Text>
      <TextInput
        placeholder="toi@exemple.com"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={saving}>
        <Text style={styles.continueButtonText}>{saving ? 'Un instant…' : 'Continuer'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: 70 },
  backButton: { position: 'absolute', top: 50, left: spacing.lg, zIndex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  logoIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: colors.white, fontWeight: '700', fontSize: 15 },
  brand: { color: colors.purple, fontWeight: '700', fontSize: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 46,
    paddingHorizontal: spacing.md,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  checkboxText: { fontSize: 13, color: colors.textSecondary },
  continueButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  continueButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
