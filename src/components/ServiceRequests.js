import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, Modal, ScrollView, Alert, Linking,
  ActivityIndicator, RefreshControl, StyleSheet, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId, ensureAccountComplete } from '../lib/deviceUser';
import GradientHeader from './GradientHeader';

// La localisation GPS est facultative : si le module n'existe pas dans l'appli, le bouton est simplement masqué.
let Location = null;
try { Location = require('expo-location'); } catch (e) { Location = null; }

const COUNTRIES = [
  { code: 'NE', label: '🇳🇪 Niger' },
  { code: 'ML', label: '🇲🇱 Mali' },
  { code: 'BF', label: '🇧🇫 Burkina Faso' },
  { code: 'BJ', label: '🇧🇯 Bénin' },
  { code: 'CI', label: "🇨🇮 Côte d'Ivoire" },
  { code: 'TG', label: '🇹🇬 Togo' },
];
const URGENCY = [
  { code: 'Dès que possible', icon: 'flash-outline' },
  { code: "Aujourd'hui", icon: 'sunny-outline' },
  { code: 'Demain', icon: 'calendar-outline' },
];
const HISTORY_KEY = 'zuno_saved_addresses';

const mapsUrl = (label, lat, lng) =>
  lat && lng
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label || '')}`;

async function loadHistory() {
  try { return JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) || '[]'); } catch (e) { return []; }
}
async function saveToHistory(entries) {
  try {
    const old = await loadHistory();
    const merged = [...entries.filter((e) => e && e.label && e.label.trim()), ...old];
    const seen = new Set();
    const out = merged.filter((e) => { const k = e.label.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(out));
  } catch (e) { /* sans importance */ }
}

/* ---------------------------------------------------------------- tuiles accueil */
export default function ServiceRequests({ navigation, defaultCountry }) {
  const [open, setOpen] = useState(null); // 'seek' | 'courier'
  const [done, setDone] = useState(null); // 'seek' | 'courier'
  const [tracking, setTracking] = useState(false);

  const start = async (kind, label) => {
    const ok = await ensureAccountComplete(navigation, label);
    if (ok) setOpen(kind);
  };
  const finished = (kind) => { setOpen(null); setTimeout(() => setDone(kind), 250); };

  return (
    <View>
    <View style={styles.row}>
      <TouchableOpacity style={[styles.tile, { backgroundColor: colors.tintPurple }]} activeOpacity={0.85} onPress={() => start('seek', 'envoyer une demande')}>
        <View style={[styles.tileIcon, { backgroundColor: colors.purple }]}><Ionicons name="search" size={20} color="#fff" /></View>
        <Text style={styles.tileTitle}>Je cherche cet article</Text>
        <Text style={styles.tileSub}>On le trouve pour toi</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tile, { backgroundColor: colors.tintOrange }]} activeOpacity={0.85} onPress={() => start('courier', 'commander un coursier')}>
        <View style={[styles.tileIcon, { backgroundColor: colors.orange }]}><Ionicons name="bicycle" size={20} color="#fff" /></View>
        <Text style={styles.tileTitle}>Commander un coursier</Text>
        <Text style={styles.tileSub}>Livraison d'un colis</Text>
      </TouchableOpacity>

      <Modal visible={open === 'seek'} animationType="slide" onRequestClose={() => setOpen(null)} statusBarTranslucent>
        <SafeAreaProvider><SeekForm defaultCountry={defaultCountry} onClose={() => setOpen(null)} onDone={() => finished('seek')} /></SafeAreaProvider>
      </Modal>
      <Modal visible={open === 'courier'} animationType="slide" onRequestClose={() => setOpen(null)} statusBarTranslucent>
        <SafeAreaProvider><CourierForm defaultCountry={defaultCountry} onClose={() => setOpen(null)} onDone={() => finished('courier')} /></SafeAreaProvider>
      </Modal>

      <SuccessModal
        kind={done}
        onClose={() => setDone(null)}
        onTrack={() => { setDone(null); setTimeout(() => setTracking(true), 250); }}
        onOther={() => { const k = done === 'seek' ? 'courier' : 'seek'; setDone(null); setTimeout(() => setOpen(k), 250); }}
      />

      <Modal visible={tracking} animationType="slide" onRequestClose={() => setTracking(false)} statusBarTranslucent>
        <SafeAreaProvider><MyRequests onClose={() => setTracking(false)} /></SafeAreaProvider>
      </Modal>
    </View>
    <TouchableOpacity style={styles.trackLink} onPress={() => setTracking(true)} activeOpacity={0.7}>
      <Ionicons name="navigate-circle-outline" size={18} color={colors.purple} />
      <Text style={styles.trackLinkText}>Suivre mes demandes</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.purple} />
    </TouchableOpacity>
    </View>
  );
}

/* ---------------------------------------------------------------- succès */
function SuccessModal({ kind, onClose, onOther, onTrack }) {
  const seek = kind === 'seek';
  return (
    <Modal visible={!!kind} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.successCard}>
          <View style={styles.successBadge}><Ionicons name="checkmark" size={38} color="#fff" /></View>
          <Text style={styles.successTitle}>Demande envoyée !</Text>
          <Text style={styles.successText}>
            {seek
              ? "L'équipe Zuno cherche ton article et te contacte dès qu'elle l'a trouvé."
              : "L'équipe Zuno t'appelle pour confirmer le prix, puis envoie un coursier."}
          </Text>
          <View style={styles.steps}>
            {(seek
              ? ['Demande reçue', 'Recherche en cours', 'On te contacte']
              : ['Demande reçue', 'Prix confirmé par appel', 'Coursier en route']).map((t, i) => (
              <View key={t} style={styles.stepRow}>
                <View style={[styles.stepDot, i === 0 && { backgroundColor: colors.success }]}>
                  {i === 0 ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={styles.stepNum}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepText, i === 0 && { color: colors.textPrimary, fontWeight: '600' }]}>{t}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={onTrack} activeOpacity={0.85}>
            <Ionicons name="navigate-circle-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Suivre ma demande</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.85}>
            <Ionicons name="home-outline" size={18} color={colors.purple} />
            <Text style={styles.secondaryBtnText}>Découvrir les articles</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOther} activeOpacity={0.7} style={{ marginTop: 14 }}>
            <Text style={styles.linkText}>{seek ? 'Commander un coursier' : 'Je cherche un article'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------------------------------------------------------- suivi */
const COURIER_STEPS = [
  ['nouvelle', 'Demande reçue'],
  ['acceptee', 'Coursier confirmé'],
  ['en_cours', 'En route'],
  ['livree', 'Livré'],
];
const SEEK_STEPS = [
  ['nouvelle', 'Demande reçue'],
  ['en_cours', 'Recherche en cours'],
  ['trouvee', 'Article trouvé'],
];
const SUPPORT_WA = '34627137449';

function Timeline({ steps, status }) {
  const canceled = status === 'annulee';
  const idx = steps.findIndex((x) => x[0] === status);
  return (
    <View style={{ marginTop: 6 }}>
      {steps.map(([code, label], i) => {
        const done = !canceled && idx >= i;
        const current = !canceled && idx === i;
        const last = i === steps.length - 1;
        return (
          <View key={code} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlDot, done && { backgroundColor: current && !last ? colors.orange : colors.success }]}>
                {done ? <Ionicons name={current && !last ? 'ellipse' : 'checkmark'} size={current && !last ? 8 : 13} color="#fff" /> : null}
              </View>
              {!last ? <View style={[styles.tlLine, !canceled && idx > i && { backgroundColor: colors.success }]} /> : null}
            </View>
            <Text style={[styles.tlText, done && { color: colors.textPrimary, fontWeight: current ? '700' : '500' }]}>{label}</Text>
          </View>
        );
      })}
      {canceled ? (
        <View style={styles.cancelBox}><Ionicons name="close-circle" size={16} color={colors.danger} /><Text style={styles.cancelText}>Demande annulée</Text></View>
      ) : null}
    </View>
  );
}

function MyRequests({ onClose }) {
  const [rows, setRows] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0);

  const load = useCallback(async () => {
    try {
      const uid = await getDeviceUserId();
      const [a, c] = await Promise.all([
        supabase.from('article_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
        supabase.from('courier_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
      ]);
      const all = [
        ...(a.data || []).map((r) => ({ ...r, kind: 'seek' })),
        ...(c.data || []).map((r) => ({ ...r, kind: 'courier' })),
      ].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
      setRows(all);
    } catch (e) { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader style={{ paddingTop: top + 10, paddingBottom: 18 }}>
        <View style={styles.hRow}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.hBack}><Ionicons name="arrow-back" size={20} color="#fff" /></TouchableOpacity>
          <Text style={styles.hTitle}>Mes demandes</Text>
          <View style={{ width: 36 }} />
        </View>
      </GradientHeader>
      {rows === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.purple} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={42} color={colors.textMuted} />
              <Text style={styles.emptyText}>Tu n'as pas encore fait de demande.</Text>
            </View>
          ) : rows.map((r) => {
            const seek = r.kind === 'seek';
            const steps = seek ? SEEK_STEPS : COURIER_STEPS;
            return (
              <View key={r.kind + r.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.cardIcon, { backgroundColor: seek ? colors.tintPurple : colors.tintOrange }]}>
                    <Ionicons name={seek ? 'search' : 'bicycle'} size={18} color={seek ? colors.purple : colors.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{seek ? r.title : `${r.pickup_address} → ${r.dropoff_address}`}</Text>
                    <Text style={styles.cardSub}>{seek ? 'Je cherche cet article' : 'Coursier'} · {new Date(r.created_at).toLocaleDateString('fr-FR')}</Text>
                  </View>
                </View>
                {!seek && r.price_quote ? (
                  <View style={styles.priceBox}><Text style={styles.priceLabel}>Prix de la course</Text><Text style={styles.priceValue}>{r.price_quote}</Text></View>
                ) : null}
                <Timeline steps={steps} status={r.status} />
                {r.admin_note ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteTitle}>Message de Zuno</Text>
                    <Text style={styles.noteText}>{r.admin_note}</Text>
                  </View>
                ) : null}
                {seek && r.status === 'trouvee' ? (
                  <TouchableOpacity style={styles.waBtn} activeOpacity={0.85}
                    onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent('Bonjour Zuno, au sujet de ma demande : ' + r.title)}`)}>
                    <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                    <Text style={styles.waBtnText}>Consulter mon WhatsApp</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* ---------------------------------------------------------------- briques */
function Section({ icon, tint, color, title, sub, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { backgroundColor: tint || colors.tintPurple }]}>
          <Ionicons name={icon} size={18} color={color || colors.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Input({ icon, error, style, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <View>
      <View style={[styles.inputWrap, focus && { borderColor: colors.purple }, error && { borderColor: colors.danger }]}>
        {icon ? <Ionicons name={icon} size={18} color={focus ? colors.purple : colors.textMuted} style={{ marginRight: 8 }} /> : null}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          {...props}
        />
      </View>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

function Label({ children, required }) {
  return <Text style={styles.label}>{children}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}</Text>;
}

function Chips({ options, value, onChange }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const val = o.code || o;
        const on = value === val;
        return (
          <TouchableOpacity key={val} onPress={() => onChange(val)} style={[styles.chip, on && styles.chipOn]} activeOpacity={0.8}>
            {o.icon ? <Ionicons name={o.icon} size={14} color={on ? '#fff' : colors.textSecondary} style={{ marginRight: 5 }} /> : null}
            <Text style={[styles.chipText, on && { color: '#fff', fontWeight: '600' }]}>{o.label || o.code || o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Adresse + position GPS + adresses déjà utilisées.
function AddressField({ value, onChangeText, coords, onCoords, placeholder, error, dotColor }) {
  const [history, setHistory] = useState([]);
  const [showHist, setShowHist] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => { loadHistory().then(setHistory); }, []);

  const locate = async () => {
    try {
      setLocating(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Localisation refusée', "Autorise la localisation pour Zuno dans les réglages de ton téléphone, ou écris l'adresse à la main.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      let label = '';
      try {
        const [a] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (a) label = [a.name || a.street, a.district || a.subregion, a.city].filter(Boolean).join(', ');
      } catch (e) { /* adresse texte facultative */ }
      onCoords({ lat: latitude, lng: longitude });
      onChangeText(label || value || 'Ma position actuelle');
    } catch (e) {
      Alert.alert('Position introuvable', "Impossible de te localiser. Écris l'adresse à la main.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <Input
        icon="location-outline"
        value={value}
        onChangeText={(t) => { onChangeText(t); if (coords) onCoords(null); }}
        placeholder={placeholder}
        maxLength={150}
        error={error}
      />
      <View style={styles.addrActions}>
        {Location ? (
          <TouchableOpacity style={styles.addrBtn} onPress={locate} disabled={locating} activeOpacity={0.8}>
            {locating ? <ActivityIndicator size="small" color={colors.purple} /> : <Ionicons name="navigate" size={14} color={colors.purple} />}
            <Text style={styles.addrBtnText}>Ma position</Text>
          </TouchableOpacity>
        ) : null}
        {history.length ? (
          <TouchableOpacity style={styles.addrBtn} onPress={() => setShowHist((v) => !v)} activeOpacity={0.8}>
            <Ionicons name="time-outline" size={14} color={colors.purple} />
            <Text style={styles.addrBtnText}>Adresses récentes</Text>
          </TouchableOpacity>
        ) : null}
        {value.trim().length >= 3 || coords ? (
          <TouchableOpacity style={styles.addrBtn} onPress={() => Linking.openURL(mapsUrl(value, coords?.lat, coords?.lng))} activeOpacity={0.8}>
            <Ionicons name="map-outline" size={14} color={colors.purple} />
            <Text style={styles.addrBtnText}>Voir sur la carte</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {coords ? (
        <View style={styles.gpsOk}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.gpsOkText}>Position GPS enregistrée</Text>
        </View>
      ) : null}
      {showHist ? (
        <View style={styles.histBox}>
          {history.map((h) => (
            <TouchableOpacity key={h.label} style={styles.histRow} onPress={() => { onChangeText(h.label); onCoords(h.lat && h.lng ? { lat: h.lat, lng: h.lng } : null); setShowHist(false); }}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} />
              <Text style={styles.histText} numberOfLines={1}>{h.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Shell({ title, subtitle, icon, accent, onClose, children, footer }) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0);
  const bottom = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 0);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader style={{ paddingTop: top + 10, paddingBottom: 22 }}>
        <View style={styles.hRow}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.hBack}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.hTitle}>{title}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: accent }]}><Ionicons name={icon} size={22} color="#fff" /></View>
          <Text style={styles.heroText}>{subtitle}</Text>
        </View>
      </GradientHeader>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: bottom }]}>{footer}</View>
      </KeyboardAvoidingView>
    </View>
  );
}

function SendButton({ busy, onPress, label }) {
  return (
    <TouchableOpacity style={styles.cta} onPress={onPress} disabled={busy} activeOpacity={0.85}>
      {busy ? <ActivityIndicator color="#fff" /> : (<><Ionicons name="paper-plane" size={18} color="#fff" /><Text style={styles.ctaText}>{label}</Text></>)}
    </TouchableOpacity>
  );
}

/* ---------------------------------------------------------------- Je cherche cet article */
function SeekForm({ onClose, onDone, defaultCountry }) {
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
      onDone();
    } catch (e) {
      Alert.alert('Oups', "Impossible d'envoyer la demande. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const e = (ok, msg) => (tried && !ok ? msg : undefined);

  return (
    <Shell
      title="Je cherche cet article"
      subtitle="Décris ce que tu veux, l'équipe Zuno le cherche pour toi."
      icon="search" accent={colors.purple} onClose={onClose}
      footer={<SendButton busy={busy} onPress={send} label="Envoyer ma demande" />}
    >
      <Section icon="image-outline" title="Photo de l'article" sub="Facultatif, mais ça aide beaucoup">
        <TouchableOpacity style={styles.photoBox} onPress={pick} activeOpacity={0.8}>
          {photo ? (
            <>
              <Image source={{ uri: photo }} style={styles.photo} />
              <View style={styles.photoEdit}><Ionicons name="camera" size={14} color="#fff" /><Text style={styles.photoEditText}>Changer</Text></View>
            </>
          ) : (
            <>
              <View style={styles.photoCircle}><Ionicons name="camera" size={26} color={colors.purple} /></View>
              <Text style={styles.photoText}>Ajouter une photo</Text>
              <Text style={styles.photoHint}>Depuis ta galerie</Text>
            </>
          )}
        </TouchableOpacity>
      </Section>

      <Section icon="pricetag-outline" title="L'article recherché">
        <Label required>Nom de l'article</Label>
        <Input icon="search-outline" value={title} onChangeText={setTitle} maxLength={120} placeholder="Ex : iPhone 12, 128 Go" error={e(title.trim().length >= 3, "Indique le nom de l'article.")} />
        <Label>Détails (marque, couleur, taille…)</Label>
        <Input value={description} onChangeText={setDescription} maxLength={600} multiline placeholder="Plus tu précises, plus on trouve vite." style={{ height: 84, textAlignVertical: 'top' }} />
        <Label>Budget</Label>
        <Input icon="cash-outline" value={budget} onChangeText={setBudget} maxLength={40} placeholder="Ex : 80 000 FCFA" />
      </Section>

      <Section icon="location-outline" tint={colors.tintOrange} color={colors.orange} title="Où es-tu ?">
        <Label required>Pays</Label>
        <Chips options={COUNTRIES} value={country} onChange={setCountry} />
        {tried && !country ? <Text style={styles.err}>Choisis ton pays.</Text> : null}
        <Label required>Ville, quartier</Label>
        <Input icon="business-outline" value={city} onChangeText={setCity} maxLength={80} placeholder="Ex : Plateau, Niamey" error={e(city.trim(), 'Indique ta ville.')} />
      </Section>

      <Section icon="call-outline" tint={colors.successBg} color={colors.success} title="Pour te joindre">
        <Label required>Ton numéro</Label>
        <Input icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder="Ex : 96 00 00 00" error={e(phone.trim().length >= 8, 'Numéro invalide.')} />
      </Section>
    </Shell>
  );
}

/* ---------------------------------------------------------------- Commander un coursier */
function CourierForm({ onClose, onDone, defaultCountry }) {
  const [country, setCountry] = useState(defaultCountry || null);
  const [pickup, setPickup] = useState('');
  const [pickupGps, setPickupGps] = useState(null);
  const [dropoff, setDropoff] = useState('');
  const [dropGps, setDropGps] = useState(null);
  const [pkg, setPkg] = useState('');
  const [urgency, setUrgency] = useState(URGENCY[0].code);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rName, setRName] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const valid = country && pickup.trim().length >= 3 && dropoff.trim().length >= 3 && pkg.trim().length >= 3
    && name.trim() && phone.trim().length >= 8 && rName.trim() && rPhone.trim().length >= 8;

  const send = async () => {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    try {
      const uid = await getDeviceUserId();
      const { error } = await supabase.from('courier_requests').insert({
        user_id: uid, country, pickup_address: pickup.trim(), dropoff_address: dropoff.trim(),
        pickup_lat: pickupGps?.lat ?? null, pickup_lng: pickupGps?.lng ?? null,
        dropoff_lat: dropGps?.lat ?? null, dropoff_lng: dropGps?.lng ?? null,
        package_description: pkg.trim(), contact_name: name.trim(), contact_phone: phone.trim(),
        recipient_name: rName.trim(), recipient_phone: rPhone.trim(), urgency,
      });
      if (error) throw error;
      await saveToHistory([
        { label: pickup.trim(), lat: pickupGps?.lat, lng: pickupGps?.lng },
        { label: dropoff.trim(), lat: dropGps?.lat, lng: dropGps?.lng },
      ]);
      onDone();
    } catch (e) {
      Alert.alert('Oups', "Impossible d'envoyer la demande. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const e = (ok, msg) => (tried && !ok ? msg : undefined);

  return (
    <Shell
      title="Commander un coursier"
      subtitle="Un colis à livrer de A vers B ? Zuno te confirme le prix avant l'envoi."
      icon="bicycle" accent={colors.orange} onClose={onClose}
      footer={<SendButton busy={busy} onPress={send} label="Commander le coursier" />}
    >
      <Section icon="navigate-outline" tint={colors.tintOrange} color={colors.orange} title="Le trajet" sub="Tes adresses sont gardées pour la prochaine fois">
        <Label required>Pays</Label>
        <Chips options={COUNTRIES} value={country} onChange={setCountry} />
        {tried && !country ? <Text style={styles.err}>Choisis le pays.</Text> : null}

        <View style={styles.route}>
          <View style={styles.routeRail}>
            <View style={[styles.routeDot, { backgroundColor: colors.success }]}><Text style={styles.routeLetter}>A</Text></View>
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, { backgroundColor: colors.orange }]}><Text style={styles.routeLetter}>B</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <Label required>Récupération du colis</Label>
            <AddressField value={pickup} onChangeText={setPickup} coords={pickupGps} onCoords={setPickupGps} placeholder="Quartier, rue, repère…" error={e(pickup.trim().length >= 3, 'Indique où récupérer le colis.')} />
            <Label required>Livraison du colis</Label>
            <AddressField value={dropoff} onChangeText={setDropoff} coords={dropGps} onCoords={setDropGps} placeholder="Quartier, rue, repère…" error={e(dropoff.trim().length >= 3, 'Indique où livrer le colis.')} />
          </View>
        </View>
      </Section>

      <Section icon="cube-outline" title="Le colis">
        <Label required>Que faut-il transporter ?</Label>
        <Input icon="cube-outline" value={pkg} onChangeText={setPkg} maxLength={150} placeholder="Ex : un sac, un carton, des documents" error={e(pkg.trim().length >= 3, 'Décris le colis.')} />
        <Label>Quand ?</Label>
        <Chips options={URGENCY} value={urgency} onChange={setUrgency} />
      </Section>

      <Section icon="person-outline" title="Information sur l'expéditeur" sub="La personne qui envoie le colis">
        <Label required>Nom complet</Label>
        <Input icon="person-outline" value={name} onChangeText={setName} maxLength={80} placeholder="Ton nom" error={e(name.trim(), 'Indique ton nom.')} />
        <Label required>Téléphone</Label>
        <Input icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder="Ex : 96 00 00 00" error={e(phone.trim().length >= 8, 'Numéro invalide.')} />
      </Section>

      <Section icon="person-add-outline" tint={colors.tintOrange} color={colors.orange} title="Information sur le destinataire" sub="La personne qui reçoit le colis">
        <Label required>Nom complet</Label>
        <Input icon="person-outline" value={rName} onChangeText={setRName} maxLength={80} placeholder="Qui reçoit le colis ?" error={e(rName.trim(), 'Indique le nom du destinataire.')} />
        <Label required>Téléphone</Label>
        <Input icon="call-outline" value={rPhone} onChangeText={setRPhone} keyboardType="phone-pad" maxLength={20} placeholder="Ex : 96 00 00 00" error={e(rPhone.trim().length >= 8, 'Numéro invalide.')} />
      </Section>
    </Shell>
  );
}

/* ---------------------------------------------------------------- styles */
const styles = StyleSheet.create({
  trackLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  trackLinkText: { color: colors.purple, fontWeight: '600', fontSize: 13 },
  linkText: { color: colors.purple, fontWeight: '600', fontSize: 14 },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 34 },
  tlRail: { width: 24, alignItems: 'center', marginRight: 10 },
  tlDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tlLine: { width: 2, flex: 1, minHeight: 14, backgroundColor: colors.border, marginVertical: 2 },
  tlText: { fontSize: 14, color: colors.textMuted, paddingTop: 1 },
  cancelBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  cancelText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  priceBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.tintOrange, borderRadius: radius.md, padding: 12, marginTop: 10 },
  priceLabel: { color: colors.textSecondary, fontSize: 13 },
  priceValue: { color: colors.orange, fontWeight: '800', fontSize: 16 },
  noteBox: { backgroundColor: colors.tintPurple, borderRadius: radius.md, padding: 12, marginTop: 12 },
  noteTitle: { color: colors.purple, fontWeight: '700', fontSize: 12, marginBottom: 3 },
  noteText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  waBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#25D366', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  waBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textMuted, marginTop: 10 },
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  tileSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  hRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hero: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.lg, padding: 12 },
  heroIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  heroText: { flex: 1, color: '#fff', fontSize: 13.5, lineHeight: 19 },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.textPrimary },
  err: { color: colors.danger, fontSize: 12, marginTop: 4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.purple, borderColor: colors.purple },
  chipText: { fontSize: 13, color: colors.textPrimary },

  photoBox: { height: 150, marginTop: 10, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.purple, backgroundColor: colors.tintPurple, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  photoText: { color: colors.purple, fontWeight: '700', marginTop: 8 },
  photoHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  photoEdit: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  photoEditText: { color: '#fff', fontSize: 12, marginLeft: 4 },

  route: { flexDirection: 'row', marginTop: 4 },
  routeRail: { width: 28, alignItems: 'center', marginRight: 10, paddingTop: 36, paddingBottom: 26 },
  routeDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routeLetter: { color: '#fff', fontSize: 12, fontWeight: '800' },
  routeLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },

  addrActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  addrBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.tintPurple, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  addrBtnText: { color: colors.purple, fontSize: 12, fontWeight: '600' },
  gpsOk: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  gpsOkText: { color: colors.success, fontSize: 12 },
  histBox: { marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  histText: { flex: 1, color: colors.textPrimary, fontSize: 14 },

  footer: { paddingHorizontal: spacing.md, paddingTop: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  cta: { flexDirection: 'row', gap: 8, backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(20,10,50,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard: { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center' },
  successBadge: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginTop: -62, borderWidth: 6, borderColor: '#fff' },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 14 },
  successText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  steps: { alignSelf: 'stretch', backgroundColor: colors.background, borderRadius: radius.md, padding: 14, marginTop: 16, gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  stepText: { fontSize: 13.5, color: colors.textMuted },
  primaryBtn: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, backgroundColor: colors.purple, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, backgroundColor: colors.tintPurple, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryBtnText: { color: colors.purple, fontWeight: '700', fontSize: 15 },
});
