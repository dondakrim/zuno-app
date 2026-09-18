import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

export default function ModerationScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('moderation_queue')
      .select('*, listings(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!error && data) setItems(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadQueue();
    }, [loadQueue])
  );

  const handleDecision = async (entry, decision) => {
    const myId = await getDeviceUserId();
    const newModerationStatus = decision === 'approve' ? 'approved' : 'blocked';

    await supabase
      .from('listings')
      .update({ moderation_status: newModerationStatus })
      .eq('id', entry.listing_id);

    await supabase
      .from('moderation_queue')
      .update({
        status: decision === 'approve' ? 'reviewed_ok' : 'reviewed_removed',
        reviewer_id: myId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    await supabase.from('moderation_logs').insert({
      listing_id: entry.listing_id,
      actor_type: 'moderator',
      actor_id: myId,
      action: decision === 'approve' ? 'moderator_approve' : 'moderator_remove',
      details: { queue_entry_id: entry.id },
    });

    loadQueue();
  };

  const confirmDecision = (entry, decision) => {
    Alert.alert(
      decision === 'approve' ? 'Approuver cette annonce ?' : 'Retirer cette annonce ?',
      entry.listings?.title || '',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: decision === 'approve' ? 'Approuver' : 'Retirer', onPress: () => handleDecision(entry, decision) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modération</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Rien à vérifier pour l'instant.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.thumb}>
                  {item.listings?.photo_url ? (
                    <Image source={{ uri: item.listings.photo_url }} style={styles.thumbImage} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.listings?.title}</Text>
                  <Text style={styles.cardSubtitle}>
                    {item.source === 'user_report' ? 'Signalé par un utilisateur' : 'Détection automatique'}
                    {item.category ? ` · ${item.category.replace(/_/g, ' ')}` : ''}
                  </Text>
                </View>
              </View>

              {item.detected_keywords?.length > 0 && (
                <Text style={styles.keywords}>
                  Mots détectés : {item.detected_keywords.join(', ')}
                </Text>
              )}
              {item.reporter_comment && (
                <Text style={styles.keywords}>Commentaire : {item.reporter_comment}</Text>
              )}
              {item.score > 0 && <Text style={styles.keywords}>Score de risque : {item.score}</Text>}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => confirmDecision(item, 'approve')}
                >
                  <Text style={styles.approveButtonText}>Approuver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => confirmDecision(item, 'remove')}
                >
                  <Text style={styles.removeButtonText}>Retirer</Text>
                </TouchableOpacity>
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
  header: {
    backgroundColor: colors.purple,
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  keywords: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  approveButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  approveButtonText: { color: colors.white, fontWeight: '600', fontSize: 12 },
  removeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  removeButtonText: { color: colors.white, fontWeight: '600', fontSize: 12 },
});
