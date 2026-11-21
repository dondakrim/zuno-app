import React, { useState, useCallback, useMemo } from 'react';
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
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import { AVATAR_PALETTE, AvatarGlyph } from '../components/Avatar';
import PhoneInput from '../components/PhoneInput';
import GradientHeader from '../components/GradientHeader';

const digitsOf = (s) => String(s || '').replace(/\D/g, '');
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

// Petit bloc « titre de section »
function Section({ icon, title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={16} color={colors.purple} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.star}> *</Text> : <Text style={styles.optional}>  (facultatif)</Text>}
      </Text>
      {children}
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export default function EditProfileScreen({ navigation }) {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [ville, setVille] = useState('');
  const [boutiqueNom, setBoutiqueNom] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [newPhotoUri, setNewPhotoUri] = useState(null);
  const [avatarIcon, setAvatarIcon] = useState(null);
  const [avatarColor, setAvatarColor] = useState(null);
  const [showPalette, setShowPalette] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false); // l'utilisateur a déjà essayé d'enregistrer

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();
    const { data } = await supabase
      .from('users')
      .select('nom, telephone, whatsapp, email, ville, boutique_nom, photo_url, avatar_icon, avatar_color')
      .eq('id', myId)
      .maybeSingle();

    if (data) {
      const full = data.nom && data.nom !== 'Toi (test)' ? data.nom.trim() : '';
      const parts = full.split(/\s+/).filter(Boolean);
      setPrenom(parts[0] || '');
      setNom(parts.slice(1).join(' '));
      setTelephone(data.telephone?.startsWith('local-') ? '' : data.telephone || '');
      setWhatsapp(data.whatsapp || '');
      setEmail(data.email || '');
      setVille(data.ville || '');
      setBoutiqueNom(data.boutique_nom || '');
      setPhotoUrl(data.photo_url || null);
      setAvatarIcon(data.avatar_icon || null);
      setAvatarColor(data.avatar_color || null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // Erreurs par champ
  const errors = useMemo(() => {
    const e = {};
    if (prenom.trim().length < 2) e.prenom = 'Indique ton prénom.';
    if (nom.trim().length < 2) e.nom = 'Indique ton nom.';
    if (digitsOf(telephone).length < 8) e.telephone = 'Indique un numéro de téléphone valide.';
    if (whatsapp.trim() && digitsOf(whatsapp).length < 8) e.whatsapp = 'Numéro WhatsApp incomplet.';
    if (email.trim() && !isEmail(email.trim())) e.email = "Cette adresse email n'a pas l'air correcte.";
    return e;
  }, [prenom, nom, telephone, whatsapp, email]);

  // Progression : 3 champs obligatoires + photo/icône + ville
  const progress = useMemo(() => {
    const checks = [
      prenom.trim().length >= 2,
      nom.trim().length >= 2,
      digitsOf(telephone).length >= 8,
      !!(avatarIcon || photoUrl || newPhotoUri),
      ville.trim().length >= 2,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [prenom, nom, telephone, avatarIcon, photoUrl, newPhotoUri, ville]);

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
      setAvatarIcon(null);
      setAvatarColor(null);
    }
  };

  const handlePickIcon = (choice) => {
    setAvatarIcon(choice.icon);
    setAvatarColor(choice.color);
    setNewPhotoUri(null);
    setPhotoUrl(null);
    setShowPalette(false);
  };

  const handleSave = async () => {
    setTried(true);
    if (Object.keys(errors).length > 0) {
      Alert.alert('Il manque des informations', 'Complète les champs marqués en rouge pour continuer.');
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
          nom: `${prenom.trim()} ${nom.trim()}`,
          telephone: telephone.trim(),
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          ville: ville.trim() || null,
          boutique_nom: boutiqueNom.trim() || null,
          photo_url: avatarIcon ? null : finalPhotoUrl,
          avatar_icon: avatarIcon,
          avatar_color: avatarColor,
        })
        .eq('id', myId);
      if (error) throw error;

      Alert.alert('Profil enregistré ✅', 'Tes informations sont à jour.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', `Détail technique : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const displayPhoto = newPhotoUri || photoUrl;
  const show = (k) => (tried ? errors[k] : undefined);
  const initials = ((prenom[0] || '') + (nom[0] || '')).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon profil</Text>
        <View style={{ width: 22 }} />
      </GradientHeader>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Avatar + progression */}
          <View style={styles.topCard}>
            <View style={styles.avatarWrap}>
              {avatarIcon ? (
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <AvatarGlyph icon={avatarIcon} size={38} />
                </View>
              ) : displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  {initials ? (
                    <Text style={styles.initials}>{initials}</Text>
                  ) : (
                    <Ionicons name="person" size={36} color={colors.textMuted} />
                  )}
                </View>
              )}
              <TouchableOpacity style={styles.cameraBadge} onPress={handlePickPhoto}>
                <Ionicons name="camera" size={13} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.photoActionsRow}>
              <TouchableOpacity onPress={handlePickPhoto} style={styles.chip}>
                <Ionicons name="image-outline" size={14} color={colors.purple} />
                <Text style={styles.chipText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowPalette(true)} style={styles.chip}>
                <Ionicons name="color-palette-outline" size={14} color={colors.purple} />
                <Text style={styles.chipText}>Icône</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Profil complété à {progress}%</Text>
              {progress === 100 ? <Ionicons name="checkmark-circle" size={16} color={colors.success} /> : null}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              Un profil complet inspire confiance aux acheteurs et aux vendeurs.
            </Text>
          </View>

          <Modal visible={showPalette} transparent animationType="fade" onRequestClose={() => setShowPalette(false)}>
            <View style={styles.paletteOverlay}>
              <View style={styles.paletteCard}>
                <Text style={styles.paletteTitle}>Choisis un avatar</Text>
                <FlatList
                  data={AVATAR_PALETTE}
                  showsVerticalScrollIndicator={false}
                  numColumns={4}
                  keyExtractor={(item) => item.icon}
                  columnWrapperStyle={{ gap: spacing.sm, marginBottom: spacing.sm }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.paletteItem, { backgroundColor: item.color }]}
                      onPress={() => handlePickIcon(item)}
                    >
                      <AvatarGlyph icon={item.icon} size={26} />
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity onPress={() => setShowPalette(false)} style={styles.paletteCancel}>
                  <Text style={styles.paletteCancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Section icon="person-outline" title="Qui es-tu ?">
            <Field label="Prénom" required error={show('prenom')}>
              <TextInput
                placeholder="Ex : Aïssata"
                placeholderTextColor={colors.textMuted}
                value={prenom}
                onChangeText={setPrenom}
                autoCapitalize="words"
                style={[styles.input, show('prenom') && styles.inputError]}
              />
            </Field>
            <Field label="Nom" required error={show('nom')}>
              <TextInput
                placeholder="Ex : Moussa"
                placeholderTextColor={colors.textMuted}
                value={nom}
                onChangeText={setNom}
                autoCapitalize="words"
                style={[styles.input, show('nom') && styles.inputError]}
              />
            </Field>
          </Section>

          <Section icon="call-outline" title="Comment te joindre ?">
            <Field
              label="Numéro de téléphone"
              required
              error={show('telephone')}
              hint="Utilisé pour la livraison. Il n'est jamais affiché dans les messages."
            >
              <PhoneInput value={telephone} onChangeValue={setTelephone} />
            </Field>
            <Field label="Numéro WhatsApp" error={show('whatsapp')}>
              <PhoneInput value={whatsapp} onChangeValue={setWhatsapp} />
            </Field>
            <Field label="Adresse email" error={show('email')}>
              <TextInput
                placeholder="toi@exemple.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, show('email') && styles.inputError]}
              />
            </Field>
          </Section>

          <Section icon="location-outline" title="Où es-tu ?">
            <Field label="Ville, quartier" hint="Aide les acheteurs à savoir si tu es près d'eux.">
              <TextInput
                placeholder="Ex : Plateau, Niamey"
                placeholderTextColor={colors.textMuted}
                value={ville}
                onChangeText={setVille}
                style={styles.input}
              />
            </Field>
            <Field
              label="Nom de la boutique"
              hint='Affiché à la place de "Ma boutique" dans ton espace marchand.'
            >
              <TextInput
                placeholder="Si tu vends régulièrement sur Zuno"
                placeholderTextColor={colors.textMuted}
                value={boutiqueNom}
                onChangeText={setBoutiqueNom}
                style={styles.input}
              />
            </Field>
          </Section>

          <Text style={styles.legend}>
            <Text style={styles.star}>*</Text> Informations obligatoires
          </Text>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                <Text style={styles.saveButtonText}>Enregistrer mon profil</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  body: { padding: spacing.lg, paddingBottom: 48 },

  topCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarWrap: { position: 'relative', marginBottom: spacing.md },
  avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  avatarEmpty: { backgroundColor: colors.tintPurple || colors.background, borderWidth: 1, borderColor: colors.border },
  initials: { fontSize: 30, fontWeight: '800', color: colors.purple },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  photoActionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.tintPurple || colors.background,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.purple },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch', marginBottom: 6 },
  progressLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  progressTrack: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.orange },
  progressHint: { alignSelf: 'stretch', fontSize: 11, color: colors.textMuted, marginTop: 8 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  cardIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.tintPurple || colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  star: { color: colors.danger, fontWeight: '800' },
  optional: { color: colors.textMuted, fontWeight: '400', fontSize: 12 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 46,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
  },
  inputError: { borderColor: colors.danger },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  errorText: { fontSize: 12, color: colors.danger },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 5 },
  legend: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginVertical: spacing.sm },

  saveButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  paletteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  paletteCard: { width: '100%', maxHeight: '82%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  paletteTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' },
  paletteItem: { flex: 1, aspectRatio: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  paletteCancel: { marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  paletteCancelText: { color: colors.textSecondary, fontWeight: '600' },
});
