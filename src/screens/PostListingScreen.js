import React, { useState, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, radius } from '../theme/colors';
import { categories } from '../data/mockListings';
import { supabase } from '../lib/supabase';
import { getDeviceUserId, ensureAccountComplete } from '../lib/deviceUser';
import { analyzeListing } from '../lib/moderation';
import { checkMessage } from '../lib/chatGuard';
import GradientHeader from '../components/GradientHeader';

const conditions = ['Neuf', 'Bon état', 'Usé'];
const delais = ['1-2 jours', '3-5 jours', '1 semaine', "Plus d'une semaine"];
const MIN_PHOTOS = 4;
const MAX_PHOTOS = 8;
const TITLE_MAX = 80;
const DESC_MAX = 1000;

const digits = (s) => String(s || '').replace(/\D/g, '');
const money = (s) => (digits(s) ? Number(digits(s)).toLocaleString('fr-FR') : '');

function Card({ icon, title, subtitle, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={16} color={colors.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Err({ text }) {
  if (!text) return null;
  return (
    <View style={styles.errRow}>
      <Ionicons name="alert-circle" size={13} color={colors.danger} />
      <Text style={styles.errText}>{text}</Text>
    </View>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <View style={styles.pillRow}>
      {options.map((c) => (
        <TouchableOpacity
          key={c}
          onPress={() => onChange(c)}
          style={[styles.pill, value === c && styles.pillActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.pillText, value === c && styles.pillTextActive]}>{c}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function PostListingScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [isHeavyManual, setIsHeavyManual] = useState(false);
  const [condition, setCondition] = useState(conditions[1]);
  const [delaiLivraison, setDelaiLivraison] = useState(delais[0]);
  const [showPromo, setShowPromo] = useState(false);
  const [promoPrice, setPromoPrice] = useState('');
  const [certified, setCertified] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [tried, setTried] = useState(false);

  const errors = useMemo(() => {
    const e = {};
    if (title.trim().length < 3) e.title = 'Donne un titre à ton article (3 lettres minimum).';
    else if (checkMessage(title)) e.title = 'Pas de numéro, email ou lien dans le titre.';
    if (checkMessage(description)) {
      e.description = "Pas de numéro, email, lien ni WhatsApp dans la description : les acheteurs te contactent via Zuno.";
    }
    if (!digits(price) || Number(digits(price)) <= 0) e.price = 'Indique un prix en FCFA.';
    if (showPromo && promoPrice.trim() && Number(digits(promoPrice)) >= Number(digits(price))) {
      e.promo = 'Le prix promo doit être inférieur au prix normal.';
    }
    if (city.trim().length < 2) e.city = 'Indique ta ville ou ton quartier.';
    return e;
  }, [title, description, price, promoPrice, showPromo, city]);

  const missingPhotos = Math.max(0, MIN_PHOTOS - photos.length);
  const show = (k) => (tried || (k === 'description' && description.length > 0) ? errors[k] : undefined);

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

  const makeMain = (uri) => {
    setPhotos((prev) => [uri, ...prev.filter((p) => p !== uri)]);
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
    const ok = await ensureAccountComplete(navigation, 'publier une annonce');
    if (!ok) return;

    setTried(true);
    if (Object.keys(errors).length > 0) {
      Alert.alert('Il manque des informations', 'Complète les champs marqués en rouge.');
      return;
    }

    if (photos.length < MIN_PHOTOS) {
      Alert.alert(
        'Plus de photos nécessaires',
        `Ajoute au moins ${MIN_PHOTOS} photos pour bien présenter ton article (${photos.length}/${MIN_PHOTOS} pour l'instant).`
      );
      return;
    }

    if (!certified) {
      Alert.alert(
        'Certification requise',
        "Coche la case en bas confirmant que tu es responsable de l'état et de la provenance de cet article avant de publier."
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

    // Couches 1 et 2 de la modération : règles de mots-clés + score de
    // risque, calculés avant même d'insérer l'annonce.
    const analysis = analyzeListing({
      title: title.trim(),
      description: description.trim(),
      category,
      price: Number(digits(price)),
    });

    const moderationStatus =
      analysis.recommendation === 'block'
        ? 'blocked'
        : analysis.recommendation === 'review'
        ? 'pending_review'
        : 'approved';

    const myId = await getDeviceUserId();
    const { data: newListing, error } = await supabase
      .from('listings')
      .insert({
        vendeur_id: myId,
        title: title.trim(),
        description: description.trim(),
        price: Number(digits(price)),
        city: city.trim(),
        category,
        condition,
        delai_livraison: delaiLivraison,
        photo_url: photoUrls[0],
        photos: photoUrls,
        promo_price: showPromo && promoPrice.trim() ? Number(digits(promoPrice)) : null,
        seller_certified: true,
        status: 'disponible',
        moderation_status: moderationStatus,
        moderation_score: analysis.score,
        moderation_flags: analysis.flags,
        is_heavy: category === 'Véhicules et pièces' || isHeavyManual,
      })
      .select()
      .single();
    setSaving(false);

    if (error) {
      console.error('Erreur insertion annonce:', error);
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }

    // Traçabilité : chaque décision automatique est journalisée, avec le
    // détail des signaux détectés.
    await supabase.from('moderation_logs').insert({
      listing_id: newListing.id,
      actor_type: 'system',
      action:
        moderationStatus === 'blocked'
          ? 'auto_block'
          : moderationStatus === 'pending_review'
          ? 'auto_flag'
          : 'auto_approve',
      details: { score: analysis.score, flags: analysis.flags },
    });

    // Si un risque a été détecté (bloqué ou à vérifier), l'annonce rejoint
    // la file de vérification humaine.
    if (moderationStatus !== 'approved') {
      await supabase.from('moderation_queue').insert({
        listing_id: newListing.id,
        source: 'auto_detection',
        category: analysis.matchedIllegalCategories[0] || null,
        score: analysis.score,
        detected_keywords: analysis.flags.map((f) => f.matched),
      });
    }

    if (moderationStatus === 'blocked') {
      Alert.alert(
        'Annonce bloquée',
        "Cette annonce n'a pas pu être publiée car son contenu semble enfreindre les règles de Zuno" +
          (analysis.matchedIllegalCategories.length
            ? ` (catégorie détectée : ${analysis.matchedIllegalCategories.join(', ')})`
            : '') +
          ". Si tu penses qu'il s'agit d'une erreur, contacte le support."
      );
    } else if (moderationStatus === 'pending_review') {
      Alert.alert(
        'Annonce en cours de vérification',
        "Ton annonce a bien été reçue. Certains éléments demandent une vérification manuelle avant qu'elle soit visible publiquement — ça ne prend généralement pas longtemps."
      );
    } else {
      Alert.alert('Publiée', 'Ton annonce est en ligne.');
    }

    setTitle('');
    setDescription('');
    setPrice('');
    setCity('');
    setPhotos([]);
    setDelaiLivraison(delais[0]);
    setShowPromo(false);
    setPromoPrice('');
    setCertified(false);
    setTried(false);
  };

  const canPublish = photos.length >= MIN_PHOTOS && certified;
  const steps = [
    { ok: photos.length >= MIN_PHOTOS, label: `${Math.min(photos.length, MIN_PHOTOS)}/${MIN_PHOTOS} photos` },
    { ok: title.trim().length >= 3 && !errors.title, label: 'Titre' },
    { ok: !!digits(price) && !errors.price, label: 'Prix' },
    { ok: city.trim().length >= 2, label: 'Ville' },
    { ok: certified, label: 'Certification' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GradientHeader style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <Text style={styles.headerTitle}>Nouvelle annonce</Text>
        <View style={{ width: 22 }} />
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Étapes */}
        <View style={styles.stepsRow}>
          {steps.map((s) => (
            <View key={s.label} style={[styles.stepChip, s.ok && styles.stepChipOk]}>
              <Ionicons
                name={s.ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={13}
                color={s.ok ? colors.success : colors.textMuted}
              />
              <Text style={[styles.stepText, s.ok && styles.stepTextOk]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Card
          icon="images-outline"
          title="Photos"
          subtitle={`Au moins ${MIN_PHOTOS}, jusqu'à ${MAX_PHOTOS}. La première est la photo principale.`}
        >
          <View style={styles.photoGrid}>
            {photos.map((uri, i) => (
              <TouchableOpacity key={uri} style={styles.photoTile} onPress={() => makeMain(uri)} activeOpacity={0.9}>
                <Image source={{ uri }} style={styles.photoImage} />
                {i === 0 ? (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>Principale</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.removeBadge} onPress={() => removePhoto(uri)} hitSlop={6}>
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity style={styles.addTile} onPress={handlePickImages}>
                <Ionicons name="camera-outline" size={22} color={colors.purple} />
                <Text style={styles.addTileText}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>
          {missingPhotos > 0 ? (
            <Text style={[styles.hint, tried && { color: colors.danger }]}>
              Encore {missingPhotos} photo{missingPhotos > 1 ? 's' : ''} pour pouvoir publier — plusieurs angles
              rassurent les acheteurs.
            </Text>
          ) : (
            <Text style={[styles.hint, { color: colors.success }]}>Photos OK. Touche une photo pour la mettre en principale.</Text>
          )}
        </Card>

        <Card icon="create-outline" title="L'article">
          <Text style={styles.label}>Titre <Text style={styles.star}>*</Text></Text>
          <TextInput
            placeholder="Ex : iPhone 12 128 Go noir"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX}
            style={[styles.input, show('title') && styles.inputError]}
          />
          <View style={styles.counterRow}>
            <Err text={show('title')} />
            <Text style={styles.counter}>{title.length}/{TITLE_MAX}</Text>
          </View>

          <Text style={styles.label}>Présentation</Text>
          <TextInput
            placeholder="État détaillé, raison de la vente, ce qui est inclus…"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            maxLength={DESC_MAX}
            style={[styles.textarea, show('description') && styles.inputError]}
            multiline
            numberOfLines={4}
          />
          <View style={styles.counterRow}>
            <Err text={show('description')} />
            <Text style={styles.counter}>{description.length}/{DESC_MAX}</Text>
          </View>
        </Card>

        <Card icon="cash-outline" title="Prix">
          <Text style={styles.label}>Prix en FCFA <Text style={styles.star}>*</Text></Text>
          <View style={[styles.priceBox, show('price') && styles.inputError]}>
            <TextInput
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={money(price)}
              onChangeText={(t) => setPrice(digits(t))}
              keyboardType="numeric"
              style={styles.priceInput}
            />
            <Text style={styles.priceUnit}>FCFA</Text>
          </View>
          <Err text={show('price')} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Ajouter un prix promo</Text>
              <Text style={styles.hint}>Facultatif : attire plus d'acheteurs.</Text>
            </View>
            <Switch
              value={showPromo}
              onValueChange={setShowPromo}
              trackColor={{ false: colors.border, true: colors.orange }}
              thumbColor={colors.white}
            />
          </View>
          {showPromo ? (
            <>
              <View style={[styles.priceBox, errors.promo && styles.inputError]}>
                <TextInput
                  placeholder="Prix promo"
                  placeholderTextColor={colors.textMuted}
                  value={money(promoPrice)}
                  onChangeText={(t) => setPromoPrice(digits(t))}
                  keyboardType="numeric"
                  style={styles.priceInput}
                />
                <Text style={styles.priceUnit}>FCFA</Text>
              </View>
              <Err text={errors.promo} />
            </>
          ) : null}
        </Card>

        <Card icon="pricetags-outline" title="Détails">
          <Text style={styles.label}>Catégorie</Text>
          <Chips options={categories} value={category} onChange={setCategory} />

          <Text style={styles.label}>État</Text>
          <Chips options={conditions} value={condition} onChange={setCondition} />

          <Text style={styles.label}>Ville, quartier <Text style={styles.star}>*</Text></Text>
          <TextInput
            placeholder="Ex : Plateau, Niamey"
            placeholderTextColor={colors.textMuted}
            value={city}
            onChangeText={setCity}
            style={[styles.input, show('city') && styles.inputError]}
          />
          <Err text={show('city')} />
        </Card>

        <Card icon="car-outline" title="Livraison">
          {category === 'Véhicules et pièces' ? (
            <View style={styles.heavyNotice}>
              <Ionicons name="information-circle-outline" size={16} color={colors.purple} />
              <Text style={styles.heavyNoticeText}>
                La livraison de cet article sera à négocier directement avec l'acheteur après l'achat
                (au lieu des options de livraison habituelles).
              </Text>
            </View>
          ) : (
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Article lourd ou encombrant (+50 kg)</Text>
                <Text style={styles.hint}>Livraison à négocier avec l'acheteur.</Text>
              </View>
              <Switch
                value={isHeavyManual}
                onValueChange={setIsHeavyManual}
                trackColor={{ false: colors.border, true: colors.orange }}
                thumbColor={colors.white}
              />
            </View>
          )}
          <Text style={styles.label}>Délai de livraison estimé</Text>
          <Chips options={delais} value={delaiLivraison} onChange={setDelaiLivraison} />
        </Card>

        <TouchableOpacity
          style={[styles.certifyRow, tried && !certified && styles.certifyError]}
          onPress={() => setCertified((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons
            name={certified ? 'checkbox' : 'square-outline'}
            size={22}
            color={certified ? colors.orange : colors.textMuted}
          />
          <Text style={styles.certifyText}>
            Je certifie être seul responsable de l'état et de la provenance de cet article, et
            confirme qu'il ne s'agit pas d'un article interdit sur Zuno.
          </Text>
        </TouchableOpacity>
        <View style={{ height: 90 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.publishButton, !canPublish && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.publishButtonText}>{uploadProgress || 'Publication…'}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="rocket-outline" size={18} color={colors.white} />
              <Text style={styles.publishButtonText}>Publier l'annonce</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  body: { padding: spacing.lg },

  stepsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepChipOk: { backgroundColor: colors.successBg, borderColor: colors.successBg },
  stepText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  stepTextOk: { color: colors.success },

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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.tintPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoTile: { width: '23%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: '100%' },
  mainBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  mainBadgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.purple,
    backgroundColor: colors.tintPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileText: { color: colors.purple, fontSize: 10, fontWeight: '700', marginTop: 2 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },

  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.sm, marginBottom: 6 },
  star: { color: colors.danger, fontWeight: '800' },
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
  textarea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    fontSize: 14,
  },
  inputError: { borderColor: colors.danger },
  counterRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4 },
  counter: { fontSize: 11, color: colors.textMuted, marginLeft: 'auto' },
  errRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, flex: 1, marginTop: 4 },
  errText: { flex: 1, fontSize: 12, color: colors.danger },

  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: 2,
  },
  priceInput: { flex: 1, height: 52, fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  priceUnit: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm },
  switchTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  pillText: { fontSize: 12.5, color: colors.textPrimary },
  pillTextActive: { color: colors.white, fontWeight: '700' },

  heavyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.tintPurple,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  heavyNoticeText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  certifyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  certifyError: { borderColor: colors.danger },
  certifyText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  publishButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishButtonDisabled: { opacity: 0.55 },
  publishButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
