import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { getDeviceUserId } from '../../lib/deviceUser';

const STATUS_INFO = {
  non_soumise: { label: 'Pas encore soumise', color: colors.textMuted, icon: 'ellipse-outline' },
  en_attente: { label: 'En attente de vérification', color: colors.orange, icon: 'time-outline' },
  verifiee: { label: 'Identité vérifiée', color: colors.success, icon: 'checkmark-circle' },
  rejetee: { label: "Refusée — réessaie avec une autre photo", color: colors.danger, icon: 'close-circle' },
};

export default function IdentityVerificationScreen({ navigation }) {
  const [status, setStatus] = useState('non_soumise');
  const [photoUri, setPhotoUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    const { data } = await supabase
      .from('users')
      .select('identity_status')
      .eq('id', myId)
      .maybeSingle();
    setStatus(data?.identity_status || 'non_soumise');
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation nécessaire', "Zuno a besoin d'accéder à tes photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri) {
      Alert.alert('Photo manquante', "Choisis d'abord une photo de ta pièce d'identité.");
      return;
    }

    setUploading(true);
    try {
      const myId = await getDeviceUserId();
      const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });
      const fileName = `${myId}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('identity-documents')
        .upload(fileName, decode(base64), { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('users')
        .update({ id_document_url: fileName, identity_status: 'en_attente' })
        .eq('id', myId);
      if (updateError) throw updateError;

      setStatus('en_attente');
      setPhotoUri(null);
      Alert.alert(
        'Envoyée',
        'Ta pièce a bien été transmise. La vérification est faite manuellement, ça peut prendre un peu de temps.'
      );
    } catch (e) {
      Alert.alert('Erreur', `Détail technique : ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const info = STATUS_INFO[status] || STATUS_INFO.non_soumise;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vérification d'identité</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <View style={styles.body}>
          <View style={styles.statusCard}>
            <Ionicons name={info.icon} size={22} color={info.color} />
            <Text style={[styles.statusText, { color: info.color }]}>{info.label}</Text>
          </View>

          <Text style={styles.explanation}>
            Un badge "Identité vérifiée" s'affiche sur ton profil une fois ta pièce validée —
            ça rassure les acheteurs. Envoie une photo lisible d'une pièce officielle (carte
            d'identité, passeport ou permis de conduire).
          </Text>

          {(status === 'non_soumise' || status === 'rejetee') && (
            <>
              <TouchableOpacity style={styles.pickZone} onPress={handlePickImage}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.previewImage} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={26} color={colors.textMuted} />
                    <Text style={styles.pickZoneText}>Choisir une photo</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, !photoUri && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={uploading || !photoUri}
              >
                <Text style={styles.submitButtonText}>
                  {uploading ? 'Envoi…' : 'Envoyer pour vérification'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {status === 'en_attente' && (
            <Text style={styles.waitingText}>
              On te tiendra au courant une fois la vérification faite. Reviens sur cet écran pour
              voir l'avancement.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.purple,
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  body: { padding: spacing.lg },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusText: { fontSize: 14, fontWeight: '700' },
  explanation: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.lg },
  pickZone: {
    height: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  pickZoneText: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  previewImage: { width: '100%', height: '100%' },
  submitButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  waitingText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});
