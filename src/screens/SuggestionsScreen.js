// Suggestions — src/screens/SuggestionsScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import InfoHeader from '../components/InfoHeader';

const CATEGORIES = [
  ['idee', 'Une idée', 'bulb-outline'],
  ['probleme', 'Un problème', 'bug-outline'],
  ['autre', 'Autre', 'chatbubble-outline'],
];

export default function SuggestionsScreen({ navigation }) {
  const [category, setCategory] = useState('idee');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = message.trim();
    if (text.length < 3) return Alert.alert('Message trop court', 'Écris au moins quelques mots.');
    setSending(true);
    try {
      const myId = await getDeviceUserId();
      const { error } = await supabase.from('suggestions').insert({ user_id: myId, category, message: text });
      if (error) throw error;
      setMessage('');
      Alert.alert('Merci !', 'Ton message a bien été envoyé à l’équipe Zuno.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Envoi impossible', 'Vérifie ta connexion et réessaie.');
    }
    setSending(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <InfoHeader title="Suggestions" navigation={navigation} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Dis-nous comment améliorer Zuno. Chaque message est lu par l’équipe.</Text>
        <View style={styles.chips}>
          {CATEGORIES.map(([k, label, icon]) => (
            <TouchableOpacity key={k} style={[styles.chip, category === k && styles.chipOn]} onPress={() => setCategory(k)}>
              <Ionicons name={icon} size={16} color={category === k ? colors.white : colors.purple} />
              <Text style={[styles.chipText, category === k && { color: colors.white }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          multiline
          maxLength={2000}
          placeholder="Écris ton message ici…"
          placeholderTextColor={colors.textMuted}
          value={message}
          onChangeText={setMessage}
          textAlignVertical="top"
        />
        <Text style={styles.count}>{message.length} / 2000</Text>
        <TouchableOpacity style={[styles.btn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>Envoyer</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
  chips: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.purple, borderColor: colors.purple },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.purple },
  input: { minHeight: 160, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 14, color: colors.textPrimary },
  count: { alignSelf: 'flex-end', fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: spacing.md },
  btn: { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
