import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius } from '../theme/colors';
import { getDeviceUserId } from '../lib/deviceUser';

function SettingsRow({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const handleResetIdentity = () => {
    Alert.alert(
      "Changer d'identité de test",
      'Utile uniquement pour tester la messagerie et les commandes seul, sans deuxième téléphone.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Changer',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('zuno_device_user_id');
            await getDeviceUserId();
            Alert.alert('Fait', 'Tu es maintenant un nouvel utilisateur de test.');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.groupTitle}>Compte</Text>
        <View style={styles.group}>
          <SettingsRow icon="person-outline" label="Profil" onPress={() => navigation.navigate('Moi')} />
          <SettingsRow
            icon="swap-horizontal-outline"
            label="Changer d'identité (test)"
            onPress={handleResetIdentity}
          />
        </View>

        <Text style={styles.groupTitle}>À propos</Text>
        <View style={styles.group}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0 (test)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Langue</Text>
            <Text style={styles.infoValue}>Français</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  body: { padding: spacing.lg },
  groupTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontSize: 14, color: colors.textPrimary },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { fontSize: 14, color: colors.textPrimary },
  infoValue: { fontSize: 14, color: colors.textSecondary },
});
