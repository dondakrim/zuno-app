// Écran « Compte » — à placer dans src/screens/AccountScreen.js
// Dégradé fait avec de fines bandes de couleur : aucune nouvelle bibliothèque
// native, donc compatible avec EAS Update.
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import GradientHeader from '../components/GradientHeader';

// Mêmes liens que dans SettingsScreen.js
const PRIVACY_URL = 'https://claude.ai/artifact/W693o2tq7NtU93GffZanyM';
const TERMS_URL = 'https://claude.ai/artifact/REfBbZLXoVGSHUzu1FD7DW';

// kind : 'route' (écran de l'app), 'url' (lien web), 'soon' (pas encore disponible)
const GROUPS = [
  {
    title: 'Mon activité',
    items: [
      { label: 'Coupons', hint: 'Retrouve tes codes promo', icon: 'ticket-outline', tone: 'orange', kind: 'soon' },
      { label: 'Notifications', icon: 'notifications-outline', tone: 'purple', kind: 'route', route: 'Notifications' },
      { label: 'Liste des favoris', hint: 'Articles et boutiques enregistrés', icon: 'heart-outline', tone: 'red', kind: 'soon' },
    ],
  },
  {
    title: 'Préférences',
    items: [
      { label: 'Paramètres', hint: 'Thème, langue, devise et plus', icon: 'options-outline', tone: 'purple', kind: 'route', route: 'Settings' },
    ],
  },
  {
    title: 'Aide et communauté',
    items: [
      { label: 'Service clients', hint: 'WhatsApp, appel, email', icon: 'headset-outline', tone: 'green', kind: 'soon' },
      { label: 'Suggestions', hint: 'Dis-nous comment améliorer Zuno', icon: 'bulb-outline', tone: 'orange', kind: 'soon' },
      { label: 'Infos', hint: 'Alertes et avertissements de Zuno', icon: 'megaphone-outline', tone: 'blue', kind: 'soon' },
      { label: 'Blog', hint: 'Conseils et actualités', icon: 'book-outline', tone: 'purple', kind: 'soon' },
    ],
  },
  {
    title: 'Informations légales',
    items: [
      { label: 'Conditions générales', icon: 'document-text-outline', tone: 'purple', kind: 'url', url: TERMS_URL },
      { label: 'Politique de confidentialité', icon: 'shield-checkmark-outline', tone: 'purple', kind: 'url', url: PRIVACY_URL },
      { label: 'Politique de retour', icon: 'return-up-back-outline', tone: 'purple', kind: 'soon' },
      { label: 'Politique de remboursement', icon: 'cash-outline', tone: 'purple', kind: 'soon' },
      { label: 'Politique d’annulation', icon: 'close-circle-outline', tone: 'purple', kind: 'soon' },
      { label: 'FAQ', hint: 'Questions fréquentes', icon: 'help-circle-outline', tone: 'blue', kind: 'soon' },
    ],
  },
  {
    title: 'Sécurité',
    items: [
      { label: 'Reporter un utilisateur', hint: 'Signale un comportement suspect', icon: 'flag-outline', tone: 'red', kind: 'soon' },
    ],
  },
];

const TONES = {
  purple: { bg: '#ECE8FB', fg: '#2E0B8C' },
  orange: { bg: '#FFF1E6', fg: '#E85D00' },
  green: { bg: '#E3F5EC', fg: '#0E7A4B' },
  red: { bg: '#FDE7E5', fg: '#B3261E' },
  blue: { bg: '#E6F0FD', fg: '#1D5FC9' },
};

export default function AccountScreen({ navigation }) {
  const [name, setName] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const id = await getDeviceUserId();
          const { data } = await supabase.from('users').select('nom').eq('id', id).maybeSingle();
          if (alive && data && data.nom && data.nom !== 'Toi (test)') setName(data.nom);
        } catch (e) { /* l'écran reste utilisable sans le nom */ }
      })();
      return () => { alive = false; };
    }, [])
  );

  const open = (item) => {
    if (item.kind === 'route') return navigation.navigate(item.route);
    if (item.kind === 'url') return Linking.openURL(item.url).catch(() => Alert.alert('Lien indisponible', 'Réessaie dans un instant.'));
    Alert.alert(item.label, 'Cette section arrive bientôt.');
  };

  const initials = name ? name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <GradientHeader style={s.header}>
        <View style={s.headerRow}>
          <View style={s.avatar}>
            {initials
              ? <Text style={s.avatarText}>{initials}</Text>
              : <Ionicons name="person-outline" size={30} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.hello}>{name ? name : 'Bienvenue sur Zuno'}</Text>
            <Text style={s.helloSub}>
              {name ? 'Gère ton compte, tes préférences et ton aide.' : 'Connecte-toi pour profiter de toutes les fonctions.'}
            </Text>
          </View>
        </View>
      </GradientHeader>

      <View style={s.body}>
        {GROUPS.map((g) => (
          <View key={g.title} style={s.group}>
            <Text style={s.groupTitle}>{g.title}</Text>
            <View style={s.card}>
              {g.items.map((it, i) => {
                const tone = TONES[it.tone] || TONES.purple;
                return (
                  <TouchableOpacity
                    key={it.label}
                    style={[s.row, i > 0 && s.rowBorder]}
                    onPress={() => open(it)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={it.label}
                  >
                    <View style={[s.iconWrap, { backgroundColor: tone.bg }]}>
                      <Ionicons name={it.icon} size={20} color={tone.fg} />
                    </View>
                    <View style={s.rowText}>
                      <Text style={s.rowLabel}>{it.label}</Text>
                      {it.hint ? <Text style={s.rowHint}>{it.hint}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#A8A3BD" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={s.loginBtn}
          activeOpacity={0.85}
          onPress={() => Alert.alert('Se connecter', 'La connexion avec compte arrive bientôt.')}
          accessibilityRole="button"
        >
          <Ionicons name="log-in-outline" size={20} color="#fff" />
          <Text style={s.loginText}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F4FA' },
  header: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  hello: { color: '#fff', fontSize: 22, fontWeight: '800' },
  helloSub: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginTop: 4 },
  body: { marginTop: -28, paddingHorizontal: 16, gap: 20 },
  group: { gap: 8 },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B6585', paddingHorizontal: 8 },
  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', elevation: 2, shadowColor: '#2E0B8C', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F0EEF6' },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowHint: { fontSize: 12.5, color: '#6B6585', marginTop: 2 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 16, backgroundColor: colors.orange, elevation: 3 },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
