// Écran « Compte » — à placer dans src/screens/AccountScreen.js
// Dégradé fait avec de fines bandes de couleur : aucune nouvelle bibliothèque
// native, donc compatible avec EAS Update.
import { usePrefs } from '../lib/prefs';
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
      { label: 'Coupons', hint: 'Retrouve tes codes promo', icon: 'ticket-outline', tone: 'orange', kind: 'route', route: 'Coupons' },
      { label: 'Notifications', icon: 'notifications-outline', tone: 'purple', kind: 'route', route: 'Notifications' },
      { label: 'Liste des favoris', hint: 'Articles et boutiques enregistrés', icon: 'heart-outline', tone: 'red', kind: 'route', route: 'Favorites' },
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
      { label: 'Service clients', hint: 'WhatsApp, appel, email', icon: 'headset-outline', tone: 'green', kind: 'route', route: 'Support' },
      { label: 'Suggestions', hint: 'Dis-nous comment améliorer Zuno', icon: 'bulb-outline', tone: 'orange', kind: 'route', route: 'Suggestions' },
      { label: 'Infos', hint: 'Alertes et avertissements de Zuno', icon: 'megaphone-outline', tone: 'blue', kind: 'route', route: 'Infos' },
      { label: 'Blog', hint: 'Conseils et actualités', icon: 'book-outline', tone: 'purple', kind: 'route', route: 'Blog' },
    ],
  },
  {
    title: 'Informations légales',
    items: [
      { label: 'Conditions générales', icon: 'document-text-outline', tone: 'purple', kind: 'route', route: 'Legal', params: { kind: 'cgu' } },
      { label: 'Politique de confidentialité', icon: 'shield-checkmark-outline', tone: 'purple', kind: 'route', route: 'Legal', params: { kind: 'confidentialite' } },
      { label: 'Politique de retour', icon: 'return-up-back-outline', tone: 'purple', kind: 'route', route: 'Legal', params: { kind: 'retour' } },
      { label: 'Politique de remboursement', icon: 'cash-outline', tone: 'purple', kind: 'route', route: 'Legal', params: { kind: 'remboursement' } },
      { label: 'Politique d’annulation', icon: 'close-circle-outline', tone: 'purple', kind: 'route', route: 'Legal', params: { kind: 'annulation' } },
      { label: 'FAQ', hint: 'Questions fréquentes', icon: 'help-circle-outline', tone: 'blue', kind: 'route', route: 'Faq' },
    ],
  },
  {
    title: 'Sécurité',
    items: [
      { label: 'Reporter un utilisateur', hint: 'Signale un comportement suspect', icon: 'flag-outline', tone: 'red', kind: 'route', route: 'ReportUser' },
    ],
  },
];

const TONES = {
  purple: { bg: colors.tintPurple, fg: colors.purple },
  orange: { bg: colors.tintOrange, fg: colors.orange },
  green: { bg: colors.successBg, fg: colors.success },
  red: { bg: colors.tintRed, fg: colors.danger },
  blue: { bg: colors.tintBlue, fg: colors.blue },
};

export default function AccountScreen({ navigation }) {
  const { t } = usePrefs();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const id = await getDeviceUserId();
          const { data: { session } } = await supabase.auth.getSession();
          if (alive) setPhone(session?.user && !session.user.is_anonymous ? (session.user.phone ? '+' + String(session.user.phone).replace(/^\+/, '') : '') : '');
          const { data } = await supabase.from('users').select('nom').eq('id', id).maybeSingle();
          if (alive && data && data.nom && data.nom !== 'Toi (test)') setName(data.nom);
        } catch (e) { /* l'écran reste utilisable sans le nom */ }
      })();
      return () => { alive = false; };
    }, [])
  );

  const open = (item) => {
    if (item.kind === 'route') return navigation.navigate(item.route, item.params);
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
            <Text style={s.hello}>{name ? name : t('Bienvenue sur Zuno')}</Text>
            <Text style={s.helloSub}>
              {name ? t('Gère ton compte, tes préférences et ton aide.') : t('Connecte-toi pour profiter de toutes les fonctions.')}
            </Text>
          </View>
        </View>
      </GradientHeader>

      <View style={s.body}>
        {GROUPS.map((g) => (
          <View key={g.title} style={s.group}>
            <Text style={s.groupTitle}>{t(g.title)}</Text>
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
                    accessibilityLabel={t(it.label)}
                  >
                    <View style={[s.iconWrap, { backgroundColor: tone.bg }]}>
                      <Ionicons name={it.icon} size={20} color={tone.fg} />
                    </View>
                    <View style={s.rowText}>
                      <Text style={s.rowLabel}>{t(it.label)}</Text>
                      {it.hint ? <Text style={s.rowHint}>{t(it.hint)}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {phone ? (
          <View style={[s.loginBtn, { backgroundColor: colors.successBg, elevation: 0 }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[s.loginText, { color: colors.success }]}>{t('Connecté')} · {phone}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={s.loginBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PhoneLogin')}
            accessibilityRole="button"
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={s.loginText}>{t('Se connecter avec WhatsApp')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  hello: { color: '#fff', fontSize: 22, fontWeight: '800' },
  helloSub: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginTop: 4 },
  body: { marginTop: -28, paddingHorizontal: 16, gap: 20 },
  group: { gap: 8 },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', color: colors.textSecondary, paddingHorizontal: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', elevation: 2, shadowColor: '#2E0B8C', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowHint: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 16, backgroundColor: colors.orange, elevation: 3 },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
