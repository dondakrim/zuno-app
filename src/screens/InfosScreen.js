// Infos de Zuno (alertes et nouveautés) — src/screens/InfosScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';
import InfoHeader from '../components/InfoHeader';

const KINDS = {
  info: { icon: 'information-circle', color: colors.blue, bg: colors.tintBlue, label: 'Info' },
  alerte: { icon: 'warning', color: colors.danger, bg: colors.tintRed, label: 'Alerte' },
  nouveaute: { icon: 'sparkles', color: colors.orange, bg: colors.tintOrange, label: 'Nouveauté' },
};

export default function InfosScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const { data } = await supabase
            .from('announcements')
            .select('id, title, body, kind, created_at')
            .order('created_at', { ascending: false })
            .limit(50);
          if (!alive) return;
          setItems(data || []);
          if (data && data[0]) await AsyncStorage.setItem('zuno_infos_seen', data[0].created_at);
        } catch (e) {
          // liste vide si pas de réseau
        }
        if (alive) setLoading(false);
      })();
      return () => { alive = false; };
    }, [])
  );

  return (
    <View style={styles.container}>
      <InfoHeader title="Infos de Zuno" navigation={navigation} />
      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aucune info pour le moment. Les alertes et nouveautés de Zuno apparaîtront ici.</Text>}
          renderItem={({ item }) => {
            const k = KINDS[item.kind] || KINDS.info;
            return (
              <View style={styles.card}>
                <View style={styles.head}>
                  <View style={[styles.badge, { backgroundColor: k.bg }]}>
                    <Ionicons name={k.icon} size={14} color={k.color} />
                    <Text style={[styles.badgeText, { color: k.color }]}>{k.label}</Text>
                  </View>
                  <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: spacing.xl, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  date: { fontSize: 11, color: colors.textMuted },
  title: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  body: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
});
