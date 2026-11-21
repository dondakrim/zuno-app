// Dossiers KYC pour le tableau de bord. Toutes les vérifications de droits se font ICI (côté serveur).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const BUCKET = 'identity-documents';
const FIELDS = [
  'nom', 'prenom', 'genre', 'date_naissance', 'lieu_naissance', 'pays_residence', 'ville_residence',
  'doc_type', 'doc_number', 'doc_authority', 'doc_issued_at', 'doc_expires_at', 'doc_issue_place',
  'email', 'whatsapp', 'profession', 'marital_status', 'address',
];
const DATE_FIELDS = ['date_naissance', 'doc_issued_at', 'doc_expires_at'];
const KINDS = ['front', 'back', 'selfie'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Non connecté' }, 401);
    const { data: me } = await admin.from('admins')
      .select('id, is_super, active, permissions, username').eq('id', user.id).maybeSingle();
    if (!me || me.active === false) return json({ error: 'Accès refusé' }, 403);
    if (!me.is_super && !(me.permissions || []).includes('kyc')) return json({ error: 'Accès refusé' }, 403);
    const myName = me.username || 'agent';

    const body = await req.json().catch(() => ({}));
    const log = (user_id: string, action: string, detail?: string) =>
      admin.from('kyc_events').insert({ user_id, admin_id: user.id, admin_name: myName, action, detail: detail || null });
    const clean = (f: Record<string, unknown> = {}) => {
      const out: Record<string, unknown> = {};
      for (const k of FIELDS) {
        if (!(k in f)) continue;
        let v = f[k];
        if (typeof v === 'string') v = v.trim().slice(0, 200);
        if (v === '' || v === undefined) v = null;
        if (DATE_FIELDS.includes(k) && v && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return { __error: `Date invalide : ${k}` };
        out[k] = v;
      }
      return out;
    };
    const signed = async (path?: string | null) => {
      if (!path) return null;
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 900);
      return data?.signedUrl || null;
    };

    switch (body.action) {
      case 'list': {
        const st = ['en_attente', 'verifiee', 'rejetee'].includes(body.status) ? body.status : null;
        let q = admin.from('kyc_records')
          .select('user_id, nom, prenom, doc_type, doc_number, status, updated_at, whatsapp')
          .order('updated_at', { ascending: false }).limit(100);
        if (st) q = q.eq('status', st);
        const s = String(body.search || '').trim().replace(/[%,()]/g, '');
        if (s.length >= 2) q = q.or(`nom.ilike.%${s}%,prenom.ilike.%${s}%,doc_number.ilike.%${s}%,whatsapp.ilike.%${s}%`);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        // Demandes envoyées depuis l'appli (photo seule) qui n'ont pas encore de dossier
        let app: unknown[] = [];
        if (!st || st === 'en_attente') {
          const { data: pend } = await admin.from('users')
            .select('id, nom, telephone, ville').eq('identity_status', 'en_attente').limit(100);
          const have = new Set((data || []).map((r) => r.user_id));
          app = (pend || []).filter((u) => !have.has(u.id));
        }
        return json({ ok: true, rows: data || [], app_pending: app });
      }

      case 'search_users': {
        const s = String(body.q || '').trim().replace(/[%,()]/g, '');
        if (s.length < 2) return json({ ok: true, rows: [] });
        const { data, error } = await admin.from('users').select('id, nom, telephone, ville')
          .or(`nom.ilike.%${s}%,telephone.ilike.%${s}%`).limit(15);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, rows: data || [] });
      }

      case 'get': {
        const uid = String(body.user_id || '');
        const { data: u } = await admin.from('users')
          .select('id, nom, telephone, ville, identity_status, id_document_url').eq('id', uid).maybeSingle();
        if (!u) return json({ error: 'Utilisateur introuvable' }, 404);
        const { data: rec } = await admin.from('kyc_records').select('*').eq('user_id', uid).maybeSingle();
        const { data: events } = await admin.from('kyc_events').select('created_at, admin_name, action, detail')
          .eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
        await log(uid, 'consultation');
        return json({
          ok: true, user: u, record: rec || null, events: events || [],
          urls: {
            front: await signed(rec?.doc_front_path), back: await signed(rec?.doc_back_path),
            selfie: await signed(rec?.selfie_path), app_photo: await signed(u.id_document_url),
          },
        });
      }

      case 'upload_url': {
        const uid = String(body.user_id || '');
        if (!KINDS.includes(body.kind)) return json({ error: 'Type de fichier inconnu' }, 400);
        const ext = body.ext === 'png' ? 'png' : 'jpg';
        const path = `kyc/${uid}/${body.kind}-${Date.now()}.${ext}`;
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, path, token: data.token });
      }

      case 'save': {
        const uid = String(body.user_id || '');
        const f = clean(body.fields) as Record<string, unknown>;
        if (f.__error) return json({ error: f.__error }, 400);
        const row: Record<string, unknown> = { ...f, user_id: uid, updated_at: new Date().toISOString() };
        for (const [k, col] of [['front', 'doc_front_path'], ['back', 'doc_back_path'], ['selfie', 'selfie_path']]) {
          const p = body.paths?.[k];
          if (typeof p === 'string' && p.startsWith(`kyc/${uid}/`)) row[col] = p;
        }
        const { data: exist } = await admin.from('kyc_records').select('user_id, status').eq('user_id', uid).maybeSingle();
        if (exist && exist.status === 'verifiee') row.status = 'en_attente'; // une modification redemande une validation
        if (!exist) row.created_by = user.id;
        const { error } = await admin.from('kyc_records').upsert(row);
        if (error) return json({ error: error.message }, 400);
        await log(uid, exist ? 'modification' : 'creation_dossier');
        return json({ ok: true });
      }

      case 'decide': {
        const uid = String(body.user_id || '');
        const decision = body.decision;
        if (!['verifiee', 'rejetee'].includes(decision)) return json({ error: 'Décision invalide' }, 400);
        const reason = String(body.reason || '').trim().slice(0, 300);
        const { data: rec } = await admin.from('kyc_records').select('*').eq('user_id', uid).maybeSingle();
        if (decision === 'rejetee' && !reason) return json({ error: 'Indique la raison du refus.' }, 400);
        if (decision === 'verifiee') {
          if (!rec) return json({ error: 'Enregistre d\'abord le dossier.' }, 400);
          const missing = [];
          if (!rec.nom) missing.push('nom');
          if (!rec.doc_type) missing.push('type de pièce');
          if (!rec.doc_number) missing.push('numéro de pièce');
          if (!rec.doc_front_path) missing.push('photo recto');
          if (!rec.selfie_path) missing.push('selfie');
          if (missing.length) return json({ error: 'Il manque : ' + missing.join(', ') }, 400);
          if (rec.doc_expires_at && new Date(rec.doc_expires_at) < new Date()) return json({ error: 'La pièce est expirée.' }, 400);
        }
        if (rec) {
          await admin.from('kyc_records').update({
            status: decision, reject_reason: decision === 'rejetee' ? reason : null,
            reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq('user_id', uid);
        }
        const { error } = await admin.from('users').update({ identity_status: decision }).eq('id', uid);
        if (error) return json({ error: error.message }, 400);
        await admin.from('notifications').insert({
          user_id: uid,
          title: decision === 'verifiee' ? 'Identité vérifiée ✅' : 'Identité refusée',
          body: decision === 'verifiee'
            ? 'Le badge "Identité vérifiée" est maintenant visible sur ton profil.'
            : `Ta pièce n'a pas pu être validée : ${reason}`,
          type: 'identity', related_id: uid,
        });
        await log(uid, decision === 'verifiee' ? 'validation' : 'refus', reason || undefined);
        return json({ ok: true });
      }

      case 'create_account': {
        const digits = String(body.phone || '').replace(/[^\d]/g, '');
        if (digits.length < 8 || digits.length > 15) return json({ error: 'Numéro invalide (avec indicatif pays).' }, 400);
        const nom = String(body.nom || '').trim().slice(0, 100);
        if (!nom) return json({ error: 'Le nom est obligatoire.' }, 400);
        const ville = String(body.ville || '').trim().slice(0, 100) || null;
        const { data: created, error } = await admin.auth.admin.createUser({ phone: digits, phone_confirm: true });
        if (error) {
          const dup = /already|exist|registered/i.test(error.message);
          return json({ error: dup ? 'Ce numéro a déjà un compte.' : error.message }, dup ? 409 : 400);
        }
        const id = created.user!.id;
        const { error: e2 } = await admin.from('users').upsert({ id, telephone: '+' + digits, nom, ville });
        if (e2) {
          await admin.auth.admin.deleteUser(id);
          return json({ error: e2.message }, 400);
        }
        await admin.from('kyc_records').upsert({
          user_id: id, nom, whatsapp: '+' + digits, ville_residence: ville, created_by: user.id,
        });
        await log(id, 'creation_compte', 'Compte créé par ' + myName);
        return json({ ok: true, user_id: id });
      }

      default:
        return json({ error: 'Action inconnue' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
