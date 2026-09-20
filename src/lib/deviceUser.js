import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { supabase } from './supabase';

// Chaque appareil a maintenant une vraie session Supabase (connexion
// anonyme), au lieu d'un simple identifiant généré localement. Ça ne
// change rien pour la personne qui utilise l'appli (aucun mot de passe,
// aucun code à saisir), mais ça permet enfin à la base de données de
// savoir, de façon fiable, qui fait chaque demande — indispensable pour
// que les règles de sécurité (RLS) protègent vraiment les données de
// chacun.
let sessionPromise = null;

async function getOrCreateSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    return session.user;
  }

  // Si plusieurs écrans démarrent en même temps, on ne veut surtout pas
  // déclencher plusieurs connexions anonymes en parallèle (elles
  // pourraient se marcher dessus) : tout le monde attend la même
  // tentative, une seule fois.
  if (!sessionPromise) {
    sessionPromise = supabase.auth.signInAnonymously().finally(() => {
      sessionPromise = null;
    });
  }

  const { data, error } = await sessionPromise;
  if (error) {
    console.error('Erreur connexion anonyme:', error);
    throw error;
  }
  return data.user;
}

export async function getDeviceUserId() {
  const user = await getOrCreateSession();
  const id = user.id;

  // S'assure qu'une ligne existe dans la table `users` pour cette
  // identité, sinon les liaisons vers les annonces et les messages
  // échoueraient.
  const { error } = await supabase
    .from('users')
    .upsert(
      { id, telephone: `local-${id.slice(0, 8)}`, nom: 'Toi (test)' },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('Erreur création identité:', error, 'id utilisé :', id);
  }

  return id;
}

// Remplace l'identité actuelle par une toute nouvelle — utile uniquement
// pour tester la messagerie et les commandes seul, sans deuxième
// téléphone (Profil > Paramètres > Changer d'identité de test).
export async function resetIdentity() {
  await supabase.auth.signOut();
  return getDeviceUserId();
}

// Supprime le compte : rend les informations personnelles anonymes côté
// Supabase (nom, photo, ville, pièce d'identité, centres d'intérêt...) et
// déconnecte la session, pour repartir de zéro. Les annonces, messages et
// commandes déjà liés à cet identifiant restent en base sous forme
// anonyme (pour la cohérence des commandes passées côté acheteurs),
// plutôt que d'être supprimés d'un coup, ce qui risquerait de casser des
// commandes en cours avec d'autres utilisateurs.
export async function deleteAccountAndReset() {
  const { data: { session } } = await supabase.auth.getSession();
  const id = session?.user?.id;
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
      whatsapp: null,
      email: null,
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
    'zuno_onboarding_done',
    'zuno_user_mode',
    'zuno_merchant_suggestion_dismissed',
  ]);

  await supabase.auth.signOut();
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
