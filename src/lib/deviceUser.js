import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = 'zuno_device_user_id';

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Tant que la connexion par téléphone est désactivée (voir src/config.js),
// on donne à chaque appareil une identité stable et unique, pour que les
// annonces et les messages puissent être rattachés à quelqu'un. Une fois
// PHONE_AUTH_ENABLED remis à true, cette identité sera remplacée par le
// vrai compte de l'utilisateur.
export async function getDeviceUserId() {
  let id = await AsyncStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateUuid();
    await AsyncStorage.setItem(STORAGE_KEY, id);
  }

  // S'assure qu'une ligne existe dans la table `users` pour cette identité,
  // sinon les liaisons vers les annonces et les messages échoueraient.
  const { error } = await supabase
    .from('users')
    .upsert(
      { id, telephone: `local-${id.slice(0, 8)}`, nom: 'Toi (test)' },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('Erreur création identité de test:', error);
  }

  return id;
}
