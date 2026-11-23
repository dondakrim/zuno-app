import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { usePrefs } from '../lib/prefs';
import { colors, spacing, radius } from '../theme/colors';
import GradientHeader from '../components/GradientHeader';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

const PROMOS = [
  {
    id: 'promo-1',
    title: 'Premier dépôt offert',
    description: 'Ta première annonce mise en avant gratuitement cette semaine.',
  },
];

const FILTERS = [
  { key: 'all', label: 'Tout' },
  { key: 'order', label: 'Commandes' },
  { key: 'message', label: 'Messages' },
  { key: 'info', label: 'Infos' },
];

// Icône + couleurs selon le type de notification
function visualFor(kind, title = '') {
  const t = title.toLowerCase();
  if (kind === 'order') {
    if (t.includes('livrée')) return { icon: 'checkmark-circle', fg: colors.success, bg: colors.successBg };
    if (t.includes('annulée')) return { icon: 'close-circle', fg: colors.danger, bg: colors.tintRed };
    if (t.includes('expédiée') || t.includes('route')) return { icon: 'car', fg: colors.blue, bg: colors.tintBlue };
    if (t.includes('nouvelle commande')) return { icon: 'bag-check', fg: colors.orange, bg: colors.tintOrange };
    return { icon: 'cube', fg: colors.blue, bg: colors.tintBlue };
  }
  if (kind === 'message') return { icon: 'chatbubble-ellipses', fg: colors.purple, bg: colors.tintPurple };
  if (kind === 'promo') return { icon: 'pricetag', fg: colors.orange, bg: colors.tintOrange };
  return { icon: 'megaphone', fg: colors.orange, bg: colors.tintOrange };
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function dayBucket(iso) {
  const d = new Date(iso);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((start(new Date()) - start(d)) / 86400000);
  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return 'Cette semaine';
  return 'Plus ancien';
}
const BUCKET_ORDER = ["Aujourd'hui", 'Hier', 'Cette semaine', 'Plus ancien'];

export default function NotificationsScreen({ navigation }) {
  const { formatPrice } = usePrefs();
  const [items, setItems] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const myId = await getDeviceUserId();

    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', myId)
      .order('created_at', { ascending: false })
      .limit(50);

    // On garde en mémoire ce qui était « non lu » avant de tout marquer comme lu
    const feed = (notifs || []).map((n) => ({
      id: 'n-' + n.id,
      kind: n.type === 'order' ? 'order' : 'info',
      title: n.title,
      body: n.body,
      image: n.image_url,
      date: n.created_at,
      unread: n.read === false,
    }));

    await supabase.from('notifications').update({ read: true }).eq('user_id', myId).eq('read', false);

    // Derniers messages reçus (une ligne par conversation)
    const { data: msgData } = await supabase
      .from('messages')
      .select('*, listings(title)')
      .eq('destinataire_id', myId)
      .order('created_at', { ascending: false })
      .limit(30);
    const seen = new Set();
    (msgData || []).forEach((m) => {
      const key = `${m.listing_id}-${m.expediteur_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      feed.push({
        id: 'm-' + m.id,
        kind: 'message',
        title: m.listings?.title || 'Annonce',
        body: m.contenu,
        date: m.created_at,
        unread: false,
        chat: { listingId: m.listing_id, listingTitle: m.listings?.title || 'Annonce', otherUserId: m.expediteur_id },
      });
    });

    feed.sort((a, b) => new Date(b.date) - new Date(a.date));
    setItems(feed);

    // Suggestions d'articles selon les habitudes
    const { data: myListings } = await supabase.from('listings').select('category').eq('vendeur_id', myId);
    const { data: myOrders } = await supabase.from('orders').select('listings(category)').eq('acheteur_id', myId);
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
        .limit(8);
      setSuggested(recent || []);
    } else {
      setSuggested([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unreadCount = items.filter((i) => i.unread).length;

  const sections = useMemo(() => {
    const list = filter === 'all' ? items : items.filter((i) => i.kind === filter);
    const groups = {};
    list.forEach((i) => {
      const b = dayBucket(i.date);
      (groups[b] = groups[b] || []).push(i);
    });
    return BUCKET_ORDER.filter((b) => groups[b]).map((b) => ({ title: b, data: groups[b] }));
  }, [items, filter]);

  const openItem = (it) => {
    if (it.chat) navigation.navigate('Chat', it.chat);
    else if (it.kind === 'order') navigation.navigate('Moi', { screen: 'MyOrders' });
  };

  const renderItem = ({ item }) => {
    const v = visualFor(item.kind, item.title);
    const tappable = !!item.chat || item.kind === 'order';
    return (
      <TouchableOpacity
        activeOpacity={tappable ? 0.8 : 1}
        onPress={() => openItem(item)}
        style={[styles.row, item.unread && styles.rowUnread]}
      >
        <View style={[styles.iconWrap, { backgroundColor: v.bg }]}>
          <Ionicons name={v.icon} size={20} color={v.fg} />
        </View>
        <View style={{ flex: 1 }}>
          {item.image ? <Image source={{ uri: item.image }} style={styles.image} /> : null}
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            {item.unread ? <View style={styles.dot} /> : null}
          </View>
          {item.body ? <Text style={styles.body} numberOfLines={3}>{item.body}</Text> : null}
          <Text style={styles.time}>{timeAgo(item.date)}</Text>
        </View>
        {tappable ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filter === 'all' || filter === 'info' ? (
        <View style={styles.promoCard}>
          <Ionicons name="gift" size={22} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.promoTitle}>{PROMOS[0].title}</Text>
            <Text style={styles.promoText}>{PROMOS[0].description}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const footer = suggested.length > 0 && (filter === 'all' || filter === 'info') ? (
    <View style={{ marginTop: spacing.md }}>
      <View style={styles.sectionRow}>
        <Ionicons name="sparkles" size={15} color={colors.orange} />
        <Text style={styles.sectionTitle}>Nouveaux articles pour toi</Text>
      </View>
      <FlatList
        horizontal
        data={suggested}
        keyExtractor={(l) => String(l.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item: l }) => (
          <TouchableOpacity
            style={styles.sugCard}
            onPress={() => navigation.navigate('ProductDetail', { listing: l })}
            activeOpacity={0.85}
          >
            <Text style={styles.sugTitle} numberOfLines={2}>{l.title}</Text>
            <Text style={styles.sugPrice}>{formatPrice(l.price)}</Text>
            <Text style={styles.sugCity} numberOfLines={1}>{l.city}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? <Text style={styles.headerSub}>{unreadCount} nouvelle(s)</Text> : null}
        </View>
        <View style={{ width: 22 }} />
      </GradientHeader>

      {loading ? (
        <ActivityIndicator color={colors.purple} style={{ marginTop: spacing.xl }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={styles.bucket}>{section.title}</Text>}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={30} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Rien pour l'instant</Text>
              <Text style={styles.emptyText}>
                Tes commandes, messages et infos importantes apparaîtront ici.
              </Text>
            </View>
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
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
    backgroundColor: colors.purple,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterTextActive: { color: colors.white },

  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.orange,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  promoTitle: { color: colors.white, fontWeight: '800', fontSize: 14 },
  promoText: { color: 'rgba(255,255,255,0.95)', fontSize: 12, marginTop: 2 },

  bucket: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowUnread: { borderColor: colors.orange, backgroundColor: colors.tintOrange },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  body: { fontSize: 12.5, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  image: { width: '100%', height: 130, borderRadius: 10, marginBottom: 8 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  sugCard: {
    width: 150,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  sugTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, minHeight: 34 },
  sugPrice: { fontSize: 13, fontWeight: '800', color: colors.orange, marginTop: 6 },
  sugCity: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.xl },
});
