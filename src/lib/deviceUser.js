import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
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

// Supprime le compte : rend les informations personnelles anonymes côté
// Supabase (nom, photo, ville, pièce d'identité, centres d'intérêt...) et
// efface l'identité de l'appareil, pour repartir de zéro. Les annonces,
// messages et commandes déjà liés à cet identifiant restent en base sous
// forme anonyme (pour la cohérence des commandes passées côté acheteurs),
// plutôt que d'être supprimés d'un coup, ce qui risquerait de casser des
// commandes en cours avec d'autres utilisateurs.
export async function deleteAccountAndReset() {
  const id = await AsyncStorage.getItem(STORAGE_KEY);
  if (!id) return;

  // Tente de retirer la pièce d'identité du stockage, si elle existe.
  const { data: userRow } = await supabase
    .from('users')
    .select('id_document_url')
    .eq('id', id)
    .maybeSingle();
  if (userRow?.id_document_url) {
    await supabase.storage.from('identity-documents').remove([userRow.id_document_url]);
  }

  await supabase
    .from('users')
    .update({
      nom: 'Compte supprimé',
      telephone: `deleted-${id.slice(0, 8)}`,
      ville: null,
      photo_url: null,
      boutique_nom: null,
      id_document_url: null,
      identity_status: 'non_soumise',
      interets: null,
    })
    .eq('id', id);

  await supabase.from('push_tokens').delete().eq('user_id', id);

  await AsyncStorage.multiRemove([
    STORAGE_KEY,
    'zuno_onboarding_done',
    'zuno_user_mode',
    'zuno_merchant_suggestion_dismissed',
  ]);
}

// Vérifie si le téléphone et le WhatsApp ont bien été renseignés (au-delà
// du numéro de test généré automatiquement). Utilisé juste avant une
// action qui nécessite de pouvoir contacter la personne (achat,
// publication d'annonce, favori...) plutôt qu'à l'ouverture de l'appli.
export async function isAccountComplete() {
  const id = await getDeviceUserId();
  const { data } = await supabase
    .from('users')
    .select('telephone, whatsapp')
    .eq('id', id)
    .maybeSingle();

  const hasPhone = data?.telephone && !data.telephone.startsWith('local-');
  const hasWhatsapp = !!data?.whatsapp;
  return hasPhone && hasWhatsapp;
}

// À appeler juste avant une action qui nécessite de pouvoir contacter la
// personne. Si le compte n'est pas complet, propose de le compléter et
// renvoie false (l'appelant doit alors arrêter l'action en cours) ; sinon
// renvoie true immédiatement.
export async function ensureAccountComplete(navigation, actionLabel = 'continuer') {
  const complete = await isAccountComplete();
  if (complete) return true;

  return new Promise((resolve) => {
    Alert.alert(
      'Complète ton compte',
      `Un numéro de téléphone et un numéro WhatsApp sont nécessaires pour ${actionLabel}, afin que les autres utilisateurs puissent te contacter.`,
      [
        { text: 'Plus tard', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Créer mon compte',
          onPress: () => {
            navigation.navigate('AccountSetup');
            resolve(false);
          },
        },
      ]
    );
  });
}
