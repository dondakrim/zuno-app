import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panier</Text>
        <View style={{ width: 22 }} />
      </View>

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
          <View style={styles.deliverySection}>
            <Text style={styles.sectionTitle}>Mode de livraison</Text>
            {DELIVERY_OPTIONS.map((option) => {
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
            })}

            {deliveryMethod && (
              <TouchableOpacity style={styles.payButton} onPress={handlePayNow}>
                <Text style={styles.payButtonText}>Payer maintenant</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
  body: { padding: spacing.lg },
  productCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
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
    marginBottom: spacing.md,
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
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.lg,
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
    height: 42,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '600' },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '600' },
  deliverySection: { marginTop: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  deliveryOptionActive: { borderColor: colors.orange, borderWidth: 2 },
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
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  payButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
