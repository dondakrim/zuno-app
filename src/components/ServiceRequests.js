import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, Modal, ScrollView, Alert,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId, ensureAccountComplete } from '../lib/deviceUser';
import GradientHeader from './GradientHeader';

const COUNTRIES = [
  { code: 'NE', label: '🇳🇪 Niger' },
  { code: 'ML', label: '🇲🇱 Mali' },
  { code: 'BF', label: '🇧🇫 Burkina Faso' },
  { code: 'BJ', label: '🇧🇯 Bénin' },
  { code: 'CI', label: "🇨🇮 Côte d'Ivoire" },
  { code: 'TG', label: '🇹🇬 Togo' },
];
const URGENCY = ['Dès que possible', "Aujourd'hui", 'Demain'];

// Deux tuiles affichées sur l'accueil + les deux formulaires (plein écran).
export default function ServiceRequests({ navigation, defaultCountry }) {
  const [open, setOpen] = useState(null); // 'seek' | 'courier' | null

  const start = async (kind, label) => {
    const ok = await ensureAccountComplete(navigation, label);
    if (ok) setOpen(kind);
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.tile, { backgroundColor: colors.tintPurple }]}
        activeOpacity={0.85}
        onPress={() => start('seek', 'envoyer une demande')}
      >
        <View style={[styles.tileIcon, { backgroundColor: colors.purple }]}>
          <Ionicons name="search" size={20} color="#fff" />
        </View>
        <Text style={styles.tileTitle}>Je cherche cet article</Text>
        <Text style={styles.tileSub}>On le trouve pour toi</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tile, { backgroundColor: colors.tintOrange }]}
        activeOpacity={0.85}
        onPress={() => start('courier', 'commander un coursier')}
      >
        <View style={[styles.tileIcon, { backgroundColor: colors.orange }]}>
          <Ionicons name="bicycle" size={20} color="#fff" />
        </View>
        <Text style={styles.tileTitle}>Commander un coursier</Text>
        <Text style={styles.tileSub}>Livraison d'un colis</Text>
      </TouchableOpacity>

      <Modal visible={open === 'seek'} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SeekForm defaultCountry={defaultCountry} onClose={() => setOpen(null)} />
      </Modal>
      <Modal visible={open === 'courier'} animationType="slide" onRequestClose={() => setOpen(null)}>
        <CourierForm defaultCountry={defaultCountry} onClose={() => setOpen(null)} />
      </Modal>
    </View>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const label = o.label || o;
        const val = o.code || o;
        const on = value === val;
        return (
          <TouchableOpacity key={val} onPress={() => onChange(val)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && { color: '#fff' }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Field({ label, required, children }) {
  return (
    <View>
      <Text style={styles.label}>{label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}</Text>
      {children}
    </View>
  );
}

function Shell({ title, onClose, children, footer }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 22 }} />
      </GradientHeader>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
    </View>
  );
}

function SeekForm({ onClose, defaultCountry }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [country, setCountry] = useState(defaultCountry || null);
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const pick = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) {
      Alert.alert('Autorisation nécessaire', "Active l'accès aux photos dans les réglages de ton téléphone.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled) setPhoto(r.assets[0].uri);
  };

  const valid = title.trim().length >= 3 && country && city.trim() && phone.trim().length >= 8;

  const send = async () => {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    try {
      const uid = await getDeviceUserId();
      let photo_url = null;
      if (photo) {
        const b64 = await FileSystem.readAsStringAsync(photo, { encoding: 'base64' });
        const name = `demandes/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('listings-images').upload(name, decode(b64), { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        photo_url = supabase.storage.from('listings-images').getPublicUrl(name).data.publicUrl;
      }
      const { error } = await supabase.from('article_requests').insert({
        user_id: uid, title: title.trim(), description: description.trim() || null, photo_url,
        country, city: city.trim(), contact_phone: phone.trim(), budget: budget.trim() || null,
      });
      if (error) throw error;
      Alert.alert('Demande envoyée ✅', "L'équipe Zuno cherche ton article et te contacte dès qu'elle l'a trouvé.");
      onClose();
    } catch (e) {
      Alert.alert('Oups', "Impossible d'envoyer la demande. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const err = (cond, msg) => (tried && !cond ? <Text style={styles.err}>{msg}</Text> : null);

  return (
    <Shell
      title="Je cherche cet article"
      onClose={onClose}
      footer={
        <TouchableOpacity style={styles.cta} onPress={send} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Envoyer ma demande</Text>}
        </TouchableOpacity>
      }
    >
      <Text style={styles.intro}>Tu ne trouves pas ce que tu veux ? Décris-le et ajoute une photo : l'équipe Zuno le cherche pour toi.</Text>
      <Field label="Photo de l'article">
        <TouchableOpacity style={styles.photoBox} onPress={pick} activeOpacity={0.8}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={28} color={colors.purple} />
              <Text style={styles.photoText}>Ajouter une photo</Text>
            </>
          )}
        </TouchableOpacity>
      </Field>
      <Field label="Quel article cherches-tu ?" required>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={120} placeholder="Ex : iPhone 12, 128 Go" placeholderTextColor={colors.textMuted} />
        {err(title.trim().length >= 3, 'Indique le nom de l\'article.')}
      </Field>
      <Field label="Détails (marque, couleur, taille…)">
        <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} multiline value={description} onChangeText={setDescription} maxLength={600} placeholder="Plus tu précises, plus on trouve vite." placeholderTextColor={colors.textMuted} />
      </Field>
      <Field label="Budget (facultatif)">
        <TextInput style={styles.input} value={budget} onChangeText={setBudget} maxLength={40} placeholder="Ex : 80 000 FCFA" placeholderTextColor={colors.textMuted} />
      </Field>
      <Field label="Pays" required>
        <Chips options={COUNTRIES} value={country} onChange={setCountry} />
        {err(country, 'Choisis ton pays.')}
      </Field>
      <Field label="Ville, quartier" required>
        <TextInput style={styles.input} value={city} onChangeText={setCity} maxLength={80} placeholder="Ex : Plateau, Niamey" placeholderTextColor={colors.textMuted} />
        {err(city.trim(), 'Indique ta ville.')}
      </Field>
      <Field label="Numéro pour te joindre" required>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder="Ex : 96 00 00 00" placeholderTextColor={colors.textMuted} />
        {err(phone.trim().length >= 8, 'Numéro invalide.')}
      </Field>
    </Shell>
  );
}

function CourierForm({ onClose, defaultCountry }) {
  const [country, setCountry] = useState(defaultCountry || null);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pkg, setPkg] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rName, setRName] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [urgency, setUrgency] = useState(URGENCY[0]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const valid = country && pickup.trim().length >= 3 && dropoff.trim().length >= 3 && pkg.trim().length >= 3 && phone.trim().length >= 8 && rPhone.trim().length >= 8;

  const send = async () => {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    try {
      const uid = await getDeviceUserId();
      const { error } = await supabase.from('courier_requests').insert({
        user_id: uid, country, pickup_address: pickup.trim(), dropoff_address: dropoff.trim(),
        package_description: pkg.trim(), contact_name: name.trim() || null, contact_phone: phone.trim(),
        recipient_name: rName.trim() || null, recipient_phone: rPhone.trim(), urgency,
      });
      if (error) throw error;
      Alert.alert('Demande envoyée ✅', "L'équipe Zuno t'appelle pour confirmer le prix et envoyer un coursier.");
      onClose();
    } catch (e) {
      Alert.alert('Oups', "Impossible d'envoyer la demande. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const err = (cond, msg) => (tried && !cond ? <Text style={styles.err}>{msg}</Text> : null);
  const inp = (v, set, ph, extra = {}) => (
    <TextInput style={styles.input} value={v} onChangeText={set} placeholder={ph} placeholderTextColor={colors.textMuted} maxLength={150} {...extra} />
  );

  return (
    <Shell
      title="Commander un coursier"
      onClose={onClose}
      footer={
        <TouchableOpacity style={styles.cta} onPress={send} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Envoyer ma demande</Text>}
        </TouchableOpacity>
      }
    >
      <Text style={styles.intro}>Un colis à faire livrer d'un point A à un point B ? Décris la course : Zuno te confirme le prix avant l'envoi du coursier.</Text>
      <Field label="Pays" required>
        <Chips options={COUNTRIES} value={country} onChange={setCountry} />
        {err(country, 'Choisis le pays.')}
      </Field>
      <Field label="Adresse de récupération (A)" required>
        {inp(pickup, setPickup, 'Quartier, rue, repère…')}
        {err(pickup.trim().length >= 3, "Indique où récupérer le colis.")}
      </Field>
      <Field label="Adresse de livraison (B)" required>
        {inp(dropoff, setDropoff, 'Quartier, rue, repère…')}
        {err(dropoff.trim().length >= 3, "Indique où livrer le colis.")}
      </Field>
      <Field label="Que faut-il transporter ?" required>
        {inp(pkg, setPkg, 'Ex : un sac, un carton, des documents')}
        {err(pkg.trim().length >= 3, 'Décris le colis.')}
      </Field>
      <Field label="Quand ?">
        <Chips options={URGENCY} value={urgency} onChange={setUrgency} />
      </Field>
      <Field label="Ton nom">{inp(name, setName, 'Ton nom')}</Field>
      <Field label="Ton numéro" required>
        {inp(phone, setPhone, 'Ex : 96 00 00 00', { keyboardType: 'phone-pad', maxLength: 20 })}
        {err(phone.trim().length >= 8, 'Numéro invalide.')}
      </Field>
      <Field label="Nom du destinataire">{inp(rName, setRName, 'Qui reçoit le colis ?')}</Field>
      <Field label="Numéro du destinataire" required>
        {inp(rPhone, setRPhone, 'Ex : 96 00 00 00', { keyboardType: 'phone-pad', maxLength: 20 })}
        {err(rPhone.trim().length >= 8, 'Numéro invalide.')}
      </Field>
    </Shell>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  tileSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  intro: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.md, marginBottom: 6 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.textPrimary },
  err: { color: colors.danger, fontSize: 12, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.purple, borderColor: colors.purple },
  chipText: { fontSize: 13, color: colors.textPrimary },
  photoBox: { height: 150, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.purple, backgroundColor: colors.tintPurple, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoText: { color: colors.purple, fontWeight: '600', marginTop: 4 },
  footer: { padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  cta: { backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
