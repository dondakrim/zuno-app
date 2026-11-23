import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  AppState,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceUser';
import PhoneInput from '../components/PhoneInput';
import GradientHeader from '../components/GradientHeader';
import { CASH_METHOD, MOBILE_METHODS, methodLabel } from '../lib/paymentMethods';

const CRENEAUX = ['Matin (8h-12h)', 'Après-midi (12h-16h)', 'Soir (16h-19h)'];

const TERMS_TEXT = `1. Achat définitif
Une fois la commande validée et la livraison lancée, l'achat est considéré comme définitif. Zuno ne propose pas de remboursement automatique.

2. Rôle de Zuno
Zuno agit uniquement comme plateforme de mise en relation entre acheteurs et vendeurs. Chaque vendeur reste seul responsable de l'article vendu, de son état et de sa description.

3. Remboursement par accord commun
Un remboursement ou un échange reste possible si l'acheteur et le vendeur trouvent un accord commun (article non conforme, non reçu, etc.). Cette démarche se négocie directement entre les deux parties, par exemple via la messagerie intégrée à l'application.

4. Acceptation
En cochant la case "J'ai lu et j'accepte les conditions", l'acheteur reconnaît avoir pris connaissance de ces conditions et les accepte pour cette commande.`;

export default function CheckoutScreen({ route, navigation }) {
  const { listing, quantity = 1, deliveryMethod, promoCode = null, promoDiscount = 0 } = route.params;
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [quartier, setQuartier] = useState('');
  const [heureLivraison, setHeureLivraison] = useState(CRENEAUX[0]);
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  // Commande dont le paiement NITA est en cours (page de paiement ouverte).
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [verifying, setVerifying] = useState(false);
  // Étapes : 'info' (livraison) -> 'pay' (Je paye par) -> 'recap' (récapitulatif)
  const [step, setStep] = useState('info');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [method, setMethod] = useState(null); // { kind: 'cash' } | { kind: 'mobile', id }
  const [payerAccount, setPayerAccount] = useState('');

  const sousTotal = listing.price * quantity;
  const fraisLivraison = deliveryMethod?.price || 0;
  const total = Math.max(sousTotal + fraisLivraison - promoDiscount, 0);

  const isPickup = deliveryMethod?.id === 'pickup';
  const isNegotiated = deliveryMethod?.id === 'a_negocier';
  const skipAddress = isPickup || isNegotiated;

  const goToChat = () =>
    listing.vendeur_id
      ? navigation.replace('Chat', {
          listingId: listing.id,
          listingTitle: listing.title,
          otherUserId: listing.vendeur_id,
        })
      : navigation.popToTop();

  const showSavedAlert = () =>
    Alert.alert(
      'Commande enregistrée',
      isPickup
        ? "Direction la messagerie pour te mettre d'accord avec le vendeur sur le lieu et l'heure."
        : 'Direction la messagerie pour suivre la suite avec le vendeur.',
      [{ text: 'OK', onPress: goToChat }]
    );

  // Demande au serveur si NITA a bien reçu le paiement.
  const verifyPayment = async (manual = false) => {
    if (!pendingOrderId || verifying) return;
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke('check-payment', {
      body: { orderId: pendingOrderId },
    });
    setVerifying(false);
    if (!error && data?.paid) {
      setPendingOrderId(null);
      Alert.alert('Paiement confirmé ✅', 'Ton paiement a bien été reçu. Direction la messagerie avec le vendeur.', [
        { text: 'OK', onPress: goToChat },
      ]);
    } else if (manual) {
      Alert.alert(
        'Paiement non confirmé',
        "Nous n'avons pas encore reçu ton paiement. Si tu viens de payer, patiente quelques secondes puis réessaie."
      );
    }
  };

  // Quand l'acheteur revient dans l'app après la page de paiement, on vérifie tout seul.
  const verifyRef = useRef(verifyPayment);
  verifyRef.current = verifyPayment;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') verifyRef.current(false);
    });
    return () => sub.remove();
  }, []);

  // Bouton retour du téléphone : revient à l'étape précédente.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'recap') { setStep('pay'); return true; }
      if (step === 'pay') { setStep('info'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  const goBackStep = () => {
    if (step === 'recap') setStep('pay');
    else if (step === 'pay') setStep('info');
    else navigation.goBack();
  };

  const validateInfo = () => {
    if (!nom.trim() || telephone.replace(/\D/g, '').length < 7 || (!skipAddress && !quartier.trim())) {
      Alert.alert(
        'Informations manquantes',
        skipAddress ? 'Nom et numéro de téléphone sont obligatoires.' : 'Nom, numéro de téléphone et quartier sont obligatoires.'
      );
      return false;
    }
    if (!accepted) {
      Alert.alert('Conditions', "Merci d'accepter les conditions avant de continuer.");
      return false;
    }
    return true;
  };

  const goToPayment = () => {
    if (validateInfo()) setStep('pay');
  };

  const chooseMethod = (m) => {
    setMethod(m);
    setStep('recap');
  };

  const payLater = () => {
    setPendingOrderId(null);
    showSavedAlert();
  };

  const handleConfirm = async () => {
    if (!validateInfo()) { setStep('info'); return; }
    if (!method) { setStep('pay'); return; }
    const isMobile = method.kind === 'mobile';
    if (isMobile && payerAccount.replace(/\D/g, '').length < 8) {
      Alert.alert('Compte manquant', `Indique le numéro de ton compte ${methodLabel(method)}.`);
      return;
    }

    setSaving(true);
    const myId = await getDeviceUserId();

    // Le code promo n'a été que prévisualisé jusqu'ici (dans le panier) :
    // on le valide et le consomme réellement seulement maintenant, au
    // moment où la commande est vraiment passée.
    let finalDiscount = 0;
    if (promoCode) {
      const { data: rpcDiscount, error: promoError } = await supabase.rpc('use_promo_code', {
        p_code: promoCode,
        p_amount: sousTotal + fraisLivraison,
      });
      if (promoError) {
        setSaving(false);
        Alert.alert(
          'Code promo invalide',
          "Ce code n'est plus disponible (peut-être déjà utilisé son maximum de fois). La commande sera passée sans réduction."
        );
      } else {
        finalDiscount = rpcDiscount || 0;
      }
    }
    const finalTotal = Math.max(sousTotal + fraisLivraison - finalDiscount, 0);

    // Le vrai paiement MyNITA se branchera ici plus tard. Pour l'instant,
    // la commande est créée directement pour pouvoir tester tout le
    // parcours de livraison sans attendre l'accès à l'API MyNITA.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        listing_id: listing.id,
        acheteur_id: myId,
        montant: finalTotal,
        quantite: quantity,
        frais_livraison: fraisLivraison,
        mode_livraison: deliveryMethod?.id || null,
        promo_code: promoCode,
        discount_amount: finalDiscount,
        statut: method.kind === 'cash' ? 'a_traiter' : 'en_attente_paiement',
        payment_provider: method.kind === 'cash' ? 'cash' : null,
        payer_account: isMobile ? payerAccount.trim() : null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Erreur création commande:', orderError);
      setSaving(false);
      Alert.alert('Erreur', `Détail technique : ${orderError.message}`);
      return;
    }

    const { error: deliveryError } = await supabase.from('deliveries').insert({
      order_id: order.id,
      adresse: isPickup ? 'Retrait en main propre' : isNegotiated ? 'À négocier avec le vendeur' : quartier.trim(),
      quartier: skipAddress ? null : quartier.trim(),
      nom_contact: nom.trim(),
      telephone_contact: telephone.trim(),
      heure_livraison: skipAddress ? 'À convenir avec le vendeur' : heureLivraison,
      statut_livraison: 'a_traiter',
    });

    setSaving(false);

    if (deliveryError) {
      console.error('Erreur création livraison:', deliveryError);
      Alert.alert('Erreur', `Détail technique : ${deliveryError.message}`);
      return;
    }

    // L'article n'est plus disponible pour d'autres acheteurs une fois
    // qu'une commande a été passée dessus.
    await supabase.from('listings').update({ status: 'vendu' }).eq('id', listing.id);

    // Un premier message est envoyé automatiquement au vendeur, pour que la
    // conversation démarre avec tout le contexte de la commande déjà dedans.
    const recap = isNegotiated
      ? `Bonjour, je viens de commander « ${listing.title} » (x${quantity}). Cet article étant volumineux/lourd, peux-tu me proposer un mode et un prix de livraison, ou convenir d'un lieu de retrait ?`
      : isPickup
      ? `Bonjour, je viens de commander « ${listing.title} » (x${quantity}) en retrait en main propre. On se met d'accord sur le lieu et l'heure ?`
      : `Bonjour, je viens de commander « ${listing.title} » (x${quantity}). Livraison : ${deliveryMethod?.label}, quartier ${quartier.trim()}, créneau ${heureLivraison}.`;

    if (listing.vendeur_id) {
      await supabase.from('messages').insert({
        listing_id: listing.id,
        expediteur_id: myId,
        destinataire_id: listing.vendeur_id,
        contenu: recap + (method.kind === 'cash' ? ' Paiement en espèces à la réception.' : ` Paiement par ${methodLabel(method)}.`),
      });
    }

    // Espèces : rien à payer en ligne, la commande est enregistrée.
    if (method.kind === 'cash') {
      Alert.alert(
        'Commande enregistrée',
        "Tu paieras en espèces à la réception. Direction la messagerie pour suivre la suite avec le vendeur.",
        [{ text: 'OK', onPress: goToChat }]
      );
      return;
    }

    // Paiement mobile (MyNITA) : une demande de paiement est créée ; l'acheteur
    // la valide dans son appli MyNITA, rubrique « Achat en ligne ».
    const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
      'create-payment',
      { body: { orderId: order.id } }
    );

    if (paymentError || (!paymentData?.codeAchat && !paymentData?.alreadyPaid)) {
      console.error('Erreur création paiement:', paymentError, paymentData);
      Alert.alert(
        'Paiement indisponible',
        "Impossible de lancer la demande de paiement pour l'instant. La commande est bien enregistrée, réessaie le paiement depuis Mes commandes."
      );
      showSavedAlert();
      return;
    }

    setPendingOrderId(order.id);
  };

  if (step === 'pay') {
    return (
      <View style={styles.container}>
        <GradientHeader style={styles.header}>
          <TouchableOpacity onPress={goBackStep} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.heading}>Je paye par</Text>
          <View style={{ width: 36 }} />
        </GradientHeader>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <Text style={styles.payTotal}>Total à payer : {total.toLocaleString('fr-FR')} FCFA</Text>

          <TouchableOpacity style={styles.methodCard} onPress={() => chooseMethod({ kind: 'cash' })} activeOpacity={0.85}>
            <View style={styles.methodIcon}><Ionicons name="cash-outline" size={22} color={colors.orange} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>{CASH_METHOD.label}</Text>
              <Text style={styles.methodHint}>{CASH_METHOD.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.methodCard} onPress={() => setMobileOpen((v) => !v)} activeOpacity={0.85}>
            <View style={styles.methodIcon}><Ionicons name="phone-portrait-outline" size={22} color={colors.orange} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>Paiements mobiles</Text>
              <Text style={styles.methodHint}>Choisis ton service de paiement</Text>
            </View>
            <Ionicons name={mobileOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {mobileOpen &&
            MOBILE_METHODS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.subMethod, !m.enabled && styles.subMethodOff]}
                disabled={!m.enabled}
                onPress={() => chooseMethod({ kind: 'mobile', id: m.id })}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>{m.label}</Text>
                  <Text style={styles.methodHint}>{m.hint}</Text>
                </View>
                {m.enabled ? (
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                ) : (
                  <View style={styles.soonTag}><Text style={styles.soonTagText}>Bientôt</Text></View>
                )}
              </TouchableOpacity>
            ))}
        </ScrollView>
      </View>
    );
  }

  if (step === 'recap') {
    const isMobile = method?.kind === 'mobile';
    const mobileCfg = isMobile ? MOBILE_METHODS.find((m) => m.id === method.id) : null;
    return (
      <View style={styles.container}>
        <GradientHeader style={styles.header}>
          <TouchableOpacity onPress={goBackStep} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.heading}>Récapitulatif</Text>
          <View style={{ width: 36 }} />
        </GradientHeader>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {listing.title} × {quantity}
          </Text>
          <Text style={styles.summaryValue}>{sousTotal.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {isPickup ? 'Retrait en main propre' : isNegotiated ? 'Livraison à négocier' : `Livraison (${deliveryMethod?.label})`}
          </Text>
          <Text style={styles.summaryValue}>{fraisLivraison.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        {promoDiscount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Code « {promoCode} »</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              -{promoDiscount.toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total.toLocaleString('fr-FR')} FCFA</Text>
        </View>
      </View>

          <View style={styles.card}>
            <Text style={styles.recapTitle}>Livraison</Text>
            <Text style={styles.recapLine}>{nom.trim()} · {telephone.trim()}</Text>
            <Text style={styles.recapLine}>
              {isPickup ? 'Retrait en main propre' : isNegotiated ? 'Livraison à négocier avec le vendeur' : `${quartier.trim()} · ${heureLivraison}`}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.recapTitle}>{isMobile ? `Votre compte ${methodLabel(method)}` : 'Paiement'}</Text>
            {isMobile ? (
              <>
                <Text style={styles.label}>{mobileCfg?.accountLabel || 'Numéro de ton compte'}</Text>
                <TextInput
                  placeholder="Ex : 96 29 58 58"
                  placeholderTextColor={colors.textMuted}
                  value={payerAccount}
                  onChangeText={setPayerAccount}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                <Text style={styles.methodHint}>
                  Tu recevras la demande de paiement dans {methodLabel(method)}, rubrique « Achat en ligne ».
                </Text>
              </>
            ) : (
              <Text style={styles.recapLine}>Espèces, à la réception de l'article.</Text>
            )}
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Lancer la commande</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      <Modal visible={!!pendingOrderId} transparent animationType="fade" onRequestClose={payLater}>
        <View style={styles.payOverlay}>
          <View style={styles.payCard}>
            <Text style={styles.payTitle}>Paiement en cours</Text>
            <Text style={styles.payText}>
              Ouvre ton appli MyNITA, va dans « Achat en ligne » et valide le paiement de {total.toLocaleString('fr-FR')} FCFA. Puis reviens ici : nous vérifions automatiquement.
            </Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => verifyPayment(true)}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.confirmButtonText}>J'ai payé, vérifier</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={payLater} style={{ marginTop: spacing.md, alignItems: 'center' }}>
              <Text style={styles.linkText}>Payer plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
    <GradientHeader style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={20} color={colors.white} />
      </TouchableOpacity>
      <Text style={styles.heading}>Informations de livraison</Text>
      <View style={{ width: 36 }} />
    </GradientHeader>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
      <View style={styles.card}>
      <Text style={styles.label}>Nom complet</Text>
      <TextInput
        placeholder="Ton nom"
        placeholderTextColor={colors.textMuted}
        value={nom}
        onChangeText={setNom}
        style={styles.input}
      />

      <Text style={styles.label}>Numéro à contacter</Text>
      <PhoneInput value={telephone} onChangeValue={setTelephone} />

      {skipAddress ? (
        <View style={styles.pickupNote}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.purple} />
          <Text style={styles.pickupNoteText}>
            {isNegotiated
              ? "Pas d'adresse à donner ici : une fois la commande validée, discute avec le vendeur du mode et du prix de livraison via la messagerie."
              : "Pas d'adresse à donner : une fois la commande validée, mets-toi d'accord avec le vendeur sur le lieu et l'heure du retrait via la messagerie."}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Quartier</Text>
          <TextInput
            placeholder="Ex: Plateau, Niamey"
            placeholderTextColor={colors.textMuted}
            value={quartier}
            onChangeText={setQuartier}
            style={styles.input}
          />

          <Text style={styles.label}>Heure de livraison souhaitée</Text>
          <View style={styles.pillRow}>
            {CRENEAUX.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setHeureLivraison(c)}
                style={[styles.pill, heureLivraison === c && styles.pillActive]}
              >
                <Text style={[styles.pillText, heureLivraison === c && styles.pillTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {listing.title} × {quantity}
          </Text>
          <Text style={styles.summaryValue}>{sousTotal.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {isPickup ? 'Retrait en main propre' : isNegotiated ? 'Livraison à négocier' : `Livraison (${deliveryMethod?.label})`}
          </Text>
          <Text style={styles.summaryValue}>{fraisLivraison.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        {promoDiscount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Code « {promoCode} »</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              -{promoDiscount.toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total.toLocaleString('fr-FR')} FCFA</Text>
        </View>
      </View>

      <View style={styles.checkboxRow}>
        <TouchableOpacity onPress={() => setAccepted((v) => !v)}>
          <Ionicons
            name={accepted ? 'checkbox' : 'square-outline'}
            size={20}
            color={accepted ? colors.orange : colors.textMuted}
          />
        </TouchableOpacity>
        <Text style={styles.checkboxText}>
          J'ai lu et j'accepte les{' '}
          <Text style={styles.linkText} onPress={() => setShowTerms(true)}>
            conditions
          </Text>
        </Text>
      </View>

      <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Conditions de vente</Text>
            <TouchableOpacity onPress={() => setShowTerms(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={styles.termsText}>{TERMS_TEXT}</Text>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                setAccepted(true);
                setShowTerms(false);
              }}
            >
              <Text style={styles.confirmButtonText}>J'ai lu, j'accepte</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      <TouchableOpacity
        style={[styles.confirmButton, !accepted && styles.confirmButtonDisabled]}
        onPress={goToPayment}
      >
        <Text style={styles.confirmButtonText}>Valider mon panier</Text>
      </TouchableOpacity>
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
  heading: { fontSize: 17, fontWeight: '800', color: colors.white },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2, },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 46,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  pillText: { fontSize: 12, color: colors.textPrimary },
  pillTextActive: { color: colors.white, fontWeight: '600' },
  pickupNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  pickupNoteText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: { fontSize: 13, color: colors.textSecondary, flex: 1, marginRight: spacing.sm },
  summaryValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  totalValue: { fontSize: 16, fontWeight: '700', color: colors.orange },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  checkboxText: { fontSize: 13, color: colors.textPrimary, flex: 1 },
  linkText: { color: colors.orange, fontWeight: '700', textDecorationLine: 'underline' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  termsText: { fontSize: 13, color: colors.textSecondary, lineHeight: 22 },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  confirmButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  confirmButtonDisabled: { opacity: 0.5 },
  payOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  payCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  payTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  payText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.lg },
  confirmButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  payTotal: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  methodIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.tintOrange, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  methodHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  subMethod: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm, marginLeft: spacing.lg,
  },
  subMethodOff: { opacity: 0.55 },
  soonTag: { backgroundColor: colors.tintOrange, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  soonTagText: { fontSize: 11, fontWeight: '700', color: colors.orange },
  recapTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xs },
  recapLine: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
});
