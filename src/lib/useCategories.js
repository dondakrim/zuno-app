// Catégories pilotées par le tableau de bord — src/lib/useCategories.js
// Usage dans l'accueil :  const categories = useCategories(categoriesParDefaut);
// Tant que la liste du tableau de bord est vide (ou injoignable), la liste intégrée est utilisée.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useCategories(fallback = []) {
  const [list, setList] = useState(fallback);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('app_categories')
        .select('label, parent, position')
        .order('position', { ascending: true });
      if (cancelled || error || !data) return;
      const mains = data.filter((c) => !c.parent).map((c) => c.label);
      if (mains.length > 0) setList(mains);
    })();
    return () => { cancelled = true; };
  }, []);
  return list;
}

// Variante avec icônes et sous-catégories : [{ label, icon, children: [{ label, icon }] }]
export function useCategoryTree() {
  const [tree, setTree] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('app_categories')
        .select('label, icon, parent, position')
        .order('position', { ascending: true });
      if (cancelled || error || !data) return;
      setTree(
        data.filter((c) => !c.parent).map((c) => ({
          label: c.label,
          icon: c.icon,
          children: data.filter((s) => s.parent === c.label).map((s) => ({ label: s.label, icon: s.icon })),
        }))
      );
    })();
    return () => { cancelled = true; };
  }, []);
  return tree;
}
