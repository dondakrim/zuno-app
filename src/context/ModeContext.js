import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'zuno_user_mode';

const ModeContext = createContext({
  mode: 'visiteur',
  loading: true,
  switchMode: () => {},
});

export function ModeProvider({ children }) {
  const [mode, setMode] = useState('visiteur');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'marchand' || value === 'visiteur') {
          setMode(value);
        }
      })
      .catch((e) => {
        console.log('Erreur lecture du mode, on continue avec la valeur par défaut :', e.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const switchMode = async (next) => {
    setMode(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ModeContext.Provider value={{ mode, loading, switchMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
