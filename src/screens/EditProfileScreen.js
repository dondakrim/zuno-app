import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

export default function EditProfileScreen({ navigation }) {
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [ville, setVille] = useState('');
  const [boutiqueNom, setBoutiqueNom] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [newPhotoUri, setNewPhotoUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    const { data } = await supabase
      .from('users')
      .select('nom, telephone, whatsapp, email, ville, boutique_nom, photo_url')
      .eq('id', myId)
      .maybeSingle();

    if (data) {
      setNom(data.nom && data.nom !== 'Toi (test)' ? data.nom : '');
      setTelephone(data.telephone?.startsWith('local-') ? '' : data.telephone || '');
      setWhatsapp(data.whatsapp || '');
      setEmail(data.email || '');
      setVille(data.ville || '');
      setBoutiqueNom(data.boutique_nom || '');
      setPhotoUrl(data.photo_url || null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation nécessaire', "Zuno a besoin d'accéder à tes photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      setNewPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!nom.trim()) {
      Alert.alert('Nom manquant', 'Indique au moins ton nom complet.');
      return;
    }

    setSaving(true);
    try {
      const myId = await getDeviceUserId();
      let finalPhotoUrl = photoUrl;

      if (newPhotoUri) {
        const base64 = await FileSystem.readAsStringAsync(newPhotoUri, { encoding: 'base64' });
        const fileName = `${myId}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, decode(base64), { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('profile-photos').getPublicUrl(fileName);
        finalPhotoUrl = data.publicUrl;
      }

      const { error } = await supabase
        .from('users')
        .update({
          nom: nom.trim(),
          telephone: telephone.trim() || undefined,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          ville: ville.trim() || null,
          boutique_nom: boutiqueNom.trim() || null,
          photo_url: finalPhotoUrl,
        })
        .eq('id', myId);
      if (error) throw error;

      Alert.alert('Profil mis à jour', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Erreur', `Détail technique : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const displayPhoto = newPhotoUri || photoUrl;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier mon profil</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto}>
            {displayPhoto ? (
              <Image source={{ uri: displayPhoto }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={26} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.photoEditBadge}>
              <Ionicons name="pencil" size={12} color={colors.white} />
            </View>
          </TouchableOpacity>

          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            placeholder="Ton nom et prénom"
            placeholderTextColor={colors.textMuted}
            value={nom}
            onChangeText={setNom}
            style={styles.input}
          />

          <Text style={styles.label}>Numéro de téléphone</Text>
          <TextInput
            placeholder="+227 90 00 00 00"
            placeholderTextColor={colors.textMuted}
            value={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Numéro WhatsApp</Text>
          <TextInput
            placeholder="+227 90 00 00 00"
            placeholderTextColor={colors.textMuted}
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Adresse email (facultatif)</Text>
          <TextInput
            placeholder="toi@exemple.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Ville, quartier</Text>
          <TextInput
            placeholder="Ex: Plateau, Niamey"
            placeholderTextColor={colors.textMuted}
            value={ville}
            onChangeText={setVille}
            style={styles.input}
          />

          <Text style={styles.label}>Nom de la boutique (facultatif)</Text>
          <TextInput
            placeholder="Si tu vends régulièrement sur Zuno"
            placeholderTextColor={colors.textMuted}
            value={boutiqueNom}
            onChangeText={setBoutiqueNom}
            style={styles.input}
          />
          <Text style={styles.hint}>
            Affiché à la place de "Ma boutique" dans ton tableau de bord marchand, si tu es en
            mode marchand.
          </Text>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  photoPicker: { alignSelf: 'center', marginBottom: spacing.xl, position: 'relative' },
  photoImage: { width: 90, height: 90, borderRadius: 45 },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 44,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  hint: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.md },
  saveButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
