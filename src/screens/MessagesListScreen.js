import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

export default function MessagesListScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();

    const { data, error } = await supabase
      .from('messages')
      .select('*, listings(title)')
      .or(`expediteur_id.eq.${myId},destinataire_id.eq.${myId}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Regroupe les messages par annonce + interlocuteur, pour n'afficher
      // qu'une seule ligne par conversation (avec le dernier message).
      const seen = new Map();
      data.forEach((msg) => {
        const otherId = msg.expediteur_id === myId ? msg.destinataire_id : msg.expediteur_id;
        const key = `${msg.listing_id}-${otherId}`;
        if (!seen.has(key)) {
          seen.set(key, {
            key,
            listingId: msg.listing_id,
            listingTitle: msg.listings?.title || 'Annonce',
            otherUserId: otherId,
            lastMessage: msg.contenu,
            isMine: msg.expediteur_id === myId,
          });
        }
      });
      setConversations(Array.from(seen.values()));
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Aucune conversation pour l'instant. Contacte un vendeur depuis une annonce pour commencer.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('Chat', {
                  listingId: item.listingId,
                  listingTitle: item.listingTitle,
                  otherUserId: item.otherUserId,
                })
              }
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={18} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.listingTitle}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {item.isMine ? 'Toi : ' : ''}
                  {item.lastMessage}
                </Text>
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
  header: {
    backgroundColor: colors.purple,
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
