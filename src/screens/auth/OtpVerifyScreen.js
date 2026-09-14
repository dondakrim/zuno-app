import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

export default function OtpVerifyScreen({ route, navigation }) {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (code.length < 4) {
      Alert.alert('Code invalide', 'Entre le code reçu par SMS.');
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });
    setVerifying(false);

    if (error) {
      Alert.alert('Code incorrect', error.message);
      return;
    }
    // La session est maintenant active : AppNavigator bascule automatiquement
    // vers l'application principale grâce à onAuthStateChange.
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vérification</Text>
      <Text style={styles.subtitle}>Entre le code envoyé au {phone}</Text>

      <TextInput
        placeholder="123456"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
        style={styles.input}
        maxLength={6}
      />

      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={verifying}>
        <Text style={styles.buttonText}>{verifying ? 'Vérification…' : 'Vérifier'}</Text>
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
