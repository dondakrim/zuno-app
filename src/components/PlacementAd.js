import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius } from '../theme/colors';

// Affiche la première pub active créée dans le dashboard pour cet emplacement
// (ex. placement="marchand"). Ne montre rien s'il n'y en a pas.
export default function PlacementAd({ placement, style }) {
  const [ad, setAd] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('ads')
        .select('*')
        .eq('active', true)
        .eq('placement', placement)
        .order('position', { ascending: true })
        .limit(1);
      if (alive && data && data.length) setAd(data[0]);
    })();
    return () => { alive = false; };
  }, [placement]);

  if (!ad) return null;

  const open = () => {
    if (ad.link_url) Linking.openURL(ad.link_url).catch(() => {});
  };

  return (
    <TouchableOpacity activeOpacity={ad.link_url ? 0.85 : 1} onPress={open} style={[styles.box, { backgroundColor: ad.color || colors.purple }, style]}>
      {ad.image_url ? <Image source={{ uri: ad.image_url }} style={styles.img} resizeMode="cover" /> : null}
      {(ad.title || ad.subtitle) && !ad.image_url ? (
        <View style={styles.txt}>
          {ad.title ? <Text style={styles.title}>{ad.title}</Text> : null}
          {ad.subtitle ? <Text style={styles.sub}>{ad.subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={styles.tag}><Text style={styles.tagT}>Pub</Text></View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, overflow: 'hidden', minHeight: 110, justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  img: { width: '100%', height: 140 },
  txt: { padding: spacing.lg },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  tag: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tagT: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
