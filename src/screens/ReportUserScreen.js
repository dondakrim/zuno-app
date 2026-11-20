// Reporter un utilisateur — src/screens/ReportUserScreen.js
// Peut être ouvert avec : navigation.navigate('ReportUser', { userId, userName })
import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import InfoHeader from '../components/InfoHeader';

const REASONS = ['Arnaque ou fraude', 'Article non livré', 'Comportement abusif', 'Faux profil', 'Autre'];

export default function ReportUserScreen({ navigation, route }) {
  const preset = route?.params?.userId ? { id: route.params.userId, name: route.params.userName || 'Utilisateur' } : null;
  const [target, setTarget] = useState(preset);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const timer = useRef(null);

  const onQuery = (t) => {
    setQuery(t);
    clearTimeout(timer.current);
    const q = t.trim().replace(/[%,]/g, '');
    if (q.length < 2) return setResults([]);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const myId = await getDeviceUserId();
        const { data } = await supabase
          .from('public_profiles')
          .select('id, nom, boutique_nom')
          .or(`nom.ilike.%${q}%,boutique_nom.ilike.%${q}%`)
          .neq('id', myId)
          .limit(10);
        setResults(data || []);
      } catch (e) {
        setResults([]);
      }
      setSearching(false);
    }, 350);
  };

  const send = async () => {
    if (!target) return Alert.alert('Qui signaler ?', 'Choisis d’abord la personne.');
    if (!reason) return Alert.alert('Motif manquant', 'Choisis le motif du signalement.');
    setSending(true);
    try {
      const myId = await getDeviceUserId();
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: myId,
        reported_id: target.id,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;
      Alert.alert('Signalement envoyé', 'Merci. Notre équipe va examiner la situation.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Envoi impossible', 'Vérifie ta connexion et réessaie.');
    }
    setSending(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <InfoHeader title="Reporter un utilisateur" navigation={navigation} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>1. Qui veux-tu signaler ?</Text>
        {target ? (
          <View style={styles.picked}>
            <Ionicons name="person-circle-outline" size={22} color={colors.purple} />
            <Text style={styles.pickedName} numberOfLines={1}>{target.name}</Text>
            {!preset ? (
              <TouchableOpacity onPress={() => setTarget(null)} hitSlop={10}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            <TextInput style={styles.search} placeholder="Nom de la personne ou de la boutique" placeholderTextColor={colors.textMuted} value={query} onChangeText={onQuery} autoCapitalize="none" />
            {searching ? <ActivityIndicator color={colors.purple} style={{ marginTop: 8 }} /> : null}
            {results.map((u) => (
              <TouchableOpacity key={u.id} style={styles.result} onPress={() => setTarget({ id: u.id, name: u.boutique_nom || u.nom || 'Utilisateur' })}>
                <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.resultText}>{u.boutique_nom || u.nom || 'Sans nom'}</Text>
              </TouchableOpacity>
            ))}
            {query.trim().length >= 2 && !searching && results.length === 0 ? <Text style={styles.none}>Personne trouvée.</Text> : null}
          </>
        )}

        <Text style={[styles.label, { marginTop: spacing.lg }]}>2. Pourquoi ?</Text>
        <View style={styles.chips}>
          {REASONS.map((r) => (
            <TouchableOpacity key={r} style={[styles.chip, reason === r && styles.chipOn]} onPress={() => setReason(r)}>
              <Text style={[styles.chipText, reason === r && { color: colors.white }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>3. Explique (facultatif)</Text>
        <TextInput style={styles.input} multiline maxLength={2000} placeholder="Que s’est-il passé ?" placeholderTextColor={colors.textMuted} value={details} onChangeText={setDetails} textAlignVertical="top" />

        <TouchableOpacity style={[styles.btn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>Envoyer le signalement</Text>}
        </TouchableOpacity>
        <Text style={styles.note}>Ton signalement reste confidentiel : la personne signalée ne saura pas que c’est toi.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, fontWeight: '800', color: colors.purple, marginBottom: spacing.sm },
  search: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 14, color: colors.textPrimary },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginTop: 8 },
  resultText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  none: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.purple },
  pickedName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  input: { minHeight: 110, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 14, color: colors.textPrimary },
  btn: { backgroundColor: colors.danger, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  note: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: spacing.md, lineHeight: 16 },
});
