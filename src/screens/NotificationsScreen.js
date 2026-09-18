import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

// Promos statiques pour l'instant : à brancher sur un vrai système
// de promotions plus tard si besoin.
const PROMOS = [
  {
    id: 'promo-1',
    title: 'Premier dépôt offert',
    description: "Ta première annonce mise en avant gratuitement cette semaine.",
  },
];

export default function NotificationsScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [newListings, setNewListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();

    // Derniers messages reçus.
    const { data: msgData } = await supabase
      .from('messages')
      .select('*, listings(title)')
      .eq('destinataire_id', myId)
      .order('created_at', { ascending: false })
      .limit(5);
    setMessages(msgData || []);

    // Nouveaux articles dans les catégories où j'ai déjà publié ou acheté
    // (une première approximation des "habitudes du profil").
    const { data: myListings } = await supabase
      .from('listings')
      .select('category')
      .eq('vendeur_id', myId);
    const { data: myOrders } = await supabase
      .from('orders')
      .select('listings(category)')
      .eq('acheteur_id', myId);

    const categories = new Set([
      ...(myListings || []).map((l) => l.category),
      ...(myOrders || []).map((o) => o.listings?.category).filter(Boolean),
    ]);

    if (categories.size > 0) {
      const { data: recent } = await supabase
        .from('listings')
        .select('*')
        .in('category', Array.from(categories))
        .eq('status', 'disponible')
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(5);
      setNewListings(recent || []);
    } else {
      setNewListings([]);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const sections = [
    { key: 'messages', title: 'Messages', icon: 'chatbubble-outline', data: messages },
    { key: 'promos', title: 'Promotions', icon: 'pricetag-outline', data: PROMOS },
    { key: 'listings', title: 'Nouveaux articles pour toi', icon: 'sparkles-outline', data: newListings },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.key}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name={section.icon} size={16} color={colors.textSecondary} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>

              {section.data.length === 0 && (
                <Text style={styles.emptyText}>Rien de nouveau ici pour l'instant.</Text>
              )}

              {section.key === 'messages' &&
                section.data.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.card}
                    onPress={() =>
                      navigation.navigate('Chat', {
                        listingId: m.listing_id,
                        listingTitle: m.listings?.title || 'Annonce',
                        otherUserId: m.expediteur_id,
                      })
                    }
                  >
                    <Text style={styles.cardTitle}>{m.listings?.title || 'Annonce'}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {m.contenu}
                    </Text>
                  </TouchableOpacity>
                ))}

              {section.key === 'promos' &&
                section.data.map((p) => (
                  <View key={p.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{p.title}</Text>
                    <Text style={styles.cardSubtitle}>{p.description}</Text>
                  </View>
                ))}

              {section.key === 'listings' &&
                section.data.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={styles.card}
                    onPress={() => navigation.navigate('ProductDetail', { listing: l })}
                  >
                    <Text style={styles.cardTitle}>{l.title}</Text>
                    <Text style={styles.cardSubtitle}>
                      {Number(l.price).toLocaleString('fr-FR')} FCFA · {l.city}
                    </Text>
                  </TouchableOpacity>
                ))}
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
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 12, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
