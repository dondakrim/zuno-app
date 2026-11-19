// Écran « Devenir marchand » — à placer dans src/screens/BecomeMerchantScreen.js
// Adapte uniquement la ligne `import { supabase }` si ton client Supabase est ailleurs.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

export default function BecomeMerchantScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('aucun');
  const [note, setNote] = useState(null);
  const [shop, setShop] = useState('');

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);
    const { data } = await supabase.from('users')
      .select('merchant_status, merchant_note, boutique_nom').eq('id', user.id).single();
    if (data) { setStatus(data.merchant_status || 'aucun'); setNote(data.merchant_note); setShop(data.boutique_nom || ''); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!shop.trim()) return Alert.alert('Nom de boutique', 'Indique le nom de ta boutique.');
    setSending(true);
    const { data, error } = await supabase.rpc('request_merchant_account', { p_shop_name: shop.trim() });
    setSending(false);
    if (error) return Alert.alert('Erreur', error.message);
    setStatus(data || 'demande');
  };

  if (loading) return <View style={s.c}><ActivityIndicator /></View>;

  return (
    <View style={s.c}>
      <Text style={s.title}>Compte marchand</Text>
      {status === 'actif' && <Text style={s.p}>✅ Ton compte marchand est actif.</Text>}
      {status === 'demande' && <Text style={s.p}>⏳ Ta demande est en cours de validation. Tu recevras une notification.</Text>}
      {(status === 'aucun' || status === 'refuse') && (
        <>
          {status === 'refuse' && <Text style={s.warn}>Ta dernière demande n'a pas été acceptée{note ? ' : ' + note : '.'}</Text>}
          <Text style={s.p}>Un compte marchand te donne ta boutique, le suivi de tes ventes et tes versements.</Text>
          <TextInput style={s.input} placeholder="Nom de ta boutique" value={shop} onChangeText={setShop} />
          <TouchableOpacity style={s.btn} onPress={send} disabled={sending}>
            <Text style={s.btnT}>{sending ? 'Envoi…' : 'Demander un compte marchand'}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  p: { fontSize: 15, color: '#444', marginBottom: 16, lineHeight: 22 },
  warn: { fontSize: 14, color: '#B3261E', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 16 },
  btn: { backgroundColor: '#FF6A00', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
