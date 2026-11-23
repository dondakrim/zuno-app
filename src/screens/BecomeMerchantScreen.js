// Écran « Compte marchand » — src/screens/BecomeMerchantScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius } from '../theme/colors';
import GradientHeader from '../components/GradientHeader';
import PlacementAd from '../components/PlacementAd';

const PERKS = [
  { icon: 'storefront-outline', text: 'Ta propre boutique visible par tous les acheteurs' },
  { icon: 'stats-chart-outline', text: 'Le suivi de tes ventes en temps réel' },
  { icon: 'wallet-outline', text: 'Tes versements simplifiés et sécurisés' },
];

export default function BecomeMerchantScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('aucun');
  const [note, setNote] = useState(null);
  const [shop, setShop] = useState('');

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);
    const { data } = await supabase.from('users')
      .select('merchant_status, merchant_note, boutique_nom').eq('id', user.id).single();
    if (data) { setStatus(data.merchant_status || 'aucun'); setNote(data.merchant_note); setShop(data.boutique_nom || ''); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!shop.trim()) return Alert.alert('Nom de boutique', 'Indique le nom de ta boutique.');
    setSending(true);
    const { data, error } = await supabase.rpc('request_merchant_account', { p_shop_name: shop.trim() });
    setSending(false);
    if (error) return Alert.alert('Erreur', error.message);
    setStatus(data || 'demande');
  };

  const statusBox = (icon, color, bg, text) => (
    <View style={[s.statusBox, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[s.statusText, { color }]}>{text}</Text>
    </View>
  );

  return (
    <View style={s.c}>
      <GradientHeader style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.title}>Compte marchand</Text>
        <View style={{ width: 36 }} />
      </GradientHeader>

      {loading ? (
        <View style={{ padding: 40 }}><ActivityIndicator color={colors.orange} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          {status === 'actif' && statusBox('checkmark-circle', colors.success, colors.successBg, 'Ton compte marchand est actif.')}
          {status === 'demande' && statusBox('time-outline', colors.purple, colors.tintOrange, 'Ta demande est en cours de validation. Tu recevras une notification.')}

          {(status === 'aucun' || status === 'refuse') && (
            <View style={s.card}>
              {status === 'refuse' && (
                <Text style={s.warn}>Ta dernière demande n'a pas été acceptée{note ? ' : ' + note : '.'}</Text>
              )}
              <Text style={s.cardTitle}>Ouvre ta boutique sur Zuno</Text>
              {PERKS.map((p) => (
                <View key={p.icon} style={s.perk}>
                  <View style={s.perkIcon}><Ionicons name={p.icon} size={18} color={colors.orange} /></View>
                  <Text style={s.perkText}>{p.text}</Text>
                </View>
              ))}
              <Text style={s.label}>Nom de ta boutique</Text>
              <TextInput
                style={s.input}
                placeholder="Ex : Boutique Aïcha"
                placeholderTextColor={colors.textMuted}
                value={shop}
                onChangeText={setShop}
              />
              <TouchableOpacity style={s.btn} onPress={send} disabled={sending}>
                <Text style={s.btnT}>{sending ? 'Envoi…' : 'Demander un compte marchand'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <PlacementAd placement="marchand" style={{ marginTop: spacing.md }} />
        </ScrollView>
      )}
    </View>
  );
}

const SH = { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 };
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 54, paddingBottom: 26, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.white },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...SH },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  perkIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tintOrange, alignItems: 'center', justifyContent: 'center' },
  perkText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: 46, paddingHorizontal: spacing.md, marginBottom: spacing.md, fontSize: 15, backgroundColor: colors.background, color: colors.textPrimary },
  warn: { fontSize: 13, color: colors.danger, marginBottom: spacing.md },
  btn: { backgroundColor: colors.orange, borderRadius: radius.lg, paddingVertical: spacing.md + 2, alignItems: 'center' },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  statusText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
