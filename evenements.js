/* Motor's Events – page « Tous les événements »
   Les événements ne sont PAS dans ce fichier : ils sont lus dans la base Supabase
   (table ci-dessous), par pages, avec les filtres appliqués côté base. */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     Réglages de la base (table `events` de Supabase, comme dans account.js).
     ------------------------------------------------------------------ */
  const DB = {
    table: 'events',
    cols: {
      id: 'id',
      title: 'title',
      cat: 'category',
      sub: 'subtype',
      start: 'start_date',
      end: 'end_date',
      place: 'place',
      city: 'city',
      region: 'region',
      desc: 'description',
      url: 'official_url',
      image: 'image_url',
      user: 'user_id',
    },
    // Seuls les événements validés par l'équipe sont affichés.
    approved: { col: 'status', val: 'approved' },
  };

  const CATS = {
    auto: 'Auto', moto: 'Moto', quad: 'Quad / SSV',
    truck: 'Truck', nautisme: 'Nautisme', aviation: 'Aviation',
  };
  const PAGE_SIZE_MOBILE = 6;
  const PAGE_SIZE_DESKTOP = 12;

  /* ------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);
  const el = {
    form: $('filters'), q: $('q'), region: $('region'), when: $('when'),
    toggle: $('filtersToggle'), badge: $('filtersBadge'), chips: $('chips'),
    count: $('count'), reset: $('reset'), cards: $('cards'),
    empty: $('empty'), resetEmpty: $('resetEmpty'),
    error: $('error'), retry: $('retry'),
    moreWrap: $('moreWrap'), more: $('more'),
    dlg: $('eventDlg'), detail: $('eventDetail'),
  };

  const state = {
    q: '', cat: '', region: '', when: 'all',
    rows: [], offset: 0, total: null, hasMore: false,
    token: 0, loading: false,
  };

  const isMobile = () => matchMedia('(max-width: 600px)').matches;
  const pageSize = () => (isMobile() ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP);
  const col = (name) => DB.cols[name] || null;

  /* ---------- Accès à Supabase (API REST, clé publique uniquement) ---------- */

  function readConfig() {
    const cfg = window.ME_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.publishableKey) {
      throw new Error('Configuration Supabase introuvable : vérifier supabase-config.js (window.ME_SUPABASE_CONFIG).');
    }
    return { url: String(cfg.url).replace(/\/+$/, ''), key: String(cfg.publishableKey) };
  }

  async function api(params, { table = DB.table, count = false } = {}) {
    const { url, key } = readConfig();
    const headers = { apikey: key, Accept: 'application/json' };
    if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;   // anciennes clés JWT seulement
    if (count) headers.Prefer = 'count=exact';
    const res = await fetch(`${url}/rest/v1/${table}?${new URLSearchParams(params)}`, { headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Supabase ${res.status} : ${detail.slice(0, 300)}`);
    }
    const rows = await res.json();
    const m = /\/(\d+)$/.exec(res.headers.get('Content-Range') || '');
    return { rows, total: m ? Number(m[1]) : null };
  }

  /* ---------- Dates ---------- */

  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const parseDay = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;   // jour local, sans décalage de fuseau
  };

  const fmt = (o) => new Intl.DateTimeFormat('fr-FR', o);
  const F = {
    wd: fmt({ weekday: 'short' }), d: fmt({ day: 'numeric' }), mo: fmt({ month: 'short' }),
    short: fmt({ day: 'numeric', month: 'short' }),
    long: fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  };
  const sameDay = (a, b) => !b || iso(a) === iso(b);
  const range = (f, a, b) => {
    if (sameDay(a, b)) return f.format(a);
    try { return f.formatRange(a, b); } catch { return `${f.format(a)} – ${f.format(b)}`; }
  };

  function dateWindow(when) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (when === 'weekend' || when === 'next') {
      const dow = today.getDay();                                   // 0 = dimanche
      const sat0 = addDays(today, dow === 0 ? -1 : 6 - dow);        // samedi du week-end en cours
      const sat = when === 'next' ? addDays(sat0, 7) : sat0;
      return { from: sat < today ? today : sat, to: addDays(sat, 1) };
    }
    if (when === 'month') return { from: today, to: addDays(today, 30) };
    return { from: today, to: null };
  }

  /* ---------- Requête ---------- */

  const cleanTerm = (s) => s.replace(/[\\"%*(),]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const quote = (s) => s.replace(/[\\"]/g, '\\$&');

  function baseConditions(from) {
    const start = col('start'), end = col('end');
    const cond = [];
    if (DB.approved) cond.push(`${DB.approved.col}.eq.${DB.approved.val}`);
    const f = iso(from);
    // encore à venir : la fin n'est pas passée (ou, sans date de fin, le début)
    cond.push(end
      ? `or(${end}.gte.${f},and(${end}.is.null,${start}.gte.${f}))`
      : `${start}.gte.${f}`);
    return cond;
  }

  function listParams(limit, offset) {
    const { from, to } = dateWindow(state.when);
    const cond = baseConditions(from);
    if (to) cond.push(`${col('start')}.lte.${iso(to)}`);
    if (state.cat && col('cat')) cond.push(`${col('cat')}.ilike."${state.cat}"`);
    if (state.region && col('region')) cond.push(`${col('region')}.eq."${quote(state.region)}"`);
    const term = cleanTerm(state.q);
    if (term) {
      const fields = ['title', 'city', 'place', 'region', 'sub'].map(col).filter(Boolean);
      cond.push(`or(${fields.map((f) => `${f}.ilike."*${term}*"`).join(',')})`);
    }
    return {
      select: Object.values(DB.cols).filter(Boolean).join(','),
      and: `(${cond.join(',')})`,
      order: [col('start') + '.asc', col('id') && col('id') + '.asc'].filter(Boolean).join(','),
      limit: String(limit),
      offset: String(offset),
    };
  }

  /* ---------- Données ---------- */

  const safeUrl = (u) => {
    try {
      const x = new URL(String(u));
      return /^https?:$/.test(x.protocol) ? x.href : null;
    } catch { return null; }
  };
  const safeImg = (u) => {
    if (!u) return null;
    try {
      const x = new URL(String(u), location.href);
      const storage = x.protocol === 'https:' && x.hostname.endsWith('.supabase.co');
      return storage || x.origin === location.origin ? x.href : null;
    } catch { return null; }
  };

  function normalize(r) {
    const g = (k) => (col(k) ? r[col(k)] : null);
    return {
      id: g('id'),
      title: String(g('title') || 'Événement'),
      cat: String(g('cat') || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(),
      sub: g('sub') || '',
      start: parseDay(g('start')),
      end: parseDay(g('end')),
      place: g('place') || '',
      city: g('city') || '',
      region: g('region') || '',
      desc: g('desc') || '',
      url: g('url') ? safeUrl(g('url')) : null,
      image: g('image') ? safeImg(g('image')) : null,
      userId: g('user') || null,
    };
  }

  /* ---------- Construction du DOM (jamais d'innerHTML : les textes viennent des membres) ---------- */

  function h(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(id) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#i-${id}`);
    svg.append(use);
    return svg;
  }

  const known = (ev) => ev.cat in CATS;
  const catClass = (ev) => (known(ev) ? `cat-${ev.cat}` : 'cat-autre');
  const catIcon = (ev) => (known(ev) ? ev.cat : 'pin');

  /* Cartes et fiche événement : rendu commun avec l'accueil (event-ui.js) */
  const favId = (id) => 1000000000 + Number(id);              // même identifiant que sur l'accueil (account.js)

  function toModel(ev) {
    return {
      id: ev.id, dbId: ev.id,
      title: ev.title, cat: ev.cat, sub: ev.sub,
      start: ev.start ? iso(ev.start) : '', end: ev.end ? iso(ev.end) : null,
      city: ev.city, region: ev.region, place: ev.place,
      desc: ev.desc, image: ev.image, url: ev.url,
      organizer: { id: ev.userId },
    };
  }

  const cardOf = (ev) => window.ME_EVENT_UI.card(toModel(ev), { onOpen: () => openEvent(ev.id) });

  function skeletons(n) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      frag.append(h('li', { class: 'card is-skeleton', 'aria-hidden': 'true' },
        h('div', { class: 'cover' }),
        h('div', { class: 'card-body' },
          h('span', { class: 'sk-line w40' }),
          h('span', { class: 'sk-line w90' }),
          h('span', { class: 'sk-line w60' }))));
    }
    return frag;
  }

  /* ---------- Fiche détaillée ---------- */

  // Nom et photo de l'organisateur, chargés après l'ouverture de la fiche
  async function loadOrganizer(m) {
    const { rows } = await api(
      { select: 'id,display_name,username,avatar_url', id: `eq.${m.organizer.id}`, limit: '1' },
      { table: 'profiles' });
    const p = rows[0];
    return p ? { name: p.display_name || p.username || 'Organisateur', avatar: safeImg(p.avatar_url) } : null;
  }

  async function openEvent(id, { fetchIfMissing = false } = {}) {
    let ev = state.rows.find((r) => String(r.id) === String(id));
    if (!ev && fetchIfMissing && col('id')) {
      try {
        const params = { select: Object.values(DB.cols).filter(Boolean).join(','), [col('id')]: `eq.${id}`, limit: '1' };
        if (DB.approved) params[DB.approved.col] = `eq.${DB.approved.val}`;
        const { rows } = await api(params);
        if (rows[0]) ev = normalize(rows[0]);
      } catch (err) { console.error('[événements]', err); }
    }
    if (!ev) return;
    const social = window.ME_SOCIAL;
    window.ME_EVENT_UI.openDetail(toModel(ev), {
      favorites: social?.toggleFavorite && Number.isFinite(favId(ev.id)) ? {
        isOn: (m) => Boolean(window.ME_SOCIAL?.isFavorite?.(favId(m.id))),
        toggle: (m) => window.ME_SOCIAL?.toggleFavorite?.({ id: favId(m.id), dbId: m.dbId, source: 'supabase' }),
      } : null,
      resolveOrganizer: loadOrganizer,
    });
    syncUrl(`#e-${ev.id}`);
  }

  /* ---------- Rendu de la liste ---------- */

  const filtersActive = () => Boolean(state.q || state.cat || state.region || state.when !== 'all');
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

  function updateChrome() {
    const secondary = (state.region ? 1 : 0) + (state.when !== 'all' ? 1 : 0);
    el.badge.hidden = secondary === 0;
    el.badge.textContent = String(secondary);
    el.reset.hidden = !filtersActive();
    for (const chip of el.chips.querySelectorAll('.chip')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.cat === state.cat));
    }
  }

  function updateCount() {
    const shown = state.rows.length;
    if (shown === 0) { el.count.textContent = ''; return; }
    const n = state.total ?? shown;
    const suffix = state.total == null && state.hasMore ? '+' : '';
    el.count.textContent = filtersActive()
      ? `${n}${suffix} ${n > 1 ? 'résultats' : 'résultat'}`
      : `${n}${suffix} ${n > 1 ? 'événements à venir' : 'événement à venir'}`;
  }

  function updateMore() {
    el.moreWrap.hidden = !state.hasMore;
    if (!state.hasMore) return;
    const left = state.total != null ? state.total - state.rows.length : null;
    el.more.textContent = left > 0
      ? `Afficher plus d'événements (${left} restant${left > 1 ? 's' : ''})`
      : "Afficher plus d'événements";
  }

  function setLoading(on) {
    state.loading = on;
    el.cards.setAttribute('aria-busy', String(on));
    el.more.setAttribute('aria-disabled', String(on));          // pas de `disabled` : le bouton garde le focus
  }

  async function load({ append = false } = {}) {
    const token = ++state.token;
    el.error.hidden = true;
    el.empty.hidden = true;
    updateChrome();

    if (!append) {
      state.rows = []; state.offset = 0; state.total = null; state.hasMore = false;
      el.cards.replaceChildren(skeletons(pageSize()));
      el.count.textContent = 'Chargement…';
      el.moreWrap.hidden = true;
    }
    setLoading(true);

    try {
      const size = pageSize();
      const { rows, total } = await api(listParams(size + 1, state.offset), { count: true });
      if (token !== state.token) return;                        // une recherche plus récente a pris le relais

      const hasMore = rows.length > size;
      const pageRows = rows.slice(0, size);
      const seen = new Set(state.rows.map((r) => String(r.id)));
      const fresh = pageRows.map(normalize).filter((r) => !seen.has(String(r.id)));

      state.offset += pageRows.length;
      state.rows = state.rows.concat(fresh);
      state.total = total;
      state.hasMore = hasMore;

      if (!append) el.cards.replaceChildren();
      const nodes = fresh.map(cardOf);
      el.cards.append(...nodes);

      updateCount();
      updateMore();
      el.empty.hidden = state.rows.length > 0;
      if (append && nodes[0]) nodes[0].querySelector('a')?.focus({ preventScroll: true });
    } catch (err) {
      if (token !== state.token) return;
      console.error('[événements]', err);
      if (!append) { el.cards.replaceChildren(); el.count.textContent = ''; }
      el.error.hidden = false;
    } finally {
      if (token === state.token) setLoading(false);
    }
  }

  /* ---------- Régions : uniquement celles qui ont des événements à venir ---------- */

  async function loadRegions() {
    if (!col('region')) return;
    try {
      const { rows } = await api({
        select: col('region'),
        and: `(${baseConditions(dateWindow('all').from).join(',')})`,
        limit: '1000',
      });
      const names = [...new Set(rows.map((r) => String(r[col('region')] || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'fr'));
      if (state.region && !names.includes(state.region)) names.push(state.region);
      el.region.append(...names.map((n) => new Option(n, n)));
      el.region.value = state.region;
    } catch (err) {
      console.error('[événements] régions', err);
    }
  }

  /* ---------- URL partageable (?cat=moto&region=…&q=…&when=…) ---------- */

  function syncUrl(hash = '') {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat) p.set('cat', state.cat);
    if (state.region) p.set('region', state.region);
    if (state.when !== 'all') p.set('when', state.when);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + hash);
  }

  function readUrl() {
    const p = new URLSearchParams(location.search);
    const cat = (p.get('cat') || '').toLowerCase();
    state.cat = cat in CATS ? cat : '';
    state.q = cleanTerm(p.get('q') || '');
    state.region = (p.get('region') || '').slice(0, 80);
    state.when = ['weekend', 'next', 'month'].includes(p.get('when')) ? p.get('when') : 'all';
    el.q.value = state.q;
    el.when.value = state.when;
    if (state.region) {                                          // filtre actif venu de l'URL : on montre le panneau
      el.form.classList.add('is-open');
      el.toggle.setAttribute('aria-expanded', 'true');
    }
  }

  /* ---------- Actions ---------- */

  function apply() {
    syncUrl();
    load();
  }

  function resetFilters() {
    Object.assign(state, { q: '', cat: '', region: '', when: 'all' });
    el.q.value = ''; el.region.value = ''; el.when.value = 'all';
    apply();
  }

  let typing;
  el.q.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => { state.q = cleanTerm(el.q.value); apply(); }, 350);
  });
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(typing);
    state.q = cleanTerm(el.q.value);
    el.q.blur();                                                 // referme le clavier sur téléphone
    apply();
  });
  el.region.addEventListener('change', () => { state.region = el.region.value; apply(); });
  el.when.addEventListener('change', () => { state.when = el.when.value; apply(); });
  el.chips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.cat = chip.dataset.cat;
    apply();
  });
  el.toggle.addEventListener('click', () => {
    const open = el.form.classList.toggle('is-open');
    el.toggle.setAttribute('aria-expanded', String(open));
  });
  el.reset.addEventListener('click', resetFilters);
  el.resetEmpty.addEventListener('click', resetFilters);
  el.retry.addEventListener('click', () => {
    if (el.region.options.length <= 1) loadRegions();            // la liste des régions avait échoué aussi
    load({ append: state.rows.length > 0 });
  });
  el.more.addEventListener('click', () => { if (!state.loading) load({ append: true }); });

  el.dlg.addEventListener('close', () => syncUrl());

  /* ---------- Démarrage ---------- */

  readUrl();
  updateChrome();
  load();
  loadRegions();

  function openFromHash() {
    const m = /^#e-(.+)$/.exec(location.hash);
    if (m) openEvent(decodeURIComponent(m[1]), { fetchIfMissing: true });
  }
  window.addEventListener('hashchange', openFromHash);            // lien collé dans la même page
  openFromHash();                                                 // lien partagé : ouvre directement la fiche
})();