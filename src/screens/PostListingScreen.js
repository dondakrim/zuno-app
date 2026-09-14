import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, radius } from '../theme/colors';
import { categories } from '../data/mockListings';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

const conditions = ['Neuf', 'Bon état', 'Usé'];
const delais = ['1-2 jours', '3-5 jours', '1 semaine', 'Plus d\'une semaine'];
const MIN_PHOTOS = 4;
const MAX_PHOTOS = 8;

export default function PostListingScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [condition, setCondition] = useState(conditions[1]);
  const [delaiLivraison, setDelaiLivraison] = useState(delais[0]);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Autorisation nécessaire',
        "Zuno a besoin d'accéder à tes photos. Active l'autorisation dans les réglages de ton téléphone."
      );
      return;
    }

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert('Maximum atteint', `Tu peux ajouter jusqu'à ${MAX_PHOTOS} photos.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (uri) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  // Envoie une photo vers l'espace de stockage Supabase et renvoie son
  // adresse publique, à enregistrer avec l'annonce.
  const uploadPhoto = async (uri, index) => {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const fileName = `${Date.now()}-${index}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('listings-images')
      .upload(fileName, decode(base64), { contentType: 'image/jpeg' });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('listings-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handlePublish = async () => {
    if (!title.trim() || !price.trim() || !city.trim()) {
      Alert.alert('Champs manquants', 'Titre, prix et ville sont obligatoires.');
      return;
    }

    if (photos.length < MIN_PHOTOS) {
      Alert.alert(
        'Plus de photos nécessaires',
        `Ajoute au moins ${MIN_PHOTOS} photos pour bien présenter ton article (${photos.length}/${MIN_PHOTOS} pour l'instant).`
      );
      return;
    }

    setSaving(true);

    let photoUrls = [];
    try {
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress(`Envoi de la photo ${i + 1}/${photos.length}…`);
        const url = await uploadPhoto(photos[i], i);
        photoUrls.push(url);
      }
    } catch (e) {
      console.error('Erreur upload photo:', e);
      setSaving(false);
      setUploadProgress('');
      Alert.alert('Photos non envoyées', `Détail technique : ${e.message || JSON.stringify(e)}`);
      return;
    }
    setUploadProgress('');

    const myId = await getDeviceUserId();
    const { error } = await supabase.from('listings').insert({
      vendeur_id: myId,
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      city: city.trim(),
      category,
      condition,
      delai_livraison: delaiLivraison,
      photo_url: photoUrls[0],
      photos: photoUrls,
      status: 'disponible',
    });
    setSaving(false);

    if (error) {
      console.error('Erreur insertion annonce:', error);
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }

    Alert.alert('Publiée', 'Ton annonce est en ligne.');
    setTitle('');
    setDescription('');
    setPrice('');
    setCity('');
    setPhotos([]);
    setDelaiLivraison(delais[0]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.heading}>Nouvelle annonce</Text>

      <View style={styles.photoHeaderRow}>
        <Text style={styles.label}>
          Photos ({photos.length}/{MIN_PHOTOS} minimum)
        </Text>
      </View>

      <View style={styles.photoGrid}>
        {photos.map((uri) => (
          <View key={uri} style={styles.photoTile}>
            <Image source={{ uri }} style={styles.photoImage} />
            <TouchableOpacity style={styles.removeBadge} onPress={() => removePhoto(uri)}>
              <Ionicons name="close" size={14} color={colors.white} />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity style={styles.addTile} onPress={handlePickImages}>
            <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
            <Text style={styles.addTileText}>Ajouter</Text>
          </TouchableOpacity>
        )}
      </View>
      {photos.length < MIN_PHOTOS && (
        <Text style={styles.photoHint}>
          Encore {MIN_PHOTOS - photos.length} photo{MIN_PHOTOS - photos.length > 1 ? 's' : ''} pour
          pouvoir publier — plusieurs angles rassurent les acheteurs.
        </Text>
      )}

      <TextInput
        placeholder="Titre de l'article"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        style={[styles.input, { marginTop: spacing.md }]}
      />

      <Text style={styles.label}>Présentation de l'article</Text>
      <TextInput
        placeholder="Décris l'article : état détaillé, raison de la vente, ce qui est inclus…"
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={setDescription}
        style={styles.textarea}
        multiline
        numberOfLines={4}
      />

      <TextInput
        placeholder="Prix en FCFA"
        placeholderTextColor={colors.textMuted}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.pillRow}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.pill, category === c && styles.pillActive]}
          >
            <Text style={[styles.pillText, category === c && styles.pillTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>État</Text>
      <View style={styles.pillRow}>
        {conditions.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCondition(c)}
            style={[styles.pill, condition === c && styles.pillActive]}
          >
            <Text style={[styles.pillText, condition === c && styles.pillTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        placeholder="Ville, quartier"
        placeholderTextColor={colors.textMuted}
        value={city}
        onChangeText={setCity}
        style={[styles.input, { marginTop: spacing.sm }]}
      />

      <Text style={styles.label}>Délai de livraison estimé</Text>
      <View style={styles.pillRow}>
        {delais.map((d) => (
          <TouchableOpacity
            key={d}
            onPress={() => setDelaiLivraison(d)}
            style={[styles.pill, delaiLivraison === d && styles.pillActive]}
          >
            <Text style={[styles.pillText, delaiLivraison === d && styles.pillTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.publishButton, photos.length < MIN_PHOTOS && styles.publishButtonDisabled]}
        onPress={handlePublish}
        disabled={saving}
      >
        {saving ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color={colors.white} size="small" />
            <Text style={styles.publishButtonText}>{uploadProgress || 'Publication…'}</Text>
          </View>
        ) : (
          <Text style={styles.publishButtonText}>Publier l'annonce</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: spacing.md, color: colors.textPrimary },
  photoHeaderRow: { marginBottom: spacing.xs },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoTile: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: { width: '100%', height: '100%' },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileText: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  photoHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 44,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  pillText: { fontSize: 12, color: colors.textPrimary },
  pillTextActive: { color: colors.white, fontWeight: '600' },
  publishButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  publishButtonDisabled: { opacity: 0.5 },
  publishButtonText: { color: colors.white, fontWeight: '600' },
});
