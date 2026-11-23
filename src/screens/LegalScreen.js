// Textes légaux — src/screens/LegalScreen.js
// Utilisation : navigation.navigate('Legal', { kind: 'cgu' | 'confidentialite' | 'retour' | 'remboursement' | 'annulation' })
// ⚠️ Textes à faire relire par un juriste avant la publication sur les stores.
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import InfoHeader from '../components/InfoHeader';

const CONTACT = 'contact@zunomarket.store';
const UPDATED = 'Dernière mise à jour : novembre 2026';

const META = {
  cgu: { icon: 'document-text', tint: colors.tintPurple, fg: colors.purple, sub: 'Les règles pour acheter et vendre sur Zuno' },
  confidentialite: { icon: 'shield-checkmark', tint: colors.tintBlue, fg: colors.blue, sub: 'Comment tes données sont utilisées et protégées' },
  retour: { icon: 'return-up-back', tint: colors.tintOrange, fg: colors.orange, sub: 'Que faire si l’article ne convient pas' },
  remboursement: { icon: 'cash', tint: colors.tintOrange, fg: colors.orange, sub: 'Quand et comment tu es remboursé' },
  annulation: { icon: 'close-circle', tint: colors.tintRed, fg: colors.danger, sub: 'Annuler une commande ou une annonce' },
};

const DOCS = {
 "cgu": {
  "title": "Conditions générales",
  "intro": "Bienvenue sur Zuno Marketplace, la place de marché d'articles en Afrique de l'Ouest. En utilisant l'application, tu acceptes les conditions ci-dessous. Lis-les attentivement.",
  "blocks": [
   {
    "h": "1. Qui sommes-nous ?",
    "items": [
     {
      "p": "Zuno est une application qui met en relation des vendeurs et des acheteurs d'articles. Zuno fournit l'outil (annonces, messagerie, paiement protégé, suivi de commande). Zuno n'est pas le vendeur des articles publiés par les utilisateurs."
     }
    ]
   },
   {
    "h": "2. Accepter les conditions",
    "items": [
     {
      "p": "En créant un profil, en publiant une annonce ou en passant commande, tu confirmes avoir lu et accepté ces conditions ainsi que la Politique de confidentialité. Si tu n'es pas d'accord, n'utilise pas l'application."
     }
    ]
   },
   {
    "h": "3. Qui peut utiliser Zuno ?",
    "items": [
     {
      "p": "Tu dois avoir au moins 18 ans, ou avoir l'accord d'un parent ou tuteur légal. Tu t'engages à communiquer des informations exactes (prénom, nom, numéro de téléphone, pièce d’identité) et à les tenir à jour. Un seul compte par personne."
     }
    ]
   },
   {
    "h": "4. Ton compte",
    "items": [
     {
      "p": "Tu es responsable de l'usage de ton compte et de ton téléphone. Préviens-nous rapidement à contact@zunomarket.store si tu penses que quelqu'un d'autre s'en sert."
     }
    ]
   },
   {
    "h": "5. Publier une annonce",
    "items": [
     {
      "p": "Tu ne peux vendre que des articles qui t'appartiennent et que tu as le droit de vendre. Ton annonce doit contenir des photos réelles, un titre clair, une description honnête de l'état de l'article et un prix en devises autorisées dans ta zone. Tu es seul responsable de l'état et de la provenance de l'article. Chaque annonce peut être vérifiée avant d'apparaître, et retirée si elle ne respecte pas les règles."
     }
    ]
   },
   {
    "h": "6. Articles interdits",
    "items": [
     {
      "p": "Il est interdit de vendre : armes et munitions, drogues et produits illicites, médicaments sans autorisation, produits volés ou contrefaits, animaux protégés, documents officiels, contenus pour adultes, ou tout article dont la vente est interdite par la loi. Zuno peut supprimer toute annonce suspecte et suspendre le compte concerné."
     }
    ]
   },
   {
    "h": "7. Rester sur Zuno",
    "items": [
     {
      "p": "Pour ta sécurité, il est interdit d'échanger des numéros de téléphone, comptes WhatsApp, emails ou liens dans les annonces et la messagerie, et de chercher à conclure la vente en dehors de Zuno. Ces informations sont bloquées automatiquement. Les paiements faits en dehors de Zuno ne sont pas protégés et nous ne pouvons pas t'aider en cas de problème."
     }
    ]
   },
   {
    "h": "8. Commander et payer",
    "items": [
     {
      "p": "Pour acheter, tu passes commande depuis l'annonce ou ton panier et tu paies en devises autorisées via les moyens proposés (Mobile Money ou carte, par nos partenaires de paiement). Les prix sont fixés par les vendeurs. Les prix affichés dans une autre devise sont indicatifs : tu paies toujours en devises autorisées."
     }
    ]
   },
   {
    "h": "9. Paiement protégé",
    "items": [
     {
      "p": "Ton paiement est gardé par Zuno jusqu'à la livraison ou au retrait de l'article. Le vendeur n'est payé qu'après la confirmation. Si un problème est signalé à temps, le paiement reste bloqué le temps de l'examen."
     }
    ]
   },
   {
    "h": "10. Livraison et retrait",
    "items": [
     {
      "p": "Selon l'annonce, l'article est remis en main propre (retrait), livré dans la même ville ou expédié en région. Les délais sont donnés à titre indicatif. Pour les articles lourds ou volumineux, la livraison se négocie directement avec le vendeur dans la messagerie, après la commande."
     }
    ]
   },
   {
    "h": "11. Problème avec une commande",
    "items": [
     {
      "p": "Tu as 24 heures après la livraison pour signaler un problème depuis « Mes commandes ». Notre équipe examine la situation et peut décider d'un remboursement, d'un retour ou du maintien de la vente. Voir aussi les politiques de retour, de remboursement et d'annulation."
     }
    ]
   },
   {
    "h": "12. Frais",
    "items": [
     {
      "p": "Publier une annonce est gratuit. Des services optionnels (comme la mise en avant d'une annonce) peuvent être payants ; leur prix est toujours affiché avant que tu confirmes. Les frais éventuels sur les ventes ou les reversements sont indiqués avant ta validation."
     }
    ]
   },
   {
    "h": "13. Reversement aux vendeurs",
    "items": [
     {
      "p": "Le montant des ventes terminées s'ajoute à ton solde. Tu peux demander un reversement vers un moyen de paiement à ton nom. Zuno peut demander une vérification d'identité avant de verser, notamment pour prévenir la fraude."
     }
    ]
   },
   {
    "h": "14. Comportements interdits",
    "items": [
     {
      "p": "Il est interdit de : tromper ou arnaquer, créer un faux profil, harceler ou insulter, publier des contenus illégaux, contourner les protections de l'application, ou utiliser Zuno pour du blanchiment d'argent ou toute activité illégale."
     }
    ]
   },
   {
    "h": "15. Signalements et sanctions",
    "items": [
     {
      "p": "Tu peux signaler un utilisateur ou une annonce depuis l'application. En cas de non-respect de ces conditions, Zuno peut avertir, retirer du contenu, suspendre ou supprimer un compte, et bloquer les reversements en attente d'examen. Les cas graves peuvent être transmis aux autorités."
     }
    ]
   },
   {
    "h": "16. Contenu que tu publies",
    "items": [
     {
      "p": "Tu gardes tes droits sur tes photos et tes textes. En les publiant, tu donnes à Zuno l'autorisation de les afficher dans l'application et d'en faire la promotion (par exemple dans les articles en vedette). Tu garantis ne pas porter atteinte aux droits d'autrui."
     }
    ]
   },
   {
    "h": "17. Responsabilité",
    "items": [
     {
      "p": "Zuno met tout en œuvre pour que l'application fonctionne bien, sans garantir un service sans interruption. Zuno n'est pas responsable de la qualité, de la légalité ou de la conformité des articles vendus par les utilisateurs, ni des échanges conclus en dehors de l'application, dans la limite permise par la loi."
     }
    ]
   },
   {
    "h": "18. Modifier ces conditions",
    "items": [
     {
      "p": "Nous pouvons mettre à jour ces conditions. Si le changement est important, nous te préviendrons dans l'application. Continuer à utiliser Zuno après la mise à jour signifie que tu l'acceptes."
     }
    ]
   },
   {
    "h": "19. Supprimer ton compte",
    "items": [
     {
      "p": "Tu peux supprimer ton compte à tout moment depuis Moi → Paramètres. Les commandes en cours doivent être terminées avant. Certaines données peuvent être conservées le temps exigé par la loi."
     }
    ]
   },
   {
    "h": "20. Loi applicable et litiges",
    "items": [
     {
      "p": "Ces conditions sont régies par le droit OHADA et du commerce international. En cas de désaccord, contacte-nous d'abord à contact@zunomarket.store pour trouver une solution à l'amiable. À défaut, les tribunaux compétents seront saisis."
     }
    ]
   },
   {
    "h": "21. Nous contacter",
    "items": [
     {
      "p": "Une question ? Écris-nous à contact@zunomarket.store ou passe par Moi → Service clients."
     }
    ]
   }
  ]
 },
 "confidentialite": {
  "title": "Politique de confidentialité",
  "intro": "Ta vie privée compte pour nous. Cette page explique quelles données Zuno collecte, pourquoi, avec qui nous les partageons et quels sont tes droits.",
  "blocks": [
   {
    "h": "1. Qui est responsable ?",
    "items": [
     {
      "p": "Zuno est responsable du traitement de tes données. Pour toute question : contact@zunomarket.store."
     }
    ]
   },
   {
    "h": "2. Les données que nous collectons",
    "items": [
     {
      "b": "Ton profil : prénom, nom, numéro de téléphone, ville ou quartier, et, si tu les donnes, WhatsApp, email, nom de boutique et photo."
     },
     {
      "b": "Tes annonces : photos, titre, description, prix, ville."
     },
     {
      "b": "Tes commandes et paiements : articles, montants, statut, adresse ou informations de livraison, numéro de contact."
     },
     {
      "b": "Tes messages avec les autres utilisateurs."
     },
     {
      "b": "Ta pièce d'identité, seulement si tu demandes la vérification d'identité (compte marchand)."
     },
     {
      "b": "Des données techniques : identifiant de ton appareil dans Zuno, modèle de téléphone, système, ville approximative déduite de l'adresse IP, jeton de notification."
     }
    ]
   },
   {
    "h": "3. Pourquoi nous les utilisons",
    "items": [
     {
      "b": "Faire fonctionner l'application : compte, annonces, messagerie, commandes, livraison, paiement protégé, reversements."
     },
     {
      "b": "Te contacter à propos de tes commandes (notifications)."
     },
     {
      "b": "Protéger la communauté : modération, détection de fraude, filtrage des numéros et liens dans les messages."
     },
     {
      "b": "Améliorer Zuno : statistiques d'usage, recommandations d'articles selon tes centres d'intérêt."
     },
     {
      "b": "Respecter nos obligations légales."
     }
    ]
   },
   {
    "h": "4. Qui peut voir tes données ?",
    "items": [
     {
      "p": "Les autres utilisateurs voient ton nom ou le nom de ta boutique, ta ville, ta photo et tes annonces. Ton numéro de téléphone et ton email ne sont jamais affichés publiquement ni dans les messages. Le vendeur ou l'acheteur concerné reçoit seulement ce qui est nécessaire pour finaliser une commande (nom de contact et numéro de livraison)."
     }
    ]
   },
   {
    "h": "5. Nos prestataires",
    "items": [
     {
      "p": "Nous faisons appel à des prestataires pour faire fonctionner Zuno : hébergement et base de données (Supabase), notifications (Expo et Google Firebase), paiement (nos partenaires de paiement). Ils ne peuvent utiliser tes données que pour nous fournir leur service. Nous ne vendons jamais tes données."
     }
    ]
   },
   {
    "h": "6. Transferts hors du pays",
    "items": [
     {
      "p": "Certains prestataires peuvent stocker ou traiter des données hors de ton pays. Nous veillons à ce qu'elles restent protégées par des garanties adaptées."
     }
    ]
   },
   {
    "h": "7. Combien de temps ?",
    "items": [
     {
      "p": "Nous gardons tes données tant que ton compte existe, puis le temps nécessaire pour respecter la loi (par exemple pour les paiements) ou régler un litige. Les messages et annonces sont supprimés avec ton compte, sauf obligation légale."
     }
    ]
   },
   {
    "h": "8. Tes droits",
    "items": [
     {
      "p": "Tu peux à tout moment : consulter et corriger tes informations (Moi → Mon profil), supprimer ton compte (Moi → Paramètres), refuser les notifications (réglages de ton téléphone), et nous demander l'accès, la rectification ou la suppression de tes données à contact@zunomarket.store. Nous répondons dans un délai raisonnable."
     }
    ]
   },
   {
    "h": "9. Sécurité",
    "items": [
     {
      "p": "Nous protégeons tes données avec des moyens techniques adaptés (connexions chiffrées, accès restreints). Aucun système n'est parfait : ne partage jamais tes codes ou mots de passe, et signale tout comportement suspect."
     }
    ]
   },
   {
    "h": "10. Mineurs",
    "items": [
     {
      "p": "Zuno n'est pas destiné aux moins de 18 ans sans l'accord d'un parent ou tuteur légal."
     }
    ]
   },
   {
    "h": "11. Permissions de ton téléphone",
    "items": [
     {
      "b": "Photos : pour ajouter des images à tes annonces, ton profil ou ta vérification d'identité."
     },
     {
      "b": "Notifications : pour t'informer de tes commandes et messages."
     },
     {
      "p": "Tu peux retirer ces permissions dans les réglages de ton téléphone."
     }
    ]
   },
   {
    "h": "12. Mises à jour",
    "items": [
     {
      "p": "Si cette politique change de façon importante, nous te le dirons dans l'application."
     }
    ]
   },
   {
    "h": "13. Nous contacter",
    "items": [
     {
      "p": "Pour toute question ou demande sur tes données : contact@zunomarket.store."
     }
    ]
   }
  ]
 },
 "retour": {
  "title": "Politique de retour",
  "intro": "",
  "blocks": [
   {
    "h": "Principe",
    "items": [
     {
      "p": "Zuno est une place de marché en ligne. Chaque article est décrit par son vendeur. Si l'article reçu ne correspond pas à l'annonce, tu peux demander un retour."
     }
    ]
   },
   {
    "h": "Délai",
    "items": [
     {
      "p": "Tu as 24 heures après la livraison (ou le retrait) pour signaler un problème depuis ta commande (« Signaler un problème »). Passé ce délai, la commande est considérée comme conforme."
     }
    ]
   },
   {
    "h": "Cas acceptés",
    "items": [
     {
      "b": "Article non conforme à la description ou aux photos"
     },
     {
      "b": "Article endommagé, non signalé dans l'annonce"
     },
     {
      "b": "Article manquant ou différent de celui commandé"
     },
     {
      "b": "Article jamais reçu"
     }
    ]
   },
   {
    "h": "Cas non acceptés",
    "items": [
     {
      "b": "Simple changement d'avis"
     },
     {
      "b": "Défaut déjà indiqué dans l'annonce"
     },
     {
      "b": "Article utilisé, modifié ou abîmé après la livraison"
     },
     {
      "b": "Signalement fait après le délai de 24 heures"
     }
    ]
   },
   {
    "h": "Déroulement",
    "items": [
     {
      "n": "1. Ouvre ta commande et appuie sur « Signaler un problème »."
     },
     {
      "n": "2. Choisis la raison et ajoute des explications et des photos si possible."
     },
     {
      "n": "3. Notre équipe examine ta demande et le vendeur est prévenu. Le paiement reste bloqué pendant l'examen."
     },
     {
      "n": "4. Nous te donnons la décision. En cas d'accord, l'article est renvoyé au vendeur puis tu es remboursé."
     }
    ]
   },
   {
    "h": "Frais de retour",
    "items": [
     {
      "p": "Si l'erreur vient du vendeur (article non conforme, endommagé, manquant), les frais de retour sont à sa charge. Dans les autres cas, ils peuvent être à ta charge."
     }
    ]
   },
   {
    "h": "Retrait en main propre",
    "items": [
     {
      "p": "Vérifie l'article au moment du retrait. Si tu le prends, tu confirmes qu'il te convient ; les problèmes cachés restent signalables dans le délai de 24 heures."
     }
    ]
   }
  ]
 },
 "remboursement": {
  "title": "Politique de remboursement",
  "intro": "",
  "blocks": [
   {
    "h": "Paiement protégé",
    "items": [
     {
      "p": "Ton paiement est gardé par Zuno jusqu'à la confirmation de livraison ou de retrait. Le vendeur n'est pas payé avant."
     }
    ]
   },
   {
    "h": "Quand es-tu remboursé ?",
    "items": [
     {
      "b": "Ta commande est annulée avant traitement"
     },
     {
      "b": "Le vendeur annule la commande"
     },
     {
      "b": "L'article n'est jamais livré"
     },
     {
      "b": "Un litige est tranché en ta faveur (article non conforme, endommagé ou manquant)"
     }
    ]
   },
   {
    "h": "Quand n'es-tu pas remboursé ?",
    "items": [
     {
      "b": "Changement d'avis"
     },
     {
      "b": "Défaut déjà indiqué dans l'annonce"
     },
     {
      "b": "Signalement fait après 24 heures"
     },
     {
      "b": "Paiement fait en dehors de Zuno"
     }
    ]
   },
   {
    "h": "Montant remboursé",
    "items": [
     {
      "p": "Le remboursement porte sur le prix de l'article. Les frais de livraison sont remboursés si la faute vient du vendeur ou de la livraison. Les services optionnels déjà consommés (comme la mise en avant d'une annonce) ne sont pas remboursables."
     }
    ]
   },
   {
    "h": "Moyen de remboursement",
    "items": [
     {
      "p": "Le remboursement est envoyé sur le moyen de paiement que tu as utilisé (Mobile Money ou carte)."
     }
    ]
   },
   {
    "h": "Délai",
    "items": [
     {
      "p": "Une fois la décision prise, nous lançons le remboursement rapidement. Le délai d'arrivée exact dépend de ton opérateur Mobile Money ou de ta banque, en général de quelques heures à quelques jours ouvrés."
     }
    ]
   },
   {
    "h": "Un souci ?",
    "items": [
     {
      "p": "Si tu n'as rien reçu après ce délai, écris-nous à contact@zunomarket.store avec ta commande et la preuve de paiement."
     }
    ]
   }
  ]
 },
 "annulation": {
  "title": "Politique d’annulation",
  "intro": "",
  "blocks": [
   {
    "h": "Annuler en tant qu’acheteur",
    "items": [
     {
      "p": "Tu peux annuler ta commande tant que le vendeur ne l'a pas commencée (statut « À traiter »). Appuie sur « Annuler » dans Mes commandes : tu es remboursé intégralement."
     }
    ]
   },
   {
    "h": "Après le début du traitement",
    "items": [
     {
      "p": "Une fois la commande en préparation ou en livraison, l'annulation n'est plus possible. Si l'article pose problème, tu peux le signaler dans les 24 heures après la livraison."
     }
    ]
   },
   {
    "h": "Annulation par le vendeur",
    "items": [
     {
      "p": "Un vendeur peut annuler s'il ne peut plus fournir l'article. Tu es alors remboursé et prévenu par notification."
     }
    ]
   },
   {
    "h": "Annulations répétées",
    "items": [
     {
      "p": "Des annulations abusives ou répétées (acheteur comme vendeur) peuvent entraîner un avertissement, puis une restriction du compte."
     }
    ]
   },
   {
    "h": "Retrait ou livraison manquée",
    "items": [
     {
      "p": "Si tu ne te présentes pas au retrait ou ne réponds pas au livreur malgré plusieurs tentatives, la commande peut être annulée par le vendeur. Dans ce cas, des frais peuvent être retenus selon la situation."
     }
    ]
   },
   {
    "h": "Annuler une annonce",
    "items": [
     {
      "p": "Tu peux retirer ton annonce à tout moment. Si une commande est déjà en cours, elle doit d'abord être terminée ou annulée selon les règles ci-dessus."
     }
    ]
   }
  ]
 }
};

function Section({ block, index, open, onToggle, numbered }) {
  const m = block.h.match(/^(\d+)\.\s*(.*)$/);
  const num = m ? m[1] : null;
  const title = m ? m[2] : block.h;
  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.7} onPress={onToggle} style={styles.cardHead}>
        <View style={[styles.badge, !num && styles.badgeDot]}>
          {num ? <Text style={styles.badgeText}>{num}</Text> : <Ionicons name="bookmark" size={13} color={colors.purple} />}
        </View>
        <Text style={styles.h}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.cardBody}>
          {block.items.map((it, i) => {
            if (it.b) {
              return (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.dot} />
                  <Text style={[styles.t, { flex: 1 }]}>{it.b}</Text>
                </View>
              );
            }
            if (it.n) {
              const mm = it.n.match(/^(\d+)\.\s*(.*)$/);
              return (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>{mm ? mm[1] : '•'}</Text></View>
                  <Text style={[styles.t, { flex: 1 }]}>{mm ? mm[2] : it.n}</Text>
                </View>
              );
            }
            return <Text key={i} style={[styles.t, i > 0 && { marginTop: 8 }]}>{it.p}</Text>;
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function LegalScreen({ navigation, route }) {
  const kind = DOCS[route?.params?.kind] ? route.params.kind : 'cgu';
  const doc = DOCS[kind];
  const meta = META[kind] || META.cgu;
  const long = doc.blocks.length > 8;
  // Documents courts : tout ouvert. Documents longs : fermés, on ouvre ce qu'on veut.
  const [openSet, setOpenSet] = useState(() => new Set(long ? [] : doc.blocks.map((_, i) => i)));
  const allOpen = openSet.size === doc.blocks.length;

  const animate = () => { try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch (e) {} };
  const toggle = (i) => {
    animate();
    setOpenSet((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };
  const toggleAll = () => {
    animate();
    setOpenSet(allOpen ? new Set() : new Set(doc.blocks.map((_, i) => i)));
  };

  return (
    <View style={styles.container}>
      <InfoHeader title={doc.title} navigation={navigation} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: meta.tint }]}>
            <Ionicons name={meta.icon} size={26} color={meta.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{doc.title}</Text>
            <Text style={styles.heroSub}>{meta.sub}</Text>
          </View>
        </View>

        {doc.intro ? <Text style={styles.intro}>{doc.intro}</Text> : null}

        {long ? (
          <TouchableOpacity onPress={toggleAll} style={styles.toggleAll} activeOpacity={0.7}>
            <Ionicons name={allOpen ? 'contract-outline' : 'expand-outline'} size={15} color={colors.purple} />
            <Text style={styles.toggleAllText}>{allOpen ? 'Tout replier' : 'Tout déplier'}</Text>
          </TouchableOpacity>
        ) : null}

        {doc.blocks.map((b, i) => (
          <Section key={b.h} block={b} index={i} open={openSet.has(i)} onToggle={() => toggle(i)} />
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Une question ?</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:' + CONTACT).catch(() => {})}>
            <Text style={styles.contact}>{CONTACT}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>{UPDATED}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md, marginBottom: spacing.md },
  heroIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  heroSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  intro: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.md },
  toggleAll: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 5, marginBottom: spacing.sm, paddingVertical: 4 },
  toggleAllText: { fontSize: 12, fontWeight: '700', color: colors.purple },
  card: { backgroundColor: colors.surface, borderRadius: 18, marginBottom: 10, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md },
  badge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.tintPurple, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { borderRadius: 9 },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.purple },
  h: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: 0 },
  t: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange, marginTop: 7 },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 11, fontWeight: '800', color: colors.white },
  footer: { alignItems: 'center', marginTop: spacing.md },
  footerLabel: { fontSize: 12, color: colors.textMuted },
  contact: { fontSize: 13, fontWeight: '700', color: colors.orange, marginTop: 2 },
  note: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
});
