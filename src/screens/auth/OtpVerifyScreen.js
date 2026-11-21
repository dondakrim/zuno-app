import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { getDeviceUserId } from '../../lib/deviceUser';
import { PHONE_AUTH_ENABLED } from '../../config';

export default function OtpVerifyScreen({ route, navigation }) {
  const { phone, mode = 'sms' } = route.params;
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [wait, setWait] = useState(60);
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(timer.current);
  }, []);

  const handleResend = async () => {
    if (wait > 0) return;
    setWait(60);
    const { error } = mode === 'phone_change'
      ? await supabase.auth.updateUser({ phone })
      : await supabase.auth.signInWithOtp({ phone });
    if (error) Alert.alert('Envoi impossible', "On n'a pas pu renvoyer le code. Réessaie dans un instant.");
    else Alert.alert('Code renvoyé', 'Un nouveau code vient d\'être envoyé sur WhatsApp.');
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      Alert.alert('Code invalide', 'Entre les 6 chiffres reçus sur WhatsApp.');
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: mode === 'phone_change' ? 'phone_change' : 'sms',
    });
    if (error) {
      setVerifying(false);
      Alert.alert('Code incorrect', 'Code incorrect ou expiré. Vérifie-le ou demande un nouveau code.');
      return;
    }
    try {
      // Renseigne le téléphone et le WhatsApp du profil (sans écraser un vrai numéro déjà saisi).
      const id = await getDeviceUserId();
      const { data: row } = await supabase.from('users').select('telephone').eq('id', id).maybeSingle();
      if (!row || !row.telephone || row.telephone.startsWith('local-')) {
        await supabase.from('users').update({ telephone: phone, whatsapp: phone }).eq('id', id);
      }
    } catch (e) { /* sans conséquence : le profil pourra être complété plus tard */ }
    setVerifying(false);
    if (!PHONE_AUTH_ENABLED) navigation.navigate('Account');
    // La session est maintenant active : AppNavigator bascule automatiquement
    // vers l'application principale grâce à onAuthStateChange.
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vérification</Text>
      <Text style={styles.subtitle}>Entre le code envoyé sur WhatsApp au {phone}</Text>

      <TextInput
        placeholder="123456"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
        style={styles.input}
        maxLength={6}
      />

      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={verifying}>
        <Text style={styles.buttonText}>{verifying ? 'Vérification…' : 'Vérifier'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleResend} disabled={wait > 0} style={{ marginTop: spacing.md, alignItems: 'center' }}>
        <Text style={{ color: wait > 0 ? colors.textMuted : colors.purple, fontSize: 13, fontWeight: '600' }}>
          {wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer le code'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md, alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Changer de numéro</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    height: 52, paddingHorizontal: spacing.md, backgroundColor: colors.surface,
    fontSize: 20, textAlign: 'center', letterSpacing: 6, marginBottom: spacing.lg,
  },
  button: { backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
