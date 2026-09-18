import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getDeviceUserId } from './deviceUser';

// Depuis le SDK 53, le simple fait de charger le module expo-notifications
// fait planter Expo Go sur Android (Expo a retiré cette fonctionnalité
// d'Expo Go, et le module lui-même déclenche une erreur dès son
// chargement). Seule une vraie appli compilée (APK/EAS Build) le peut.
// Pour éviter tout risque, on ne charge JAMAIS le module dans ce cas —
// une simple vérification avant l'appel ne suffit pas, il faut éviter
// l'import lui-même.
const isExpoGo = Constants.appOwnership === 'expo';
const pushAvailable = !(isExpoGo && Platform.OS === 'android');

// Demande la permission d'envoyer des notifications, récupère le jeton
// unique de cet appareil, et l'enregistre dans Supabase pour pouvoir lui
// envoyer plus tard des alertes sur les nouveaux articles ou les tendances.
export async function registerForPushNotifications() {
  if (!pushAvailable) {
    console.log(
      "Notifications push distantes indisponibles dans Expo Go sur Android (SDK 53+) — teste avec l'APK compilé pour cette fonctionnalité."
    );
    return null;
  }

  try {
    // Import chargé uniquement ici, jamais dans Expo Go sur Android, pour
    // ne jamais déclencher le plantage connu du module dans cet environnement.
    const Notifications = require('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#FF6A00',
      });
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;

    const myId = await getDeviceUserId();
    await supabase
      .from('push_tokens')
      .upsert({ user_id: myId, token }, { onConflict: 'token' });

    return token;
  } catch (e) {
    // Sur un simulateur ou certains environnements, les notifications push
    // ne sont pas disponibles : on échoue silencieusement plutôt que de
    // bloquer le reste de l'application.
    console.log('Notifications push non disponibles :', e.message);
    return null;
  }
}
