// Blog (article) — src/screens/BlogPostScreen.js
// Comprend une mise en forme simple écrite depuis le tableau de bord :
//   # Titre   ## Sous-titre   - liste   **gras**   ![](https://image)
import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/colors';
import InfoHeader from '../components/InfoHeader';

function Inline({ text, style }) {
  const parts = String(text).split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((p, i) => (i % 2 === 1 ? <Text key={i} style={styles.bold}>{p}</Text> : p))}
    </Text>
  );
}

function renderBody(body) {
  const lines = String(body || '').replace(/\r/g, '').split('\n');
  const out = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { out.push(<View key={i} style={{ height: 8 }} />); return; }
    const img = line.match(/^!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)$/);
    if (img) { out.push(<Image key={i} source={{ uri: img[1] }} style={styles.inlineImage} resizeMode="cover" />); return; }
    if (line.startsWith('## ')) { out.push(<Inline key={i} text={line.slice(3)} style={styles.h2} />); return; }
    if (line.startsWith('# ')) { out.push(<Inline key={i} text={line.slice(2)} style={styles.h1} />); return; }
    if (line.startsWith('- ')) {
      out.push(
        <View key={i} style={styles.liRow}>
          <Text style={styles.bullet}>•</Text>
          <Inline text={line.slice(2)} style={[styles.text, { flex: 1 }]} />
        </View>
      );
      return;
    }
    out.push(<Inline key={i} text={line} style={[styles.text, { marginBottom: 6 }]} />);
  });
  return out;
}

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
        {renderBody(post.body)}
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
  bold: { fontWeight: '800', color: colors.textPrimary },
  h1: { fontSize: 19, fontWeight: '900', color: colors.textPrimary, marginTop: spacing.md, marginBottom: 6, lineHeight: 26 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm, marginBottom: 4, lineHeight: 22 },
  liRow: { flexDirection: 'row', gap: 8, marginBottom: 4, paddingLeft: 4 },
  bullet: { fontSize: 15, lineHeight: 24, color: colors.orange, fontWeight: '900' },
  inlineImage: { width: '100%', height: 200, borderRadius: 14, marginVertical: spacing.sm, backgroundColor: colors.border },
});
