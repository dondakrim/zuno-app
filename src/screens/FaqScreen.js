// FAQ — src/screens/FaqScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import InfoHeader from '../components/InfoHeader';

const SECTIONS = [
  {
    title: 'Acheter',
    items: [
      ['Comment acheter un article ?', "Ouvre une annonce, appuie sur « Acheter » ou ajoute-la au panier, choisis l'adresse de livraison puis paie avec Mobile Money ou carte."],
      ['Mon argent est-il protégé ?', "Oui. Ton paiement est gardé par Zuno. Le vendeur n'est payé qu'une fois la livraison confirmée."],
      ['Comment suivre ma commande ?', "Va dans Moi → Mes commandes. Tu y vois chaque étape : à traiter, en cours, livrée."],
      ['Puis-je annuler une commande ?', "Oui, tant que le vendeur n'a pas commencé à la traiter. Ouvre la commande et appuie sur « Annuler »."],
    ],
  },
  {
    title: 'Vendre',
    items: [
      ['Comment publier une annonce ?', "Appuie sur « Vendre » (bouton central), ajoute des photos, un titre, un prix et ta ville. Ton annonce est vérifiée avant d'apparaître."],
      ['Pourquoi mon annonce n’est pas visible ?', "Elle est peut-être en cours de vérification. Si elle est refusée, tu reçois une notification avec la raison."],
      ['Comment devenir marchand ?', "Dans Moi, appuie sur « Devenir marchand » et remplis la demande. Notre équipe l'examine puis te répond."],
      ['Quand suis-je payé ?', "Après la confirmation de livraison par l'acheteur."],
    ],
  },
  {
    title: 'Problèmes',
    items: [
      ["J'ai reçu un article différent", "Ouvre la commande et appuie sur « Signaler un problème ». Notre équipe examine ta demande."],
      ['Comment contacter le support ?', "Va dans Moi → Service clients."],
      ['Comment supprimer mon compte ?', "Moi → Paramètres → Supprimer mon compte. Cette action est définitive."],
    ],
  },
];

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };
  return (
    <TouchableOpacity style={styles.item} onPress={toggle} activeOpacity={0.7}>
      <View style={styles.qRow}>
        <Text style={styles.q}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </View>
      {open ? <Text style={styles.a}>{a}</Text> : null}
    </TouchableOpacity>
  );
}

export default function FaqScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <InfoHeader title="Questions fréquentes" navigation={navigation} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={{ marginBottom: spacing.lg }}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <View style={styles.card}>
              {s.items.map(([q, a], i) => (
                <View key={q} style={i > 0 ? styles.sep : null}>
                  <Item q={q} a={a} />
                </View>
              ))}
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Support')}>
          <Ionicons name="headset-outline" size={18} color={colors.white} />
          <Text style={styles.ctaText}>Je n'ai pas trouvé ma réponse</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: spacing.xs, marginLeft: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden' },
  sep: { borderTopWidth: 1, borderTopColor: colors.border },
  item: { padding: spacing.md },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  q: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  a: { marginTop: spacing.sm, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 14 },
  ctaText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
