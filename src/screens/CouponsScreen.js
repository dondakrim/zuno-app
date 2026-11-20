// Coupons — src/screens/CouponsScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';
import InfoHeader from '../components/InfoHeader';

const valueLabel = (c) =>
  c.discount_type === 'percentage'
    ? `-${Number(c.discount_value)}%`
    : `-${Number(c.discount_value).toLocaleString('fr-FR')} FCFA`;

export default function CouponsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const { data } = await supabase
            .from('promo_codes')
            .select('id, code, discount_type, discount_value, min_amount, max_uses, uses_count, expires_at')
            .eq('is_public', true)
            .eq('active', true)
            .order('created_at', { ascending: false });
          const now = Date.now();
          const ok = (data || []).filter(
            (c) =>
              (!c.expires_at || new Date(c.expires_at).getTime() > now) &&
              (c.max_uses == null || c.uses_count < c.max_uses)
          );
          if (alive) setItems(ok);
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
      <InfoHeader title="Coupons" navigation={navigation} />
      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            items.length ? <Text style={styles.intro}>Appuie longtemps sur un code pour le copier, puis colle-le au moment du paiement.</Text> : null
          }
          ListEmptyComponent={<Text style={styles.empty}>Aucun coupon disponible pour le moment. Reviens bientôt !</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.left}>
                <Ionicons name="ticket" size={22} color={colors.orange} />
                <Text style={styles.value}>{valueLabel(item)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.code} selectable>{item.code}</Text>
                <Text style={styles.meta}>
                  {item.min_amount > 0 ? `Dès ${Number(item.min_amount).toLocaleString('fr-FR')} FCFA d’achat` : 'Sans minimum d’achat'}
                </Text>
                {item.expires_at ? (
                  <Text style={styles.meta}>Valable jusqu’au {new Date(item.expires_at).toLocaleDateString('fr-FR')}</Text>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 19 },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: spacing.xl, lineHeight: 19 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange },
  left: { alignItems: 'center', gap: 4, minWidth: 76 },
  value: { fontSize: 16, fontWeight: '900', color: colors.orange },
  code: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5, color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
