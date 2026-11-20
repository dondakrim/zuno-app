import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import { checkMessage, BLOCK_MESSAGE } from '../lib/chatGuard';

// Phrases toutes prêtes pour accélérer la discussion jusqu'à la commande
const BUYER_QUICK = [
  'Bonjour, cet article est-il toujours disponible ?',
  'Quel est ton meilleur prix ?',
  'Peux-tu envoyer plus de photos ?',
  'Quel est son état exactement ?',
  'Comment se passe la livraison ?',
  'Je suis intéressé(e), je passe commande sur Zuno.',
];
const SELLER_QUICK = [
  'Bonjour, oui il est toujours disponible.',
  'Tu peux passer commande directement sur Zuno, le paiement est sécurisé.',
  'Je peux faire un petit geste sur le prix.',
  'Il est en très bon état, comme sur les photos.',
  'La livraison se fait via Zuno, tu seras suivi(e) à chaque étape.',
  'Merci pour ta commande, je prépare ça !',
];

export default function ChatScreen({ route, navigation }) {
  const { listingId, listingTitle, otherUserId } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [myId, setMyId] = useState(null);
  const [sending, setSending] = useState(false);
  const [activeOffer, setActiveOffer] = useState(null);
  const [sellerId, setSellerId] = useState(null);
  const listRef = useRef(null);

  const loadThread = useCallback(async () => {
    const id = await getDeviceUserId();
    setMyId(id);

    const { data: listingRow } = await supabase
      .from('listings')
      .select('vendeur_id')
      .eq('id', listingId)
      .maybeSingle();
    setSellerId(listingRow?.vendeur_id || null);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('listing_id', listingId)
      .or(
        `and(expediteur_id.eq.${id},destinataire_id.eq.${otherUserId}),and(expediteur_id.eq.${otherUserId},destinataire_id.eq.${id})`
      )
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }

    const { data: offerData } = await supabase
      .from('offers')
      .select('*')
      .eq('listing_id', listingId)
      .or(
        `and(buyer_id.eq.${id},seller_id.eq.${otherUserId}),and(buyer_id.eq.${otherUserId},seller_id.eq.${id})`
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveOffer(offerData || null);
  }, [listingId, otherUserId]);

  const handleOfferResponse = async (status) => {
    if (!activeOffer) return;
    const { error } = await supabase.from('offers').update({ status }).eq('id', activeOffer.id);
    if (error) return;

    const myUserId = myId;
    await supabase.from('messages').insert({
      listing_id: listingId,
      expediteur_id: myUserId,
      destinataire_id: otherUserId,
      contenu:
        status === 'acceptee'
          ? `✅ Offre acceptée : ${Number(activeOffer.montant).toLocaleString('fr-FR')} FCFA`
          : `❌ Offre refusée`,
    });
    loadThread();
  };

  // Recharge la conversation à chaque fois qu'on revient sur cet écran.
  useFocusEffect(
    useCallback(() => {
      loadThread();
    }, [loadThread])
  );

  const sendText = async (raw) => {
    const content = String(raw || '').trim();
    if (!content || !myId) return;

    if (checkMessage(content)) {
      Alert.alert('Message non envoyé', BLOCK_MESSAGE);
      return;
    }
    setInput('');
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      listing_id: listingId,
      expediteur_id: myId,
      destinataire_id: otherUserId,
      contenu: content,
    });

    setSending(false);
    if (error) {
      setInput(content);
      if (String(error.message || '').includes('CONTACT_INTERDIT')) {
        Alert.alert('Message non envoyé', BLOCK_MESSAGE);
      } else {
        Alert.alert('Erreur', "Le message n'a pas pu être envoyé. Réessaie.");
      }
      return;
    }
    loadThread();
  };

  const handleSend = () => sendText(input);

  const iAmSeller = sellerId && myId === sellerId;
  const quick = iAmSeller ? SELLER_QUICK : BUYER_QUICK;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {listingTitle}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.safeBanner}>
        <Ionicons name="shield-checkmark" size={15} color={colors.success} />
        <Text style={styles.safeBannerText}>
          Reste sur Zuno : paiement protégé et suivi de livraison. Les numéros ne s'échangent pas ici.
        </Text>
      </View>

      {activeOffer && activeOffer.status === 'en_attente' && (
        <View style={styles.offerBanner}>
          <Ionicons name="pricetag" size={16} color={colors.white} />
          <Text style={styles.offerBannerText}>
            Offre : {Number(activeOffer.montant).toLocaleString('fr-FR')} FCFA
          </Text>
          {myId === activeOffer.seller_id ? (
            <View style={styles.offerBannerButtons}>
              <TouchableOpacity
                onPress={() => handleOfferResponse('acceptee')}
                style={styles.offerAcceptButton}
              >
                <Text style={styles.offerAcceptButtonText}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleOfferResponse('refusee')}
                style={styles.offerRejectButton}
              >
                <Text style={styles.offerRejectButtonText}>Refuser</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.offerWaitingText}>En attente de réponse</Text>
          )}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Aucun message pour l'instant. Lance la conversation !
          </Text>
        }
        renderItem={({ item }) => {
          const isMine = item.expediteur_id === myId;
          return (
            <View
              style={[
                styles.bubble,
                isMine ? styles.bubbleMine : styles.bubbleTheirs,
              ]}
            >
              <Text style={isMine ? styles.bubbleTextMine : styles.bubbleText}>
                {item.contenu}
              </Text>
            </View>
          );
        }}
      />

      {!input.trim() ? (
        <View style={styles.quickWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow} keyboardShouldPersistTaps="handled">
            {quick.map((q) => (
              <TouchableOpacity key={q} style={styles.quickChip} onPress={() => sendText(q)} disabled={sending} activeOpacity={0.8}>
                <Text style={styles.quickChipText} numberOfLines={2}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          placeholder="Écris ton message…"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          style={styles.input}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    gap: spacing.sm,
  },
  headerTitle: { color: colors.white, fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  offerBanner: {
    backgroundColor: colors.purpleDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  offerBannerText: { color: colors.white, fontWeight: '700', fontSize: 13, flex: 1 },
  offerBannerButtons: { flexDirection: 'row', gap: 6 },
  offerAcceptButton: {
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  offerAcceptButtonText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  offerRejectButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  offerRejectButtonText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  offerWaitingText: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  safeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    backgroundColor: colors.successBg,
  },
  safeBannerText: { flex: 1, fontSize: 11, color: colors.textPrimary },
  quickWrap: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  quickRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  quickChip: {
    maxWidth: 230,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.purple,
    backgroundColor: colors.tintPurple,
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: colors.purple },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: spacing.xl },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.orange,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: colors.textPrimary, fontSize: 14 },
  bubbleTextMine: { color: colors.white, fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 0,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
