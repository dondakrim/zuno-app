// Événements et collections (Black Friday…) — src/components/EventsSection.js
// S'affiche tout seul pendant les dates choisies dans le tableau de bord > Événements.
// Sans événement en cours, ne rend rien (aucune place perdue sur l'accueil).
import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../theme/colors';
import { supabase } from '../lib/supabase';
import ProductCard from './ProductCard';

function remaining(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `Se termine dans ${Math.max(h, 1)} h`;
  const d = Math.ceil(ms / 86400000);
  return `Se termine dans ${d} jour${d > 1 ? 's' : ''}`;
}

export default function EventsSection({ getSellerRating, wishlistIds, onToggleWishlist, onPressItem }) {
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, subtitle, emoji, color, image_url, ends_at, position, event_listings(position, listings(*))')
          .order('position', { ascending: true });
        if (cancelled || error || !data) return;
        setEvents(
          data
            .map((e) => ({
              ...e,
              items: (e.event_listings || [])
                .sort((a, b) => a.position - b.position)
                .map((l) => l.listings)
                .filter((l) => l && l.moderation_status !== 'blocked'),
            }))
            .filter((e) => e.items.length > 0)
        );
      })();
      return () => { cancelled = true; };
    }, [])
  );

  if (events.length === 0) return null;

  return (
    <View>
      {events.map((e) => (
        <View key={e.id} style={styles.block}>
          <View style={[styles.banner, { backgroundColor: e.color }]}>
            {e.image_url ? <Image source={{ uri: e.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <View style={e.image_url ? styles.shade : null}>
              <Text style={styles.title}>{e.emoji} {e.title}</Text>
              {e.subtitle ? <Text style={styles.sub}>{e.subtitle}</Text> : null}
              {remaining(e.ends_at) ? <Text style={styles.timer}>{remaining(e.ends_at)}</Text> : null}
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {e.items.map((item) => (
              <View key={item.id} style={styles.cell}>
                <ProductCard
                  listing={item}
                  sellerRating={getSellerRating ? getSellerRating(item.vendeur_id) : undefined}
                  isWishlisted={wishlistIds ? wishlistIds.has(item.id) : false}
                  onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(item) : undefined}
                  onPress={() => (onPressItem ? onPressItem(item) : navigation.navigate('ProductDetail', { listing: item }))}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.md },
  banner: { marginTop: spacing.md, borderRadius: 18, padding: spacing.md, overflow: 'hidden', minHeight: 84, justifyContent: 'center' },
  shade: { backgroundColor: 'rgba(0,0,0,0.35)', margin: -spacing.md, padding: spacing.md, minHeight: 84, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  timer: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 6 },
  row: { paddingTop: spacing.sm, gap: spacing.sm },
  cell: { width: 170 },
});
