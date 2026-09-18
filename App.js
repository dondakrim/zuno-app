import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import { ModeProvider } from './src/context/ModeContext';
import AppNavigator from './src/navigation/AppNavigator';
import InterestsScreen from './src/screens/onboarding/InterestsScreen';
import { colors } from './src/theme/colors';

export default function App() {
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

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

  if (checkingOnboarding) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purple }}>
        <ActivityIndicator color={colors.white} size="large" />
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
