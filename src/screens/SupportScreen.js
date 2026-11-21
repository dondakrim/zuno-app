// Service clients — src/screens/SupportScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import InfoHeader from '../components/InfoHeader';

// ✏️ REMPLIS tes vraies coordonnées ici. Un champ vide = le bouton est caché.
// WHATSAPP : numéro avec l'indicatif, sans + ni espaces (ex. '22790000000')
const CONTACT = {
  WHATSAPP: '34627137449',
  PHONE: '',
  EMAIL: 'contact@zunomarket.store',
  HOURS: 'Lundi – Samedi, 7h – 23h',
};

const open = (url) =>
  Linking.openURL(url).catch(() => Alert.alert('Impossible d’ouvrir', 'Vérifie que l’application est installée.'));

export default function SupportScreen({ navigation }) {
  const buttons = [
    CONTACT.WHATSAPP && { icon: 'logo-whatsapp', label: 'WhatsApp', sub: 'Réponse rapide', color: '#25D366', onPress: () => open(`https://wa.me/${CONTACT.WHATSAPP}`) },
    CONTACT.PHONE && { icon: 'call-outline', label: 'Appeler', sub: CONTACT.PHONE, color: colors.purple, onPress: () => open(`tel:${CONTACT.PHONE}`) },
    CONTACT.EMAIL && { icon: 'mail-outline', label: 'E-mail', sub: CONTACT.EMAIL, color: colors.orange, onPress: () => open(`mailto:${CONTACT.EMAIL}`) },
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <InfoHeader title="Service clients" navigation={navigation} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Une question, un problème ? Notre équipe est là pour t'aider.</Text>

        {buttons.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>Les moyens de contact seront bientôt disponibles.</Text>
          </View>
        ) : (
          buttons.map((b) => (
            <TouchableOpacity key={b.label} style={styles.card} onPress={b.onPress} activeOpacity={0.7}>
              <View style={[styles.icon, { backgroundColor: b.color }]}>
                <Ionicons name={b.icon} size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{b.label}</Text>
                <Text style={styles.sub}>{b.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}

        {CONTACT.HOURS ? <Text style={styles.hours}>🕒 {CONTACT.HOURS}</Text> : null}

        <TouchableOpacity style={styles.faq} onPress={() => navigation.navigate('Faq')}>
          <Ionicons name="help-circle-outline" size={18} color={colors.purple} />
          <Text style={styles.faqText}>Consulter les questions fréquentes</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md, marginBottom: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  empty: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', flex: 1 },
  hours: { textAlign: 'center', fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  faq: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.lg, paddingVertical: 12 },
  faqText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
});
