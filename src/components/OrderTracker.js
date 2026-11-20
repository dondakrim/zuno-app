// Frise d'étapes d'une commande — src/components/OrderTracker.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';

const STEP_INDEX = { a_traiter: 0, pris_en_charge: 1, en_cours: 2, livre: 3 };

const HINTS = {
  buyer: {
    a_traiter: 'Ta commande est enregistrée. Le vendeur va la confirmer très bientôt.',
    pris_en_charge: 'Le vendeur prépare ton article.',
    en_cours: "Ton colis est en route. Tu seras prévenu(e) à l'arrivée.",
    en_cours_pickup: 'Ton article est prêt : va le récupérer chez le vendeur.',
    livre: 'Commande terminée. Pense à laisser un avis au vendeur.',
    livre_pickup: 'Article récupéré. Pense à laisser un avis au vendeur.',
    annulee: 'Cette commande a été annulée.',
  },
  seller: {
    a_traiter: "Nouvelle commande : confirme-la pour prévenir l'acheteur.",
    pris_en_charge: "Prépare l'article, puis marque-le en livraison.",
    pris_en_charge_pickup: "Prépare l'article, puis marque-le « prêt pour le retrait ».",
    en_cours: "Marque « Livré » quand l'acheteur a bien reçu l'article.",
    en_cours_pickup: "Marque « Récupéré » quand l'acheteur est passé.",
    livre: 'Commande terminée. Le montant est ajouté à ton solde.',
    livre_pickup: 'Commande terminée. Le montant est ajouté à ton solde.',
    annulee: 'Cette commande a été annulée.',
  },
};

export default function OrderTracker({ status, pickup, role = 'buyer' }) {
  const hints = HINTS[role] || HINTS.buyer;
  if (status === 'annulee') {
    return (
      <View style={styles.cancelled}>
        <Ionicons name="close-circle" size={18} color={colors.danger} />
        <Text style={styles.cancelledText}>{hints.annulee}</Text>
      </View>
    );
  }
  const idx = STEP_INDEX[status] ?? 0;
  const steps = [
    { label: 'Commande\npassée', icon: 'receipt' },
    { label: 'Préparation', icon: 'cube' },
    { label: pickup ? 'Prêt au\nretrait' : 'En\nlivraison', icon: pickup ? 'storefront' : 'car' },
    { label: pickup ? 'Récupéré' : 'Livré', icon: 'checkmark-done' },
  ];
  const key = pickup ? status + '_pickup' : status;
  const hint = hints[key] || hints[status] || '';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {steps.map((st, i) => {
          const done = i < idx || (idx === 3 && i === 3);
          const current = i === idx && idx < 3;
          return (
            <View key={st.label} style={styles.stepCol}>
              {i > 0 ? <View style={[styles.line, i <= idx && styles.lineDone]} /> : null}
              <View style={[styles.circle, done && styles.circleDone, current && styles.circleCurrent]}>
                <Ionicons
                  name={done ? 'checkmark' : st.icon}
                  size={done ? 15 : 14}
                  color={done || current ? colors.white : colors.textMuted}
                />
              </View>
              <Text style={[styles.label, i <= idx && styles.labelActive]}>{st.label}</Text>
            </View>
          );
        })}
      </View>
      {hint ? (
        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={15} color={colors.orange} />
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row' },
  stepCol: { flex: 1, alignItems: 'center' },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circleDone: { backgroundColor: colors.success, borderColor: colors.success },
  circleCurrent: { backgroundColor: colors.orange, borderColor: colors.orange },
  line: { position: 'absolute', top: 13, left: '-50%', right: '50%', height: 3, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.success },
  label: { marginTop: 6, textAlign: 'center', fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  labelActive: { color: colors.textPrimary },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.tintOrange,
  },
  hintText: { flex: 1, fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
  cancelled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.tintRed,
  },
  cancelledText: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' },
});
