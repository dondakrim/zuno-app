import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  Switch,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, theme } from '../theme/colors';
import GradientHeader from '../components/GradientHeader';
import { supabase } from '../lib/supabase';
import { getDeviceUserId, deleteAccountAndReset, resetIdentity } from '../lib/deviceUser';
import { usePrefs, LANGS, CURRENCIES } from '../lib/prefs';

const PRIVACY_URL = 'https://claude.ai/artifact/W693o2tq7NtU93GffZanyM';
const TERMS_URL = 'https://claude.ai/artifact/REfBbZLXoVGSHUzu1FD7DW';

// Outils de test (changer d'identité, modération) : visibles seulement pendant
// le développement. Mets `true` pour les afficher aussi dans l'APK de test.
const SHOW_TEST_TOOLS = __DEV__;

// Une ligne de réglage : icône dans une pastille, titre, valeur ou flèche.
function Row({ icon, label, value, onPress, danger, last, right }) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.orange} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {right ? (
        right
      ) : (
        <>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress && !danger ? (
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

function Group({ title, children }) {
  return (
    <View style={styles.groupWrap}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [dark, setDark] = useState(theme.mode === 'dark');
  const [picker, setPicker] = useState(null); // 'lang' | 'currency' | null
  const { t, lang, currency, setLang, setCurrency } = usePrefs();
  const langLabel = (LANGS.find((l) => l.code === lang) || LANGS[0]).label;
  const currencyLabel = (CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0]).short;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const myId = await getDeviceUserId();
          const { data } = await supabase
            .from('users')
            .select('nom, ville, photo_url, avatar_icon, avatar_color')
            .eq('id', myId)
            .maybeSingle();
          if (active && data) setProfile(data);
        } catch (e) {
          // l'écran reste utilisable sans le résumé du profil
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

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
            await resetIdentity();
            Alert.alert('Fait', 'Tu es maintenant un nouvel utilisateur de test.');
          },
        },
      ]
    );
  };

  const handleResetInterests = () => {
    Alert.alert(
      "Revoir mes centres d'intérêt",
      "Tu devras choisir à nouveau au moins 3 centres d'intérêt au prochain lancement de l'appli.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          onPress: async () => {
            await AsyncStorage.removeItem('zuno_onboarding_done');
            Alert.alert('Fait', "Ferme complètement l'appli et rouvre-la pour refaire ce choix.");
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      "Cette action efface immédiatement ton nom, ta photo, ta pièce d'identité et tes centres d'intérêt. Tes annonces et commandes passées restent visibles pour les autres utilisateurs concernés, mais de façon anonyme. Cette action est irréversible.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            await deleteAccountAndReset();
            Alert.alert(
              'Compte supprimé',
              "Tes informations personnelles ont été effacées. Ferme complètement l'application et rouvre-la pour repartir de zéro."
            );
          },
        },
      ]
    );
  };

  const toggleDark = async (value) => {
    setDark(value);
    try {
      await AsyncStorage.setItem('zuno_theme', value ? 'dark' : 'light');
    } catch (e) {}
    try {
      // Redémarre l'app tout de suite pour appliquer les couleurs partout.
      await Updates.reloadAsync();
    } catch (e) {
      Alert.alert(
        t('Thème sombre'),
        "Ferme complètement l'application et rouvre-la pour appliquer le nouveau thème."
      );
    }
  };

  const hasName = profile?.nom && profile.nom !== 'Toi (test)';

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('Paramètres')}</Text>
        <View style={{ width: 22 }} />
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Résumé du profil */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Moi', { screen: 'EditProfile' })}
        >
          <View style={styles.avatar}>
            {profile?.avatar_icon ? (
              <View style={[styles.avatarFill, { backgroundColor: profile.avatar_color }]}>
                <Ionicons name={profile.avatar_icon} size={24} color={colors.white} />
              </View>
            ) : profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={24} color={colors.white} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {hasName ? profile.nom : t('Complète ton profil')}
            </Text>
            <Text style={styles.profileSub} numberOfLines={1}>
              {profile?.ville ? profile.ville : t('Appuie pour modifier tes informations')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <Group title={t('Compte')}>
          <Row icon="person-outline" label={t('Mon profil')} onPress={() => navigation.navigate('Moi')} />
          <Row
            icon="heart-outline"
            label={t("Revoir mes centres d'intérêt")}
            onPress={handleResetInterests}
            last
          />
        </Group>

        <Group title={t('Préférences')}>
          <Row icon="language-outline" label={t('Langue')} value={langLabel} onPress={() => setPicker('lang')} />
          <Row icon="cash-outline" label={t('Devise')} value={currencyLabel} onPress={() => setPicker('currency')} />
          <Row
            icon="moon-outline"
            label={t('Thème sombre')}
            last
            right={<Switch value={dark} onValueChange={toggleDark} trackColor={{ true: colors.orange }} />}
          />
        </Group>

        <Group title={t('Légal')}>
          <Row
            icon="shield-checkmark-outline"
            label={t('Politique de confidentialité')}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <Row
            icon="document-text-outline"
            label={t("Conditions d'utilisation")}
            onPress={() => Linking.openURL(TERMS_URL)}
            last
          />
        </Group>

        {SHOW_TEST_TOOLS ? (
          <Group title="Outils de test">
            <Row
              icon="swap-horizontal-outline"
              label="Changer d'identité"
              onPress={handleResetIdentity}
            />
            <Row
              icon="shield-outline"
              label="Modération"
              onPress={() => navigation.navigate('Moderation')}
              last
            />
          </Group>
        ) : null}

        <Group title={t('Zone dangereuse')}>
          <Row
            icon="trash-outline"
            label={t('Supprimer mon compte')}
            danger
            onPress={handleDeleteAccount}
            last
          />
        </Group>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>zuno</Text>
          <Text style={styles.footerText}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>{picker === 'lang' ? t('Choisis ta langue') : t('Choisis ta devise')}</Text>
            {(picker === 'lang' ? LANGS : CURRENCIES).map((o) => {
              const on = picker === 'lang' ? o.code === lang : o.code === currency;
              return (
                <TouchableOpacity
                  key={o.code}
                  style={styles.option}
                  onPress={() => {
                    if (picker === 'lang') setLang(o.code);
                    else setCurrency(o.code);
                    setPicker(null);
                  }}
                >
                  <Text style={[styles.optionText, on && { color: colors.purple, fontWeight: '800' }]}>{o.label}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={20} color={colors.purple} /> : null}
                </TouchableOpacity>
              );
            })}
            {picker === 'currency' ? (
              <Text style={styles.sheetNote}>{t('Les prix des annonces sont affichés à titre indicatif. Tu paies toujours en FCFA.')}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const shadow = {
  shadowColor: '#1B0A5C',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.white },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    ...shadow,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  profileSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  groupWrap: { marginTop: spacing.lg },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    ...shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.tintOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: colors.tintRed },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowValue: { fontSize: 13, color: colors.textSecondary },
  soonWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  soonText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.orange,
    backgroundColor: colors.tintOrange,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  overlay: { flex: 1, backgroundColor: 'rgba(20,10,60,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl * 1.5 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  sheetNote: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 17 },

  footer: { alignItems: 'center', marginTop: spacing.xl },
  footerBrand: { fontSize: 18, fontWeight: '800', color: colors.purple },
  footerText: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
