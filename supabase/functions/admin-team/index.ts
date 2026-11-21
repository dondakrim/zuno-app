// Gestion de l'équipe du back-office (réservé aux super-admins).
// Utilise la clé service_role côté serveur : elle n'est jamais envoyée au navigateur.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TEAM_DOMAIN = 'team.zuno.invalid';
const PAGES = [
  'overview', 'commandes', 'litiges', 'paiements', 'reversements', 'paniers', 'moderation', 'articles',
  'publicites', 'boosts', 'promos', 'campagnes', 'utilisateurs', 'marchands', 'demandes', 'comptes', 'identites', 'kyc', 'connexions',
];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Non connecté' }, 401);

    const { data: me } = await admin.from('admins').select('id, is_super, active').eq('id', user.id).maybeSingle();
    if (!me || !me.is_super || me.active === false) return json({ error: 'Réservé aux super-administrateurs' }, 403);

    const body = await req.json();
    const cleanPerms = (p: unknown) => (Array.isArray(p) ? p.filter((x) => PAGES.includes(x)) : []);
    const strongPwd = (p: unknown) => typeof p === 'string' && p.length >= 10 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);

    const { data: supers } = await admin.from('admins').select('id').eq('is_super', true).neq('active', false);
    const otherSupers = (supers || []).filter((s) => s.id !== body.id).length;

    switch (body.action) {
      case 'create': {
        const username = String(body.username || '').trim().toLowerCase();
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) return json({ error: "Nom d'utilisateur invalide (3 à 30 caractères : lettres minuscules, chiffres, point, tiret)." }, 400);
        if (!strongPwd(body.password)) return json({ error: 'Mot de passe temporaire trop faible (10 caractères, lettres et chiffres).' }, 400);
        const is_super = !!body.is_super;
        const permissions = is_super ? [] : cleanPerms(body.permissions);
        if (!is_super && !permissions.length) return json({ error: 'Choisis au moins une page.' }, 400);
        const { data: dup } = await admin.from('admins').select('id').eq('username', username).maybeSingle();
        if (dup) return json({ error: "Ce nom d'utilisateur existe déjà." }, 400);

        const { data: created, error } = await admin.auth.admin.createUser({
          email: `${username}@${TEAM_DOMAIN}`, password: body.password, email_confirm: true,
        });
        if (error || !created.user) return json({ error: error?.message || 'Création impossible' }, 400);
        const { error: insErr } = await admin.from('admins').insert({
          id: created.user.id, username, display_name: String(body.display_name || username).trim(),
          is_super, permissions, active: true, must_change_password: true,
          password_changed_at: new Date().toISOString(), created_by: user.id,
        });
        if (insErr) {
          await admin.auth.admin.deleteUser(created.user.id);
          return json({ error: insErr.message }, 400);
        }
        return json({ ok: true, username });
      }
      case 'update': {
        const is_super = !!body.is_super;
        if (!is_super && body.id === user.id && otherSupers === 0) return json({ error: 'Tu es le dernier super-administrateur.' }, 400);
        const permissions = is_super ? [] : cleanPerms(body.permissions);
        const { error } = await admin.from('admins').update({ is_super, permissions }).eq('id', body.id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case 'set_active': {
        if (body.id === user.id) return json({ error: 'Tu ne peux pas te désactiver toi-même.' }, 400);
        const active = !!body.active;
        const { error } = await admin.from('admins').update({ active }).eq('id', body.id);
        if (error) return json({ error: error.message }, 400);
        // Bloque aussi la connexion côté authentification.
        await admin.auth.admin.updateUserById(body.id, { ban_duration: active ? 'none' : '876000h' });
        return json({ ok: true });
      }
      case 'reset_password': {
        if (!strongPwd(body.password)) return json({ error: 'Mot de passe trop faible.' }, 400);
        const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password });
        if (error) return json({ error: error.message }, 400);
        await admin.from('admins').update({ must_change_password: true, password_changed_at: new Date().toISOString() }).eq('id', body.id);
        return json({ ok: true });
      }
      case 'delete': {
        if (body.id === user.id) return json({ error: 'Tu ne peux pas te supprimer toi-même.' }, 400);
        await admin.from('admins').delete().eq('id', body.id);
        await admin.auth.admin.deleteUser(body.id);
        return json({ ok: true });
      }
      default:
        return json({ error: 'Action inconnue' }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
