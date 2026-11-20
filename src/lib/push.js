// Notifications push — src/lib/push.js
// Dans Expo Go, expo-notifications plante dès qu'on le charge : on ne le charge donc
// JAMAIS dans Expo Go, seulement dans le vrai APK / build.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const inExpoGo = Constants.appOwnership === 'expo';

// À appeler une fois l'utilisateur identifié. Ne plante jamais l'app.
export async function registerForPush() {
  try {
    if (inExpoGo || !Device.isDevice) return;
    const Notifications = require('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Zuno',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;
    await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  } catch (e) {
    console.log('Notifications push non activées :', e?.message);
  }
}
