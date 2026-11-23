import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

// Pays proposés (Niger en premier, puis la sous-région, l'Afrique, la diaspora).
// trunk: true = le numéro local peut commencer par un 0 à retirer (ex. 06… en France).
const COUNTRIES = [
  { name: 'Niger', code: '227', flag: '🇳🇪' },
  { name: 'Nigeria', code: '234', flag: '🇳🇬', trunk: true },
  { name: 'Bénin', code: '229', flag: '🇧🇯' },
  { name: 'Burkina Faso', code: '226', flag: '🇧🇫' },
  { name: 'Mali', code: '223', flag: '🇲🇱' },
  { name: 'Togo', code: '228', flag: '🇹🇬' },
  { name: "Côte d'Ivoire", code: '225', flag: '🇨🇮' },
  { name: 'Ghana', code: '233', flag: '🇬🇭', trunk: true },
  { name: 'Sénégal', code: '221', flag: '🇸🇳' },
  { name: 'Guinée', code: '224', flag: '🇬🇳' },
  { name: 'Mauritanie', code: '222', flag: '🇲🇷' },
  { name: 'Gambie', code: '220', flag: '🇬🇲' },
  { name: 'Guinée-Bissau', code: '245', flag: '🇬🇼' },
  { name: 'Sierra Leone', code: '232', flag: '🇸🇱', trunk: true },
  { name: 'Liberia', code: '231', flag: '🇱🇷' },
  { name: 'Cap-Vert', code: '238', flag: '🇨🇻' },
  { name: 'Cameroun', code: '237', flag: '🇨🇲' },
  { name: 'Tchad', code: '235', flag: '🇹🇩' },
  { name: 'Gabon', code: '241', flag: '🇬🇦' },
  { name: 'Congo', code: '242', flag: '🇨🇬' },
  { name: 'RD Congo', code: '243', flag: '🇨🇩', trunk: true },
  { name: 'Algérie', code: '213', flag: '🇩🇿', trunk: true },
  { name: 'Maroc', code: '212', flag: '🇲🇦', trunk: true },
  { name: 'Tunisie', code: '216', flag: '🇹🇳' },
  { name: 'Libye', code: '218', flag: '🇱🇾', trunk: true },
  { name: 'Égypte', code: '20', flag: '🇪🇬', trunk: true },
  { name: 'France', code: '33', flag: '🇫🇷', trunk: true },
  { name: 'Belgique', code: '32', flag: '🇧🇪', trunk: true },
  { name: 'Allemagne', code: '49', flag: '🇩🇪', trunk: true },
  { name: 'Italie', code: '39', flag: '🇮🇹' },
  { name: 'Espagne', code: '34', flag: '🇪🇸' },
  { name: 'Royaume-Uni', code: '44', flag: '🇬🇧', trunk: true },
  { name: 'États-Unis / Canada', code: '1', flag: '🇺🇸' },
  { name: 'Turquie', code: '90', flag: '🇹🇷', trunk: true },
  { name: 'Arabie saoudite', code: '966', flag: '🇸🇦', trunk: true },
  { name: 'Émirats arabes unis', code: '971', flag: '🇦🇪', trunk: true },
  { name: 'Chine', code: '86', flag: '🇨🇳', trunk: true },
];

export default function PhoneLoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const shown = COUNTRIES.filter((c) => {
    const q = query.trim().toLowerCase().replace('+', '');
    return !q || c.name.toLowerCase().includes(q) || c.code.startsWith(q);
  });

  const handleSend = async () => {
    const raw = phone.trim();
    let fullPhone;
    if (raw.startsWith('+')) {
      // Numéro complet tapé avec son indicatif (pays absent de la liste).
      fullPhone = '+' + raw.replace(/\D/g, '');
      if (fullPhone.length < 9) {
        Alert.alert('Numéro invalide', 'Vérifie ton numéro de téléphone.');
        return;
      }
    } else {
      let digits = raw.replace(/\D/g, '');
      if (country.trunk) digits = digits.replace(/^0+/, '');
      if (digits.length < 6) {
        Alert.alert('Numéro invalide', 'Vérifie ton numéro de téléphone.');
        return;
      }
      fullPhone = '+' + country.code + digits;
    }
    setSending(true);
    // Si la personne utilise déjà Zuno avec une identité anonyme, on rattache le
    // numéro à CETTE identité (elle garde ses annonces, commandes, messages).
    // Si le numéro appartient déjà à un compte, on se connecte à ce compte.
    let mode = 'sms';
    let error = null;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.is_anonymous) {
      const res = await supabase.auth.updateUser({ phone: fullPhone });
      if (!res.error) {
        mode = 'phone_change';
      } else if (/already|registered|exists|taken|duplicate/i.test(res.error.message || '')) {
        const r2 = await supabase.auth.signInWithOtp({ phone: fullPhone });
        error = r2.error;
      } else {
        error = res.error;
      }
    } else {
      const r3 = await supabase.auth.signInWithOtp({ phone: fullPhone });
      error = r3.error;
    }
    setSending(false);

    if (error) {
      Alert.alert('Envoi impossible', "On n'a pas pu t'envoyer le code. Vérifie ton numéro (WhatsApp) et ta connexion, puis réessaie.");
      return;
    }
    navigation.navigate('OtpVerify', { phone: fullPhone, mode });
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
        Entre ton numéro WhatsApp, on t'envoie un code de vérification sur WhatsApp.
      </Text>

      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.prefixBtn} onPress={() => setPicking(true)} accessibilityRole="button">
          <Text style={styles.prefixText}>{country.flag} +{country.code}  ▾</Text>
        </TouchableOpacity>
        <TextInput
          placeholder="Numéro WhatsApp"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSend} disabled={sending}>
        <Text style={styles.buttonText}>{sending ? 'Envoi…' : 'Recevoir le code sur WhatsApp'}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Ton pays n'est pas dans la liste ? Tape ton numéro complet avec « + » (ex. +254…).</Text>

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Choisis ton pays</Text>
            <TouchableOpacity onPress={() => { setPicking(false); setQuery(''); }}>
              <Text style={styles.close}>Fermer</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            placeholder="Rechercher un pays ou un indicatif"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          <FlatList
            data={shown}
            keyExtractor={(c) => c.code + c.name}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.countryRow}
                onPress={() => { setCountry(item); setPicking(false); setQuery(''); }}
              >
                <Text style={styles.countryText}>{item.flag}  {item.name}</Text>
                <Text style={styles.countryCode}>+{item.code}</Text>
              </TouchableOpacity>
            )}
          />
        </KeyboardAvoidingView>
      </Modal>
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
  prefixBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, height: 48, justifyContent: 'center', backgroundColor: colors.surface,
  },
  prefixText: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
  modal: { flex: 1, backgroundColor: colors.background, paddingTop: 56, paddingHorizontal: spacing.lg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  close: { color: colors.purple, fontWeight: '700', fontSize: 15 },
  search: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: 46,
    paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 15, marginBottom: spacing.sm,
  },
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  countryText: { fontSize: 16, color: colors.textPrimary },
  countryCode: { fontSize: 15, color: colors.textSecondary },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    height: 48, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 15,
  },
  button: { backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
