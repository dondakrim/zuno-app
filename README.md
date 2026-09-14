# Zuno — application mobile

Marketplace d'occasion pour le Niger. Ce projet contient les 4 écrans qu'on a
validés ensemble (accueil, fiche produit, dépôt d'annonce, profil), aux
couleurs de la marque Zuno.

## Étape 0 — mettre le projet à jour (à faire une seule fois)

Ce projet a été créé il y a un moment ; Expo Go sur ton téléphone se met à
jour tout seul et ne fonctionne plus qu'avec la toute dernière version.
Avant toute autre étape ci-dessous, dans le dossier du projet :

```
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npx expo install --fix
npx expo start -c
```

La commande `expo install --fix` ajuste automatiquement toutes les
bibliothèques du projet (React Native, navigation, etc.) pour qu'elles
correspondent à la version actuelle d'Expo Go — pas besoin de choisir les
numéros de version toi-même.

## Ce qu'il te faut avant de commencer

1. **Node.js** installé sur ton ordinateur (version 18 ou plus) — télécharge-le
   sur nodejs.org si tu ne l'as pas.
2. L'application **Expo Go** installée sur ton téléphone (disponible sur
   l'App Store et le Google Play Store) — c'est elle qui va afficher
   l'application pendant qu'on la construit, sans passer par les stores.
3. Un compte gratuit sur **supabase.com** (pour la base de données).

## Étape 1 — installer les dépendances

Ouvre un terminal dans ce dossier et tape :

```
npm install
```

Ça va télécharger toutes les briques dont l'application a besoin. Ça peut
prendre quelques minutes la première fois.

## Étape 2 — lancer l'application

```
npm start
```

Un QR code apparaît dans le terminal. Scanne-le avec l'appareil photo de ton
téléphone (iPhone) ou depuis l'app Expo Go (Android) : l'application Zuno
s'ouvre directement sur ton téléphone.

À ce stade, l'accueil affiche 3 annonces de démonstration codées en dur —
c'est normal, on n'a pas encore branché la vraie base de données.

## Étape 3 — brancher la base de données Supabase

1. Sur supabase.com, crée un nouveau projet (nomme-le "zuno").
2. Une fois le projet créé, va dans l'onglet **SQL Editor**, colle le contenu
   du fichier `supabase/schema.sql` de ce projet, et clique sur **Run**. Ça
   crée toutes les tables (utilisateurs, annonces, commandes, paiements...).
3. Va dans **Project Settings > API**. Copie la **Project URL** et la clé
   **anon public**.
4. Ouvre le fichier `src/lib/supabase.js` dans ce projet et remplace
   `VOTRE-PROJET.supabase.co` et `VOTRE_CLE_ANON_PUBLIQUE` par ces deux
   valeurs.
5. Relance l'application (`npm start`). L'écran "Déposer" écrit maintenant
   une vraie ligne dans ta base Supabase à chaque publication.

## Étape 4 — la connexion par téléphone (mise en pause pour l'instant)

Le code de connexion par SMS existe déjà (écrans, Supabase, Twilio) mais il
est **désactivé** pour ne pas bloquer le reste du développement le temps que
Twilio soit correctement configuré.

Pour le réactiver plus tard : ouvre `src/config.js` et passe
`PHONE_AUTH_ENABLED` à `true`. Assure-toi avant ça que dans Supabase
(Authentication > Sign In / Up > Phone), les identifiants Twilio (Account
SID, Auth Token, Verify Service SID) sont bien renseignés et sauvegardés,
sinon l'erreur "Unsupported phone provider" reviendra.

## Étape 5 — activer l'envoi de photos

Deux choses à faire une seule fois dans ton tableau de bord Supabase :

1. **Créer l'espace de stockage** : menu de gauche **Storage**, clique sur
   **New bucket**, nomme-le exactement `listings`, et active **Public
   bucket** (sinon les photos ne s'afficheront pas dans l'appli). Clique sur
   Create bucket.
2. **Ajouter la colonne photo à la base** : va dans **SQL Editor**, colle le
   contenu du fichier `supabase/add_photo_column.sql`, clique sur Run.

Ensuite, sur ton ordinateur : `npm install` (pour récupérer les nouvelles
dépendances), puis `npx expo start -c`. Le bouton "Ajouter une photo" sur
l'écran de dépôt d'annonce fonctionne maintenant, et les photos publiées
s'affichent dans le fil d'accueil et la fiche produit.

## Où en est le projet

- ✅ Écrans accueil, fiche produit, dépôt d'annonce, profil
- ✅ Couleurs et logo Zuno intégrés
- ✅ Schéma de base de données complet
- ✅ Envoi et affichage de vraies photos (voir Étape 5 pour l'activer)
- ⏸️ Connexion par numéro de téléphone (code prêt, désactivée pour l'instant — voir Étape 4)
- ⏳ Recherche avancée avec filtres (écran présent, logique à ajouter)
- ⏳ Messagerie acheteur-vendeur (écran présent, logique à ajouter)
- ⏳ Paiement MyNITA (bouton "Acheter" en place, branchement à faire une fois
  la clé d'API marchand obtenue)
- ⏳ Suivi de livraison avec le partenaire coursier
- ⏳ Authentification par numéro de téléphone

## Prochaine étape suggérée

Revenir vers moi avec ce projet pour qu'on branche, dans l'ordre : la
recherche de vrais articles depuis Supabase, l'authentification par
téléphone, puis la messagerie.
