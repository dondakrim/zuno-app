// Fenêtre « Signaler cet utilisateur » — src/components/ReportUserModal.js
// Utilisation : <ReportUserModal visible={open} onClose={() => setOpen(false)} target={{ id, name }} />
import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

const REASONS = ['Arnaque ou fraude', 'Article non livré', 'Comportement abusif', 'Faux profil', 'Autre'];

export default function ReportUserModal({ visible, onClose, target }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    setReason(null);
    setDetails('');
    onClose?.();
  };

  const send = async () => {
    if (!target?.id) return;
    if (!reason) return Alert.alert('Motif manquant', 'Choisis le motif du signalement.');
    setSending(true);
    try {
      const myId = await getDeviceUserId();
      if (myId === target.id) {
        setSending(false);
        return Alert.alert('Impossible', 'Tu ne peux pas te signaler toi-même.');
      }
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: myId,
        reported_id: target.id,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;
      setSending(false);
      close();
      Alert.alert('Signalement envoyé', 'Merci. Notre équipe va examiner la situation.');
      return;
    } catch (e) {
      Alert.alert('Envoi impossible', 'Vérifie ta connexion et réessaie.');
    }
    setSending(false);
  };

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Ionicons name="flag" size={18} color={colors.danger} />
            <Text style={styles.title} numberOfLines={1}>Signaler {target?.name || 'cet utilisateur'}</Text>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Pourquoi ?</Text>
            <View style={styles.chips}>
              {REASONS.map((r) => (
                <TouchableOpacity key={r} style={[styles.chip, reason === r && styles.chipOn]} onPress={() => setReason(r)}>
                  <Text style={[styles.chipText, reason === r && { color: colors.white }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Explique (facultatif)</Text>
            <TextInput
              style={styles.input}
              multiline
              maxLength={2000}
              placeholder="Que s’est-il passé ?"
              placeholderTextColor={colors.textMuted}
              value={details}
              onChangeText={setDetails}
              textAlignVertical="top"
            />
            <TouchableOpacity style={[styles.btn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
              {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>Envoyer le signalement</Text>}
            </TouchableOpacity>
            <Text style={styles.note}>Ton signalement reste confidentiel.</Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,10,60,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: '85%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '800', color: colors.purple, marginBottom: spacing.sm, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  input: { minHeight: 90, backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 14, color: colors.textPrimary },
  btn: { backgroundColor: colors.danger, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  note: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
});
