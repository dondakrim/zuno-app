// Blog (article) — src/screens/BlogPostScreen.js
import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/colors';
import InfoHeader from '../components/InfoHeader';

export default function BlogPostScreen({ navigation, route }) {
  const post = route?.params?.post;
  if (!post) return null;
  return (
    <View style={styles.container}>
      <InfoHeader title="Blog" navigation={navigation} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {post.cover_url ? <Image source={{ uri: post.cover_url }} style={styles.cover} /> : null}
        <Text style={styles.date}>{new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.text}>{post.body}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  cover: { width: '100%', height: 190, borderRadius: 16, marginBottom: spacing.md, backgroundColor: colors.border },
  date: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, marginBottom: spacing.md, lineHeight: 28 },
  text: { fontSize: 15, lineHeight: 24, color: colors.textSecondary },
});
