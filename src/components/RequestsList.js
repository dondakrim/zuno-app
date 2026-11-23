import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, Linking, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import ReceiptModal, { buildCourierReceipt, fmtDateTime } from './ReceiptModal';

const COURIER_STEPS = [
  ['nouvelle', 'Demande reçue'],
  ['acceptee', 'Coursier confirmé'],
  ['en_cours', 'En route'],
  ['livree', 'Livré'],
];
const SEEK_STEPS = [
  ['nouvelle', 'Demande reçue'],
  ['en_cours', 'Recherche en cours'],
  ['trouvee', 'Article trouvé'],
];
const SUPPORT_WA = '34627137449';

// Charge les demandes d'articles et de coursiers de l'utilisateur.
export async function fetchMyRequests() {
  const uid = await getDeviceUserId();
  const [a, c] = await Promise.all([
    supabase.from('article_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
    supabase.from('courier_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
  ]);
  return [
    ...(a.data || []).map((r) => ({ ...r, kind: 'seek' })),
    ...(c.data || []).map((r) => ({ ...r, kind: 'courier' })),
  ].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
}

// Nombre de demandes qui demandent l'attention (en cours, ou course livrée à noter).
export function countActive(rows) {
  return rows.filter((r) =>
    r.kind === 'courier'
      ? r.status === 'livree' ? !r.rating : !['annulee'].includes(r.status)
      : !['trouvee', 'annulee'].includes(r.status)
  ).length;
}

function Timeline({ steps, status }) {
  const canceled = status === 'annulee';
  const idx = steps.findIndex((x) => x[0] === status);
  return (
    <View style={{ marginTop: 10 }}>
      {steps.map(([code, label], i) => {
        const done = !canceled && idx >= i;
        const current = !canceled && idx === i;
        const last = i === steps.length - 1;
        return (
          <View key={code} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlDot, done && { backgroundColor: current && !last ? colors.orange : colors.success }]}>
                {done ? <Ionicons name={current && !last ? 'ellipse' : 'checkmark'} size={current && !last ? 8 : 13} color="#fff" /> : null}
              </View>
              {!last ? <View style={[styles.tlLine, !canceled && idx > i && { backgroundColor: colors.success }]} /> : null}
            </View>
            <Text style={[styles.tlText, done && { color: colors.textPrimary, fontWeight: current ? '700' : '500' }]}>{label}</Text>
          </View>
        );
      })}
      {canceled ? (
        <View style={styles.cancelBox}><Ionicons name="close-circle" size={16} color={colors.danger} /><Text style={styles.cancelText}>Demande annulée</Text></View>
      ) : null}
    </View>
  );
}

function Stars({ value, onChange, size = 30 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} disabled={!onChange} onPress={() => onChange && onChange(n)} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? '#F5A400' : colors.border} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RateCourier({ request, onDone }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!stars) { Alert.alert('Ta note', 'Choisis une note de 1 à 5 étoiles.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('rate_courier', { p_id: request.id, p_rating: stars, p_comment: comment.trim() || null });
    setBusy(false);
    if (error) { Alert.alert('Oups', "Impossible d'envoyer ta note. Réessaie dans un instant."); return; }
    onDone();
  };

  return (
    <View style={styles.rateBox}>
      <Text style={styles.rateTitle}>Notez votre coursier</Text>
      <Text style={styles.rateSub}>Ton avis nous aide à améliorer le service.</Text>
      <View style={{ marginTop: 10 }}><Stars value={stars} onChange={setStars} /></View>
      <TextInput
        style={styles.rateInput}
        value={comment}
        onChangeText={setComment}
        maxLength={300}
        multiline
        placeholder="Un commentaire ? (facultatif)"
        placeholderTextColor={colors.textMuted}
      />
      <TouchableOpacity style={styles.rateBtn} onPress={send} disabled={busy} activeOpacity={0.85}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.rateBtnText}>Envoyer ma note</Text>}
      </TouchableOpacity>
    </View>
  );
}

export default function RequestsList({ onLoaded }) {
  const [rows, setRows] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const load = useCallback(async () => {
    try {
      const all = await fetchMyRequests();
      setRows(all);
      if (onLoaded) onLoaded(all);
    } catch (e) { setRows([]); }
  }, [onLoaded]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (rows === null) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.purple} /></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bicycle-outline" size={42} color={colors.textMuted} />
          <Text style={styles.emptyText}>Aucune course ni recherche pour le moment.</Text>
          <Text style={styles.emptyHint}>Depuis l'accueil : « Commander un coursier » ou « Je cherche cet article ».</Text>
        </View>
      ) : rows.map((r) => {
        const seek = r.kind === 'seek';
        const steps = seek ? SEEK_STEPS : COURIER_STEPS;
        return (
          <View key={r.kind + r.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: seek ? colors.tintPurple : colors.tintOrange }]}>
                <Ionicons name={seek ? 'search' : 'bicycle'} size={18} color={seek ? colors.purple : colors.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>{seek ? r.title : `${r.pickup_address} → ${r.dropoff_address}`}</Text>
                <Text style={styles.cardSub}>{seek ? 'Je cherche cet article' : 'Coursier'} · {fmtDateTime(r.created_at)}</Text>
              </View>
            </View>
            {!seek && r.price_quote ? (
              <View style={styles.priceBox}><Text style={styles.priceLabel}>Prix de la course</Text><Text style={styles.priceValue}>{r.price_quote}</Text></View>
            ) : null}
            {!seek && ['acceptee', 'en_cours', 'livree'].includes(r.status) ? (
              <TouchableOpacity style={styles.receiptBtn} activeOpacity={0.85} onPress={() => setReceipt(buildCourierReceipt(r))}>
                <Ionicons name="receipt-outline" size={16} color={colors.purple} />
                <Text style={styles.receiptBtnText}>Voir le reçu</Text>
              </TouchableOpacity>
            ) : null}
            <Timeline steps={steps} status={r.status} />
            {r.admin_note ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteTitle}>Message de Zuno</Text>
                <Text style={styles.noteText}>{r.admin_note}</Text>
              </View>
            ) : null}
            {seek && r.status === 'trouvee' ? (
              <TouchableOpacity style={styles.waBtn} activeOpacity={0.85}
                onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent('Bonjour Zuno, au sujet de ma demande : ' + r.title)}`)}>
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.waBtnText}>Consulter mon WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
            {!seek && r.status === 'livree' ? (
              r.rating ? (
                <View style={styles.ratedBox}>
                  <Text style={styles.rateTitle}>Ta note</Text>
                  <View style={{ marginTop: 6 }}><Stars value={r.rating} size={22} /></View>
                  {r.rating_comment ? <Text style={styles.noteText}>{r.rating_comment}</Text> : null}
                </View>
              ) : (
                <RateCourier request={r} onDone={load} />
              )
            ) : null}
          </View>
        );
      })}
      <ReceiptModal visible={!!receipt} receipt={receipt} onClose={() => setReceipt(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 34 },
  tlRail: { width: 24, alignItems: 'center', marginRight: 10 },
  tlDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tlLine: { width: 2, flex: 1, minHeight: 14, backgroundColor: colors.border, marginVertical: 2 },
  tlText: { fontSize: 14, color: colors.textMuted, paddingTop: 1 },
  cancelBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  cancelText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.tintPurple, borderRadius: radius.md, paddingVertical: 10, marginTop: 12 },
  receiptBtnText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
  priceBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.tintOrange, borderRadius: radius.md, padding: 12, marginTop: 12 },
  priceLabel: { color: colors.textSecondary, fontSize: 13 },
  priceValue: { color: colors.orange, fontWeight: '800', fontSize: 16 },
  noteBox: { backgroundColor: colors.tintPurple, borderRadius: radius.md, padding: 12, marginTop: 12 },
  noteTitle: { color: colors.purple, fontWeight: '700', fontSize: 12, marginBottom: 3 },
  noteText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  waBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#25D366', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  waBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rateBox: { backgroundColor: '#FFF8E6', borderRadius: radius.md, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#F5E1A4' },
  ratedBox: { backgroundColor: colors.background, borderRadius: radius.md, padding: 14, marginTop: 14 },
  rateTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rateSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rateInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, marginTop: 12, minHeight: 56, textAlignVertical: 'top', fontSize: 14, color: colors.textPrimary },
  rateBtn: { backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  rateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyText: { color: colors.textSecondary, marginTop: 10, fontWeight: '600' },
  emptyHint: { color: colors.textMuted, marginTop: 6, textAlign: 'center', fontSize: 13 },
});
