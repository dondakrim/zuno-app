// Point d'entrée : on lit le thème choisi AVANT de charger le reste de l'app,
// pour que tous les écrans soient créés directement avec les bonnes couleurs.
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme } from './src/theme/colors';

export default function App() {
  const [Main, setMain] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('zuno_theme')
      .then((value) => applyTheme(value === 'dark' ? 'dark' : 'light'))
      .catch(() => {})
      .finally(() => {
        // require ici (et non en haut du fichier) : l'app se charge APRÈS le thème.
        setMain(() => require('./AppMain').default);
      });
  }, []);

  if (!Main) return <View style={{ flex: 1, backgroundColor: '#2E0B8C' }} />;
  return <Main />;
}
