import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Share, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme/colors';

// ---------- Outils ----------
export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} à ${time}`;
}
const money = (n) => `${Number(n || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`;

const DELIVERY_LABELS = {
  a_traiter: 'Commande enregistrée',
  pris_en_charge: 'En préparation',
  en_cours: 'En livraison',
  livre: 'Livrée',
  annulee: 'Annulée',
};
const COURIER_LABELS = {
  nouvelle: 'Demande reçue',
  acceptee: 'Coursier confirmé',
  en_cours: 'En route',
  livree: 'Livrée',
  annulee: 'Annulée',
};
const URGENCY = { normal: 'Normale', urgent: 'Urgente', express: 'Express' };

// ---------- Construction des reçus ----------
export function buildOrderReceipt(order, sellerName) {
  const delivery = order.deliveries?.[0] || {};
  const qty = Number(order.quantite) || 1;
  const frais = Number(order.frais_livraison) || 0;
  const remise = Number(order.discount_amount) || 0;
  const total = Number(order.montant) || 0;
  const unit = Math.max(0, Math.round((total - frais + remise) / qty));
  const isPickup = order.mode_livraison === 'pickup';
  const payment =
    order.payment_provider === 'cash'
      ? 'Espèces (à la livraison / en main propre)'
      : order.payment_provider
      ? `Paiement mobile (${String(order.payment_provider).toUpperCase()})`
      : 'En attente de paiement';
  const rows = [
    ['Article', order.listings?.title || 'Article'],
    ['Quantité', String(qty)],
    ['Prix unitaire', money(unit)],
  ];
  if (remise > 0) rows.push([`Remise${order.promo_code ? ' (' + order.promo_code + ')' : ''}`, '− ' + money(remise)]);
  rows.push(['Livraison', frais > 0 ? money(frais) : isPickup ? 'Retrait (gratuit)' : 'Offerte / à convenir']);
  const info = [
    ['Vendeur', sellerName || 'Vendeur Zuno'],
    ['Mode de réception', isPickup ? 'Retrait en main propre' : 'Livraison'],
  ];
  if (!isPickup && delivery.quartier) info.push(['Adresse', delivery.quartier]);
  if (delivery.nom_contact) info.push(['Contact', `${delivery.nom_contact}${delivery.telephone_contact ? ' · ' + delivery.telephone_contact : ''}`]);
  info.push(['Paiement', payment]);
  info.push(['Statut', DELIVERY_LABELS[delivery.statut_livraison] || 'Commande enregistrée']);
  return {
    kind: 'Reçu de commande',
    number: `ZN-CMD-${String(order.reference_number).padStart(6, '0')}`,
    date: order.created_at,
    rows,
    info,
    total,
    totalLabel: 'Total payé',
    canceled: delivery.statut_livraison === 'annulee',
  };
}

export function buildCourierReceipt(r) {
  const rows = [
    ['Service', 'Course coursier Zuno'],
    ['Départ', r.pickup_address || '—'],
    ['Arrivée', r.dropoff_address || '—'],
    ['Colis', r.package_description || '—'],
  ];
  const info = [];
  if (r.contact_name) info.push(['Expéditeur', `${r.contact_name}${r.contact_phone ? ' · ' + r.contact_phone : ''}`]);
  if (r.recipient_name) info.push(['Destinataire', `${r.recipient_name}${r.recipient_phone ? ' · ' + r.recipient_phone : ''}`]);
  if (r.urgency) info.push(['Urgence', URGENCY[r.urgency] || r.urgency]);
  info.push(['Statut', COURIER_LABELS[r.status] || r.status]);
  return {
    kind: 'Reçu de course',
    number: `ZN-COU-${String(r.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    date: r.created_at,
    rows,
    info,
    total: null,
    totalText: r.price_quote || 'Prix à confirmer',
    totalLabel: 'Prix de la course',
    canceled: r.status === 'annulee',
  };
}

export function receiptText(rc) {
  const lines = [
    `🧾 ${rc.kind} Zuno`,
    `N° ${rc.number}`,
    `Date : ${fmtDateTime(rc.date)}`,
    '',
    ...rc.rows.map(([a, b]) => `${a} : ${b}`),
    '',
    `${rc.totalLabel} : ${rc.totalText || money(rc.total)}`,
    '',
    ...rc.info.map(([a, b]) => `${a} : ${b}`),
    '',
    'Ce reçu fait foi de preuve de transaction sur Zuno.',
  ];
  return lines.join('\n');
}

// ---------- Fenêtre du reçu ----------
function Body({ receipt, onClose }) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0);
  if (!receipt) return null;

  const share = async () => {
    try { await Share.share({ message: receiptText(receipt) }); } catch (e) { /* annulé */ }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: top + 10 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.hBtn}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hTitle}>{receipt.kind}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.ticket}>
          <View style={styles.brandRow}>
            <View style={styles.logo}><Text style={styles.logoText}>Z</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>Zuno</Text>
              <Text style={styles.brandSub}>La marketplace de confiance</Text>
            </View>
            {receipt.canceled ? (
              <View style={[styles.stamp, { backgroundColor: '#FDECEA' }]}><Text style={[styles.stampText, { color: colors.danger }]}>ANNULÉ</Text></View>
            ) : (
              <View style={styles.stamp}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.stampText}>ENREGISTRÉ</Text></View>
            )}
          </View>

          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>N° du reçu</Text>
              <Text style={styles.metaValue}>{receipt.number}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={styles.metaLabel}>Date et heure</Text>
              <Text style={styles.metaValue}>{fmtDateTime(receipt.date)}</Text>
            </View>
          </View>

          <View style={styles.dash} />
          {receipt.rows.map(([a, b], i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{a}</Text>
              <Text style={styles.rowValue}>{b}</Text>
            </View>
          ))}
          <View style={styles.dash} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{receipt.totalLabel}</Text>
            <Text style={styles.totalValue}>{receipt.totalText || money(receipt.total)}</Text>
          </View>

          <View style={styles.dash} />
          {receipt.info.map(([a, b], i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{a}</Text>
              <Text style={styles.rowValue}>{b}</Text>
            </View>
          ))}

          <Text style={styles.foot}>Ce reçu fait foi de preuve de transaction sur Zuno. Conserve-le en cas de litige ou de réclamation.</Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={18} color="#fff" />
          <Text style={styles.shareText}>Partager le reçu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.closeText}>Fermer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default function ReceiptModal({ visible, receipt, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <Body receipt={receipt} onClose={onClose} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.purple, paddingBottom: 14, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  hBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ticket: { backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#1B1530', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#1B0A4D', fontWeight: '800', fontSize: 22 },
  brand: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  brandSub: { fontSize: 11, color: colors.textMuted },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  stampText: { fontSize: 10, fontWeight: '800', color: colors.success, letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 18 },
  metaLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  metaValue: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  dash: { borderTopWidth: 1.5, borderTopColor: colors.border, borderStyle: 'dashed', marginVertical: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 5 },
  rowLabel: { fontSize: 13, color: colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.tintOrange, borderRadius: 14, padding: 14 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.orange },
  foot: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 18, lineHeight: 16 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 14, marginTop: 18 },
  shareText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  closeBtn: { alignItems: 'center', paddingVertical: 14 },
  closeText: { color: colors.purple, fontWeight: '700', fontSize: 14 },
});
