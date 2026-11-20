// Blog (liste) — src/screens/BlogScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';
import InfoHeader from '../components/InfoHeader';

export default function BlogScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const { data } = await supabase
            .from('blog_posts')
            .select('id, title, excerpt, body, cover_url, created_at')
            .eq('published', true)
            .order('created_at', { ascending: false })
            .limit(50);
          if (alive) setItems(data || []);
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
      <InfoHeader title="Blog" navigation={navigation} />
      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aucun article pour le moment. Les conseils et actualités de Zuno arrivent bientôt.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('BlogPost', { post: item })}>
              {item.cover_url ? <Image source={{ uri: item.cover_url }} style={styles.cover} /> : null}
              <View style={styles.cardBody}>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                <Text style={styles.title}>{item.title}</Text>
                {item.excerpt ? <Text style={styles.excerpt} numberOfLines={3}>{item.excerpt}</Text> : null}
                <View style={styles.more}>
                  <Text style={styles.moreText}>Lire l’article</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.orange} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: spacing.xl, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', marginBottom: spacing.md },
  cover: { width: '100%', height: 150, backgroundColor: colors.border },
  cardBody: { padding: spacing.md },
  date: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  excerpt: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  moreText: { fontSize: 13, fontWeight: '700', color: colors.orange },
});
