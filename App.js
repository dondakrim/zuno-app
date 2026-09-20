import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import { ModeProvider } from './src/context/ModeContext';
import AppNavigator from './src/navigation/AppNavigator';
import InterestsScreen from './src/screens/onboarding/InterestsScreen';
import { colors, spacing } from './src/theme/colors';
import { supabase } from './src/lib/supabase';
import { getDeviceUserId } from './src/lib/deviceUser';

export default function App() {
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [banInfo, setBanInfo] = useState({ checked: false, banned: false, reason: '' });

  useEffect(() => {
    AsyncStorage.getItem('zuno_onboarding_done')
      .then((value) => {
        setOnboardingDone(value === 'true');
      })
      .catch((e) => {
        console.log('Erreur lecture onboarding, on continue quand même :', e.message);
        setOnboardingDone(false);
      })
      .finally(() => {
        setCheckingOnboarding(false);
      });
  }, []);

  useEffect(() => {
    if (checkingOnboarding || !onboardingDone) return;
    // Ne vérifie le bannissement que pour les personnes ayant déjà terminé
    // l'accueil (un tout nouveau venu n'a pas encore de compte à bloquer).
    getDeviceUserId()
      .then((myId) =>
        supabase.from('users').select('is_banned, ban_reason').eq('id', myId).maybeSingle()
      )
      .then(({ data }) => {
        setBanInfo({ checked: true, banned: data?.is_banned || false, reason: data?.ban_reason || '' });
      })
      .catch((e) => {
        console.log('Erreur vérification bannissement, on continue quand même :', e.message);
        setBanInfo({ checked: true, banned: false, reason: '' });
      });
  }, [checkingOnboarding, onboardingDone]);

  if (checkingOnboarding || (onboardingDone && !banInfo.checked)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purple }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  if (banInfo.banned) {
    return (
      <View style={bannedStyles.container}>
        <Text style={bannedStyles.title}>Compte suspendu</Text>
        <Text style={bannedStyles.text}>
          Ton accès à Zuno a été suspendu suite à une ou plusieurs violations des conditions
          d'utilisation.
        </Text>
        {banInfo.reason ? <Text style={bannedStyles.reason}>Motif : {banInfo.reason}</Text> : null}
        <Text style={bannedStyles.text}>
          Si tu penses qu'il s'agit d'une erreur, contacte-nous à contact@zunomarket.store.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ModeProvider>
          <StatusBar style="light" />
          {onboardingDone ? (
            <AppNavigator />
          ) : (
            <InterestsScreen onDone={() => setOnboardingDone(true)} />
          )}
        </ModeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const bannedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.danger, marginBottom: spacing.md },
  text: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md, lineHeight: 20 },
  reason: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', marginBottom: spacing.md, textAlign: 'center' },
});
