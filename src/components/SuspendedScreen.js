// Écran affiché à une personne dont le compte est suspendu : image de marque,
// motif, boutons pour joindre l'équipe (WhatsApp / e-mail) et bannière Zuno.
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';

const BRAND = '#2C0382'; // violet du logo
const SLOGAN = "Achète et vends d'occasion, en toute confiance.";
const LOGO_RATIO = 800 / 367; // largeur / hauteur de assets/zuno-logo.png

// Valeurs de secours ; les vraies coordonnées viennent du tableau de bord > Réglages.
const DEFAULT_CONTACT = {
  WHATSAPP: '34627137449',
  EMAIL: 'contact@zunomarket.store',
  HOURS: 'Lundi – Samedi, 7h – 23h',
};
const FALLBACK_ADS = [
  { id: 'f1', title: 'Zuno', subtitle: "Achète et vends d'occasion, en toute confiance.", color: colors.purple },
  { id: 'f2', title: 'Une question ?', subtitle: "Notre équipe te répond dès que possible.", color: colors.orange },
];

const open = (url) =>
  Linking.openURL(url).catch(() =>
    Alert.alert("Impossible d'ouvrir", "Vérifie que l'application est installée.")
  );

export default function SuspendedScreen({ reason, onRetry }) {
  const insets = useSafeAreaInsets();
  const [contact, setContact] = useState(DEFAULT_CONTACT);
  const [ads, setAds] = useState(FALLBACK_ADS);
  const [adIndex, setAdIndex] = useState(0);
  const [checking, setChecking] = useState(false);
  const [userRef, setUserRef] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: settings }, { data: adRows }, { data: sess }] = await Promise.all([
          supabase.from('app_settings').select('key, value').like('key', 'support_%'),
          supabase.from('ads').select('*').eq('active', true).order('position', { ascending: true }),
          supabase.auth.getSession(),
        ]);
        if (cancelled) return;
        if (settings && settings.length) {
          const m = Object.fromEntries(settings.map((r) => [r.key, r.value || '']));
          setContact({
            WHATSAPP: m.support_whatsapp ?? DEFAULT_CONTACT.WHATSAPP,
            EMAIL: m.support_email ?? DEFAULT_CONTACT.EMAIL,
            HOURS: m.support_hours ?? DEFAULT_CONTACT.HOURS,
          });
        }
        if (adRows && adRows.length) setAds(adRows);
        const id = sess?.session?.user?.id;
        if (id) setUserRef(id.slice(0, 8));
      } catch (e) {
        // on garde les valeurs de secours
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Une bannière à la fois, qui change toute seule.
  useEffect(() => {
    if (ads.length < 2) return undefined;
    const t = setInterval(() => setAdIndex((i) => (i + 1) % ads.length), 4000);
    return () => clearInterval(t);
  }, [ads]);

  const intro = `Bonjour, mon compte Zuno est suspendu${reason ? ` (motif : ${reason})` : ''}. Pouvez-vous m'aider ?${userRef ? ` Référence : ${userRef}` : ''}`;

  const retry = async () => {
    if (!onRetry || checking) return;
    setChecking(true);
    try { await onRetry(); } finally { setChecking(false); }
  };

  const ad = ads[adIndex % ads.length];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Image source={require('../../assets/zuno-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.slogan}>{SLOGAN}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={30} color={colors.danger} />
          </View>
          <Text style={styles.title}>Compte suspendu</Text>
          <Text style={styles.text}>
            Ton accès à Zuno a été suspendu suite à une ou plusieurs violations des conditions d'utilisation.
          </Text>

          {reason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>MOTIF</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ) : null}

          <Text style={styles.help}>Tu penses qu'il s'agit d'une erreur ? Contacte l'équipe Zuno :</Text>

          {contact.WHATSAPP ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#25D366' }]}
              activeOpacity={0.85}
              onPress={() => open(`https://wa.me/${contact.WHATSAPP}?text=${encodeURIComponent(intro)}`)}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.btnText}>Écrire sur WhatsApp</Text>
            </TouchableOpacity>
          ) : null}

          {contact.EMAIL ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.orange }]}
              activeOpacity={0.85}
              onPress={() =>
                open(`mailto:${contact.EMAIL}?subject=${encodeURIComponent('Compte suspendu')}&body=${encodeURIComponent(intro)}`)
              }
            >
              <Ionicons name="mail-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>Envoyer un e-mail</Text>
            </TouchableOpacity>
          ) : null}

          {contact.HOURS ? <Text style={styles.hours}>🕒 {contact.HOURS}</Text> : null}

          {onRetry ? (
            <TouchableOpacity style={styles.retry} onPress={retry} activeOpacity={0.7}>
              {checking ? (
                <ActivityIndicator color={colors.purple} />
              ) : (
                <Text style={styles.retryText}>J'ai été réactivé : vérifier mon statut</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {ad ? (
          <View style={styles.adWrap}>
            {ad.image_url ? (
              <Image source={{ uri: ad.image_url }} style={styles.adImage} resizeMode="cover" />
            ) : (
              <View style={[styles.adCard, { backgroundColor: ad.color || colors.purple }]}>
                <Text style={styles.adTitle}>{ad.title}</Text>
                {ad.subtitle ? <Text style={styles.adSub}>{ad.subtitle}</Text> : null}
              </View>
            )}
            {ads.length > 1 ? (
              <View style={styles.dots}>
                {ads.map((a, i) => (
                  <View key={a.id ?? i} style={[styles.dot, i === adIndex % ads.length && styles.dotActive]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>Zuno · {contact.EMAIL || 'zunomarket.store'}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  header: {
    backgroundColor: BRAND,
    alignItems: 'center',
    paddingBottom: 80,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logo: { width: 220, height: 220 / LOGO_RATIO },
  slogan: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: spacing.xl },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: -36,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#FDECEC',
    alignItems: 'center', justifyContent: 'center', marginTop: -spacing.xl - 16, marginBottom: spacing.sm,
    borderWidth: 4, borderColor: colors.surface,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.danger, marginBottom: spacing.sm },
  text: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.md },
  reasonBox: {
    alignSelf: 'stretch', backgroundColor: '#FDECEC', borderLeftWidth: 4, borderLeftColor: colors.danger,
    borderRadius: 12, padding: spacing.md, marginBottom: spacing.md,
  },
  reasonLabel: { fontSize: 10, fontWeight: '800', color: colors.danger, letterSpacing: 1, marginBottom: 2 },
  reasonText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 },
  help: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  btn: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14, borderRadius: 16, marginBottom: spacing.sm,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hours: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  retry: { marginTop: spacing.md, paddingVertical: 10, minHeight: 40, justifyContent: 'center' },
  retryText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
  adWrap: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  adCard: { borderRadius: 20, padding: spacing.lg, minHeight: 96, justifyContent: 'center' },
  adTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  adSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  adImage: { width: '100%', height: 130, borderRadius: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.purple, width: 16 },
  footer: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: spacing.lg },
});
