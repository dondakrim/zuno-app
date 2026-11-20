// Politiques de retour / remboursement / annulation — src/screens/LegalScreen.js
// Utilisation : navigation.navigate('Legal', { kind: 'retour' | 'remboursement' | 'annulation' })
// ⚠️ Textes à faire relire par un juriste avant la publication sur les stores.
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/colors';
import InfoHeader from '../components/InfoHeader';

const DOCS = {
  retour: {
    title: 'Politique de retour',
    blocks: [
      ['Principe', "Zuno est une place de marché d'articles d'occasion. Chaque article est décrit par son vendeur. Si l'article reçu ne correspond pas à l'annonce, tu peux demander un retour."],
      ['Délai', "Tu as 48 heures après la livraison pour signaler un problème depuis ta commande (« Signaler un problème »)."],
      ['Cas acceptés', "Article non conforme à la description, article endommagé non signalé dans l'annonce, article manquant ou différent."],
      ['Cas non acceptés', "Simple changement d'avis, défaut déjà indiqué dans l'annonce, article utilisé ou abîmé après la livraison."],
      ['Déroulement', "Notre équipe examine ta demande avec les photos que tu fournis, puis donne sa décision. En cas d'accord, l'article est renvoyé au vendeur."],
    ],
  },
  remboursement: {
    title: 'Politique de remboursement',
    blocks: [
      ['Paiement protégé', "Ton paiement est gardé par Zuno jusqu'à la confirmation de livraison. Le vendeur n'est pas payé avant."],
      ['Quand es-tu remboursé ?', "Si ta commande est annulée avant traitement, si l'article n'est jamais livré, ou si un litige est tranché en ta faveur."],
      ['Montant', "Le remboursement porte sur le prix de l'article. Les frais de livraison sont remboursés si la faute vient du vendeur ou de la livraison."],
      ['Délai', "Une fois la décision prise, le remboursement est envoyé sur le moyen de paiement utilisé. Le délai exact dépend de ton opérateur Mobile Money ou de ta banque."],
    ],
  },
  annulation: {
    title: 'Politique d’annulation',
    blocks: [
      ['Annuler en tant qu’acheteur', "Tu peux annuler ta commande tant que le vendeur ne l'a pas commencée (statut « à traiter »). Appuie sur « Annuler » dans Mes commandes."],
      ['Après le début du traitement', "Une fois la commande en préparation ou en livraison, l'annulation n'est plus possible. Tu peux ouvrir un litige si besoin."],
      ['Annulation par le vendeur', "Un vendeur peut annuler s'il ne peut plus fournir l'article. Tu es alors remboursé."],
      ['Annulations répétées', "Des annulations abusives peuvent entraîner une restriction du compte."],
    ],
  },
};

export default function LegalScreen({ navigation, route }) {
  const doc = DOCS[route?.params?.kind] || DOCS.retour;
  return (
    <View style={styles.container}>
      <InfoHeader title={doc.title} navigation={navigation} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {doc.blocks.map(([h, t]) => (
          <View key={h} style={styles.card}>
            <Text style={styles.h}>{h}</Text>
            <Text style={styles.t}>{t}</Text>
          </View>
        ))}
        <Text style={styles.note}>Dernière mise à jour : novembre 2026</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md, marginBottom: spacing.md },
  h: { fontSize: 14, fontWeight: '800', color: colors.purple, marginBottom: 4 },
  t: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  note: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
});
