// Données de démonstration. Une fois Supabase branché, HomeScreen
// lira les vraies annonces depuis la table `listings` à la place.
export const mockListings = [
  {
    id: '1',
    title: 'Veste en jean',
    price: 4000,
    city: 'Niamey',
    category: 'Mode et vêtements',
    condition: 'Bon état',
    description: "Veste en jean taille M, portée quelques fois, aucune tache.",
    seller: { name: 'Aïcha Idé', rating: 4.8, sales: 23, initials: 'AI' },
  },
  {
    id: '2',
    title: 'Téléphone Samsung A14',
    price: 45000,
    city: 'Niamey',
    category: 'Électronique et téléphones',
    condition: 'Bon état',
    description: 'Téléphone utilisé 8 mois, écran sans rayure, batterie à 90 %.',
    seller: { name: 'Aïcha Idé', rating: 4.8, sales: 23, initials: 'AI' },
  },
  {
    id: '3',
    title: 'Table basse en bois',
    price: 12000,
    city: 'Niamey',
    category: 'Maison et électroménager',
    condition: 'Usé',
    description: "Table basse solide, quelques marques d'usage sur le dessus.",
    seller: { name: 'Moussa Ibrahim', rating: 4.6, sales: 11, initials: 'MI' },
  },
];

export const categories = [
  'Mode et vêtements',
  'Électronique et téléphones',
  'Maison et électroménager',
  'Véhicules et pièces',
  'Autres',
];
