// Liste des pays actuellement disponibles sur Zuno, avec leur indicatif
// téléphonique. Réutilisée partout où un numéro est demandé (création de
// compte, profil, commande) pour que l'indicatif corresponde toujours au
// pays choisi par la personne, plutôt que de supposer le Niger par défaut.
export const COUNTRIES = [
  { code: 'NE', name: 'Niger', flag: '🇳🇪', dialCode: '+227' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', dialCode: '+223' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', dialCode: '+226' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', dialCode: '+229' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', dialCode: '+225' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', dialCode: '+228' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', dialCode: '+221' },
  { code: 'GW', name: 'Guinée-Bissau', flag: '🇬🇼', dialCode: '+245' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];
