import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import GradientHeader from '../components/GradientHeader';
import { SHOW_PICKUP } from '../lib/flags';

const DELIVERY_OPTIONS = [
  {
    id: 'pickup',
    label: 'Retrait en main propre (Pick up)',
    price: 0,
  },
  {
    id: 'meme_ville',
    label: 'Livraison dans la même ville',
    price: 1000,
  },
  {
    id: 'region',
    label: 'Expédition en région',
    price: 2000,
  },
];

const VISIBLE_DELIVERY_OPTIONS = DELIVERY_OPTIONS.filter((o) => o.id !== 'pickup' || SHOW_PICKUP);

export default function CartScreen({ route, navigation }) {
  const { listing } = route.params;
  const [quantity, setQuantity] = useState(1);
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null); // { code, discount }
  const [checkingPromo, setCheckingPromo] = useState(false);

  const subtotal = listing.price * quantity;
  const discount = appliedPromo?.discount || 0;
  const subtotalAfterDiscount = Math.max(subtotal - discount, 0);

  const handleIncrease = () => setQuantity((q) => Math.min(q + 1, 20));
  const handleDecrease = () => setQuantity((q) => Math.max(q - 1, 1));

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setCheckingPromo(true);
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .ilike('code', promoInput.trim())
      .eq('active', true)
      .maybeSingle();
    setCheckingPromo(false);

    if (error || !data) {
      Alert.alert('Code invalide', "Ce code promo n'existe pas ou n'est plus actif.");
      return;
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      Alert.alert('Code expiré', "Ce code promo n'est plus valable.");
      return;
    }
    if (data.max_uses !== null && data.uses_count >= data.max_uses) {
      Alert.alert('Code épuisé', "Ce code promo a atteint sa limite d'utilisation.");
      return;
    }
    if (subtotal < (data.min_amount || 0)) {
      Alert.alert(
        'Montant minimum requis',
        `Ce code s'applique à partir de ${Number(data.min_amount).toLocaleString('fr-FR')} FCFA d'achat.`
      );
      return;
    }

    const rawDiscount =
      data.discount_type === 'percentage' ? (subtotal * data.discount_value) / 100 : data.discount_value;
    const finalDiscount = Math.min(rawDiscount, subtotal);

    setAppliedPromo({ code: data.code, discount: finalDiscount });
    Alert.alert('Code appliqué', `-${finalDiscount.toLocaleString('fr-FR')} FCFA sur ton achat.`);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
  };

  const handleAddToCart = async () => {
    setAddingToCart(true);
    const myId = await getDeviceUserId();

    const { error } = await supabase
      .from('cart_items')
      .upsert(
        { acheteur_id: myId, listing_id: listing.id, quantity },
        { onConflict: 'acheteur_id,listing_id' }
      );

    setAddingToCart(false);
    if (error) {
      Alert.alert('Erreur', `Détail technique : ${error.message}`);
      return;
    }
    Alert.alert('Ajouté', 'Cet article a été ajouté à ton panier.');
  };

  const handleBuyPress = () => {
    setShowDeliveryOptions(true);
    if (listing.is_heavy) {
      setDeliveryMethod({ id: 'a_negocier', label: 'À négocier avec le vendeur', price: 0 });
    }
  };

  const handleSelectDelivery = (option) => {
    setDeliveryMethod(option);
    if (option.id === 'region') {
      Alert.alert(
        'À savoir',
        "Les frais de livraison peuvent changer selon la taille de l'article."
      );
    }
    if (option.id === 'pickup') {
      Alert.alert(
        'Retrait en main propre',
        "Aucun frais de livraison. Après validation de la commande, mets-toi d'accord avec le vendeur sur le lieu et l'heure via la messagerie."
      );
    }
  };

  const handlePayNow = () => {
    navigation.navigate('Checkout', {
      listing,
      quantity,
      deliveryMethod,
      promoCode: appliedPromo?.code || null,
      promoDiscount: discount,
    });
  };

  return (
    <View style={styles.container}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panier</Text>
        <View style={{ width: 36 }} />
      </GradientHeader>

      <ScrollView>
      <View style={styles.body}>
        <View style={styles.productCard}>
          <View style={styles.thumb}>
            {listing.photo_url ? (
              <Image source={{ uri: listing.photo_url }} style={styles.thumbImage} />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.textMuted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {listing.title}
            </Text>
            <Text style={styles.productPrice}>
              {Number(listing.price).toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        </View>

        <View style={styles.quantityRow}>
          <Text style={styles.quantityLabel}>Quantité</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepperButton} onPress={handleDecrease}>
              <Ionicons name="remove" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{quantity}</Text>
            <TouchableOpacity style={styles.stepperButton} onPress={handleIncrease}>
              <Ionicons name="add" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.promoRow}>
          {appliedPromo ? (
            <View style={styles.promoApplied}>
              <Ionicons name="pricetag" size={14} color={colors.success} />
              <Text style={styles.promoAppliedText}>Code « {appliedPromo.code} » appliqué</Text>
              <TouchableOpacity onPress={handleRemovePromo}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.promoInputRow}>
              <TextInput
                placeholder="Code promo"
                placeholderTextColor={colors.textMuted}
                value={promoInput}
                onChangeText={setPromoInput}
                autoCapitalize="characters"
                style={styles.promoInput}
              />
              <TouchableOpacity
                style={styles.promoApplyButton}
                onPress={handleApplyPromo}
                disabled={checkingPromo}
              >
                <Text style={styles.promoApplyButtonText}>{checkingPromo ? '…' : 'Appliquer'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {discount > 0 && (
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Réduction</Text>
            <Text style={[styles.subtotalValue, { color: colors.success }]}>
              -{discount.toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        )}

        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Sous-total</Text>
          <Text style={styles.subtotalValue}>
            {subtotalAfterDiscount.toLocaleString('fr-FR')} FCFA
          </Text>
        </View>

        {!showDeliveryOptions && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleAddToCart}
              disabled={addingToCart}
            >
              <Text style={styles.secondaryButtonText}>
                {addingToCart ? 'Ajout…' : 'Ajouter au panier'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleBuyPress}>
              <Text style={styles.primaryButtonText}>Acheter</Text>
            </TouchableOpacity>
          </View>
        )}

        {showDeliveryOptions && (
          <View style={[styles.card, styles.deliverySection]}>
            <Text style={styles.sectionTitle}>Mode de livraison</Text>
            {listing.is_heavy ? (
              <View style={styles.heavyDeliveryNotice}>
                <Ionicons name="cube-outline" size={20} color={colors.purple} />
                <Text style={styles.heavyDeliveryText}>
                  Cet article est volumineux ou lourd (véhicule, gros électroménager...). La
                  livraison n'est pas incluse dans le prix affiché — tu en discuteras
                  directement avec le vendeur dans la messagerie, une fois la commande passée.
                </Text>
              </View>
            ) : (
              VISIBLE_DELIVERY_OPTIONS.map((option) => {
                const active = deliveryMethod?.id === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.deliveryOption, active && styles.deliveryOptionActive]}
                    onPress={() => handleSelectDelivery(option)}
                  >
                    <View style={styles.radioOuter}>
                      {active && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.deliveryOptionLabel}>{option.label}</Text>
                    <Text style={styles.deliveryOptionPrice}>
                      {option.price.toLocaleString('fr-FR')} FCFA
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}

            {deliveryMethod && (
              <TouchableOpacity style={styles.payButton} onPress={handlePayNow}>
                <Text style={styles.payButtonText}>Payer maintenant</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 54,
    paddingBottom: 26,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2, },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  body: { padding: spacing.lg, paddingBottom: 40 },
  productCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.tintOrange,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  productTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  productPrice: { fontSize: 14, fontWeight: '700', color: colors.orange, marginTop: 4 },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  quantityLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  stepperButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { width: 32, textAlign: 'center', fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  subtotalLabel: { fontSize: 13, color: colors.textSecondary },
  subtotalValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  promoRow: { marginBottom: spacing.sm },
  promoInputRow: { flexDirection: 'row', gap: spacing.sm },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  promoApplyButton: {
    backgroundColor: colors.purple,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoApplyButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  promoApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  promoAppliedText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.success },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.orange, fontWeight: '700' },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.orange,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  deliverySection: { marginTop: spacing.xs },
  heavyDeliveryNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  heavyDeliveryText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  deliveryOptionActive: { borderColor: colors.orange, backgroundColor: colors.tintOrange },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange },
  deliveryOptionLabel: { flex: 1, fontSize: 13, color: colors.textPrimary },
  deliveryOptionPrice: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  payButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  payButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
