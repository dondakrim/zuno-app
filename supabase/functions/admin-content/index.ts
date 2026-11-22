// Gestion du contenu (événements, catégories, avis, mots bloqués, FAQ) depuis le tableau de bord.
// Chaque page est protégée côté serveur : super-admin, ou droit sur la page concernée.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
class Fail extends Error { constructor(m: string, public status = 400) { super(m); } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_OF: Record<string, string> = {
  events: 'evenements', categories: 'categories', reviews: 'avis', terms: 'motsbloques', faq: 'faq',
};
const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const int = (v: unknown) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? n : 0; };
const normalize = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const likeEsc = (t: string) => t.replace(/[\\%_]/g, (c) => '\\' + c);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) throw new Fail('Non connecté', 401);
    const { data: me } = await db.from('admins').select('is_super, active, username, permissions').eq('id', user.id).maybeSingle();
    if (!me || me.active === false) throw new Fail('Accès refusé', 403);
    const who = me.username || 'admin';

    const body = await req.json().catch(() => ({}));
    const res = String(body.resource || '');
    const act = String(body.action || '');
    const page = PAGE_OF[res];
    if (!page) throw new Fail('Ressource inconnue');
    if (!me.is_super && !(me.permissions || []).includes(page)) throw new Fail('Accès refusé', 403);

    /* ---------------- Événements ---------------- */
    if (res === 'events') {
      if (act === 'list') {
        const { data: ev, error } = await db.from('events').select('*').order('starts_at', { ascending: false });
        if (error) throw new Fail(error.message);
        const ids = (ev || []).map((e) => e.id);
        const { data: links } = ids.length
          ? await db.from('event_listings').select('event_id, listing_id, position, listings(id, title, price, photo_url)').in('event_id', ids).order('position')
          : { data: [] as any[] };
        const rows = (ev || []).map((e) => ({
          ...e,
          items: (links || []).filter((l: any) => l.event_id === e.id).map((l: any) => ({ id: l.listing_id, ...(l.listings || {}) })),
        }));
        return json({ ok: true, rows });
      }
      if (act === 'search_listings') {
        const q = s(body.q, 60);
        let query = db.from('listings').select('id, title, price, photo_url, category').order('created_at', { ascending: false }).limit(20);
        if (q) query = query.ilike('title', '%' + likeEsc(q) + '%');
        const { data, error } = await query;
        if (error) throw new Fail(error.message);
        return json({ ok: true, rows: data || [] });
      }
      if (act === 'save') {
        const title = s(body.title, 80);
        if (!title) throw new Fail('Donne un titre à l\'événement.');
        const starts = new Date(body.starts_at), ends = new Date(body.ends_at);
        if (isNaN(+starts) || isNaN(+ends)) throw new Fail('Dates invalides.');
        if (ends <= starts) throw new Fail('La date de fin doit être après la date de début.');
        const color = /^#[0-9a-fA-F]{6}$/.test(String(body.color || '')) ? String(body.color) : '#7C3AED';
        const row: Record<string, unknown> = {
          title, subtitle: s(body.subtitle, 140), emoji: s(body.emoji, 8) || '🎉', color,
          image_url: s(body.image_url, 500) || null,
          starts_at: starts.toISOString(), ends_at: ends.toISOString(),
          active: body.active !== false, position: int(body.position),
        };
        let id = String(body.id || '');
        if (id) {
          if (!UUID.test(id)) throw new Fail('Identifiant invalide.');
          const { error } = await db.from('events').update(row).eq('id', id);
          if (error) throw new Fail(error.message);
        } else {
          const { data, error } = await db.from('events').insert({ ...row, created_by: who }).select('id').single();
          if (error) throw new Fail(error.message);
          id = data.id;
        }
        const ids = (Array.isArray(body.listing_ids) ? body.listing_ids : []).map(String).filter((x: string) => UUID.test(x)).slice(0, 60);
        await db.from('event_listings').delete().eq('event_id', id);
        if (ids.length) {
          const { error } = await db.from('event_listings').insert(ids.map((l: string, i: number) => ({ event_id: id, listing_id: l, position: i })));
          if (error) throw new Fail(error.message);
        }
        return json({ ok: true, id });
      }
      if (act === 'delete') {
        if (!UUID.test(String(body.id))) throw new Fail('Identifiant invalide.');
        const { error } = await db.from('events').delete().eq('id', body.id);
        if (error) throw new Fail(error.message);
        return json({ ok: true });
      }
    }

    /* ---------------- Catégories ---------------- */
    if (res === 'categories') {
      if (act === 'list') {
        const { data, error } = await db.from('app_categories').select('*').order('position').order('label');
        if (error) throw new Fail(error.message);
        const { data: ls } = await db.from('listings').select('category').limit(20000);
        const counts: Record<string, number> = {};
        (ls || []).forEach((l: any) => { if (l.category) counts[l.category] = (counts[l.category] || 0) + 1; });
        return json({ ok: true, rows: data || [], counts });
      }
      if (act === 'import') {
        // Catégories d'origine de l'appli + celles déjà utilisées par des articles.
        const DEFAULTS: [string, string][] = [
          ['Mode et vêtements', '👕'], ['Électronique et téléphones', '📱'], ['Maison et électroménager', '🏠'],
          ['Véhicules et pièces', '🚗'], ['Autres', '📦'],
        ];
        const { data: ls } = await db.from('listings').select('category').limit(20000);
        const used = [...new Set((ls || []).map((l: any) => String(l.category || '').trim()).filter(Boolean))];
        const all: [string, string][] = [...DEFAULTS];
        used.sort().forEach((n) => { if (!all.some(([l]) => l.toLowerCase() === n.toLowerCase())) all.splice(all.length - 1, 0, [n, '🏷️']); });
        const { data: ex } = await db.from('app_categories').select('label, parent, position');
        const have = new Set((ex || []).filter((e: any) => !e.parent).map((e: any) => e.label.toLowerCase()));
        const base = (ex || []).length;
        const add = all.map(([label, icon], i) => ({ label, icon, position: base + i })).filter((c) => !have.has(c.label.toLowerCase()));
        if (add.length) {
          const { error } = await db.from('app_categories').insert(add);
          if (error) throw new Fail(error.message);
        }
        return json({ ok: true, added: add.length });
      }
      if (act === 'save') {
        const label = s(body.label, 40);
        if (!label) throw new Fail('Donne un nom à la catégorie.');
        const row = { label, icon: s(body.icon, 8) || '🏷️', parent: s(body.parent, 40) || null, position: int(body.position), active: body.active !== false };
        const id = String(body.id || '');
        if (id) {
          if (!UUID.test(id)) throw new Fail('Identifiant invalide.');
          const { data: old } = await db.from('app_categories').select('label, parent').eq('id', id).maybeSingle();
          const { error } = await db.from('app_categories').update(row).eq('id', id);
          if (error) throw new Fail(error.code === '23505' ? 'Cette catégorie existe déjà.' : error.message);
          // Renommage d'une catégorie principale : les articles suivent.
          if (old && !old.parent && old.label !== label) {
            await db.from('listings').update({ category: label }).eq('category', old.label);
            await db.from('app_categories').update({ parent: label }).eq('parent', old.label);
          }
        } else {
          const { error } = await db.from('app_categories').insert(row);
          if (error) throw new Fail(error.code === '23505' ? 'Cette catégorie existe déjà.' : error.message);
        }
        return json({ ok: true });
      }
      if (act === 'delete') {
        if (!UUID.test(String(body.id))) throw new Fail('Identifiant invalide.');
        const { data: c } = await db.from('app_categories').select('label, parent').eq('id', body.id).maybeSingle();
        if (!c) throw new Fail('Catégorie introuvable.');
        if (!c.parent) {
          const { count } = await db.from('listings').select('id', { count: 'exact', head: true }).eq('category', c.label);
          if ((count || 0) > 0) throw new Fail(count + ' article(s) utilisent encore cette catégorie. Masque-la plutôt que de la supprimer.');
          await db.from('app_categories').delete().eq('parent', c.label);
        }
        const { error } = await db.from('app_categories').delete().eq('id', body.id);
        if (error) throw new Fail(error.message);
        return json({ ok: true });
      }
    }

    /* ---------------- Avis ---------------- */
    if (res === 'reviews') {
      if (act === 'list') {
        let q = db.from('reviews').select('*').order('created_at', { ascending: false }).limit(300);
        if (body.only_hidden) q = q.eq('hidden', true);
        if (body.max_note) q = q.lte('note', int(body.max_note));
        const { data, error } = await q;
        if (error) throw new Fail(error.message);
        // Le vendeur noté = vendeur de l'article de la commande (avis → commande → article).
        const rows: any[] = data || [];
        const oids = [...new Set(rows.map((r) => r.order_id).filter(Boolean))];
        if (oids.length) {
          const { data: ords } = await db.from('orders').select('id, listing_id').in('id', oids);
          const lids = [...new Set((ords || []).map((o: any) => o.listing_id).filter(Boolean))];
          const { data: lst } = lids.length ? await db.from('listings').select('id, vendeur_id').in('id', lids) : { data: [] as any[] };
          const sellerOfListing = new Map((lst || []).map((l: any) => [l.id, l.vendeur_id]));
          const listingOfOrder = new Map((ords || []).map((o: any) => [o.id, o.listing_id]));
          rows.forEach((r) => { r.cible_id = sellerOfListing.get(listingOfOrder.get(r.order_id)) || null; });
        }
        return json({ ok: true, rows });
      }
      if (act === 'hide' || act === 'unhide') {
        if (!UUID.test(String(body.id))) throw new Fail('Identifiant invalide.');
        const hide = act === 'hide';
        const { error } = await db.from('reviews').update({
          hidden: hide, hidden_reason: hide ? (s(body.reason, 200) || null) : null, hidden_at: hide ? new Date().toISOString() : null,
        }).eq('id', body.id);
        if (error) throw new Fail(error.message);
        return json({ ok: true });
      }
    }

    /* ---------------- Mots et numéros bloqués ---------------- */
    if (res === 'terms') {
      if (act === 'list') {
        const { data, error } = await db.from('blocked_terms').select('*').order('created_at', { ascending: false });
        if (error) throw new Fail(error.message);
        return json({ ok: true, rows: data || [] });
      }
      if (act === 'add') {
        const kind = body.kind === 'numero' ? 'numero' : 'mot';
        const list = String(body.terms || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).slice(0, 100);
        if (!list.length) throw new Fail('Écris au moins un mot ou un numéro.');
        const rows: { term: string; kind: string; created_by: string }[] = [];
        for (const raw of list) {
          const term = kind === 'numero' ? raw.replace(/[^0-9]/g, '') : normalize(raw).slice(0, 60);
          if (kind === 'numero' && term.length < 6) throw new Fail('Numéro trop court (6 chiffres minimum) : ' + raw);
          if (kind === 'mot' && term.length < 2) throw new Fail('Mot trop court : ' + raw);
          rows.push({ term, kind, created_by: who });
        }
        const { error } = await db.from('blocked_terms').upsert(rows, { onConflict: 'kind,term', ignoreDuplicates: true });
        if (error) throw new Fail(error.message);
        return json({ ok: true, added: rows.length });
      }
      if (act === 'toggle') {
        if (!UUID.test(String(body.id))) throw new Fail('Identifiant invalide.');
        const { error } = await db.from('blocked_terms').update({ active: body.active !== false }).eq('id', body.id);
        if (error) throw new Fail(error.message);
        return json({ ok: true });
      }
      if (act === 'delete') {
        if (!UUID.test(String(body.id))) throw new Fail('Identifiant invalide.');
        const { error } = await db.from('blocked_terms').delete().eq('id', body.id);
        if (error) throw new Fail(error.message);
        return json({ ok: true });
      }
    }

    /* ---------------- FAQ ---------------- */
    if (res === 'faq') {
      if (act === 'list') {
        const { data, error } = await db.from('faq_items').select('*').order('category').order('position');
        if (error) throw new Fail(error.message);
        return json({ ok: true, rows: data || [] });
      }
      if (act === 'save') {
        const question = s(body.question, 200), answer = s(body.answer, 2000);
        if (!question || !answer) throw new Fail('La question et la réponse sont obligatoires.');
        const row = { question, answer, category: s(body.category, 40) || 'Général', position: int(body.position), active: body.active !== false };
        const id = String(body.id || '');
        if (id) {
          if (!UUID.test(id)) throw new Fail('Identifiant invalide.');
          const { error } = await db.from('faq_items').update(row).eq('id', id);
          if (error) throw new Fail(error.message);
        } else {
          const { error } = await db.from('faq_items').insert(row);
          if (error) throw new Fail(error.message);
        }
        return json({ ok: true });
      }
      if (act === 'delete') {
        if (!UUID.test(String(body.id))) throw new Fail('Identifiant invalide.');
        const { error } = await db.from('faq_items').delete().eq('id', body.id);
        if (error) throw new Fail(error.message);
        return json({ ok: true });
      }
    }
    throw new Fail('Action inconnue');
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    return json({ error: (e as Error).message }, 500);
  }
});
