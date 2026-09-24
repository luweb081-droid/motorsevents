'use strict';

/* Motor's Events – accueil
   Les événements viennent de la base Supabase (chargés par account.js). Aucun contenu n'est injecté via innerHTML :
   tout passe par textContent / createElement (bonne habitude contre le XSS). */
(() => {
  const CATS = {
    auto: 'Auto', moto: 'Moto', quad: 'Quad / SSV',
    truck: 'Truck', nautisme: 'Nautisme', aviation: 'Aviation'
  };
  const CAT_DESC = {
    auto: 'Rallye, circuit, course de côtes, 4x4…',
    moto: 'Motocross, enduro, balade, stunt…',
    quad: 'Rando, quad cross, baja…',
    truck: 'Camion cross, trial, circuit…',
    nautisme: 'Offshore, plaisance, salons…',
    aviation: 'Meetings, voltige, baptêmes…'
  };
  const SUBS = {
    auto: ['4X4', 'Circuit', 'Course de côtes', 'Rallye', 'Régularité', 'Salons et rencontres', 'Sortie/Balade', 'Track day/Roulage', 'Vente aux enchères', 'VHC'],
    moto: ['Circuit', 'Enduro', 'Motocross', 'Salons et rencontres', 'Sortie/Balade', 'Stunt', 'Track day/Roulage', 'Trial'],
    quad: ['Baja', 'Course sable', 'Quad cross', 'Rando quad', 'Sortie/Balade'],
    truck: ['Camion circuit', 'Camion cross', 'Salons et rencontres', 'Trial Truck'],
    nautisme: ['Inshore', 'Offshore', 'Plaisance', 'Salons et rencontres', 'Sortie/Balade'],
    aviation: ['Rallye', 'Salons et rencontres', 'Show aérien', 'Stage/Baptême', 'Voltige']
  };
  // Dates calculées automatiquement (plus de dates codées en dur)
  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const NOW = new Date(); NOW.setHours(12, 0, 0, 0);
  const SAT = addDays(NOW, NOW.getDay() === 0 ? -1 : 6 - NOW.getDay());
  const dayMonth = d => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
  const WHEN = {
    weekend: { from: isoDate(SAT), to: isoDate(addDays(SAT, 1)), label: `ce week-end (${dayMonth(SAT)})` },
    next:    { from: isoDate(addDays(SAT, 7)), to: isoDate(addDays(SAT, 8)), label: 'le week-end prochain' },
    month:   { from: isoDate(NOW), to: isoDate(addDays(NOW, 30)), label: 'dans les 30 prochains jours' },
    all:     { from: isoDate(NOW), to: '9999-99-99', label: 'à venir' }
  };
  const REGIONS = ['Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur', 'Guadeloupe', 'Guyane', 'La Réunion', 'Martinique', 'Mayotte'];

  // Aucun événement n'est écrit dans ce fichier : account.js charge les événements validés
  // depuis Supabase et les envoie ici via l'événement « motors:supabase-events ».
  let ALL_EVENTS = [];
  let loaded = false;

  const DEFAULT = { cat: 'all', what: '', where: '', when: 'all' };
  const state = { ...DEFAULT };

  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    kids.flat().forEach(k => { if (k != null) n.append(k); });
    return n;
  };
  const icon = (id, cls = 'icon') => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#i-' + id);
    s.append(u);
    return s;
  };
  const fmt = (iso, opts) => new Intl.DateTimeFormat('fr-FR', opts).format(new Date(iso + 'T12:00:00'));
  const durationDays = (start, end = null) => {
    const a = new Date(`${start}T12:00:00`);
    const b = new Date(`${end || start}T12:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  };
  const durationLabel = (start, end = null) => {
    const n = durationDays(start, end);
    return `${n} jour${n > 1 ? 's' : ''}`;
  };
  const dateLabel = (start, end = null) => {
    const a = fmt(start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!end || end === start) return a;
    const b = fmt(end, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `${a} → ${b}`;
  };

  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const plural = n => (n > 1 ? 's' : '');
  // N'affiche que les images hébergées sur Supabase Storage (https)
  const safeImg = v => { try { const u = new URL(String(v || '')); return u.protocol === 'https:' && u.hostname.endsWith('.supabase.co') ? u.href : null; } catch (_) { return null; } };

  /* ===== Carte interactive de France =====
     Les coordonnées exactes peuvent venir directement de Supabase :
     latitude + longitude.
     Si elles manquent, on utilise le centre approximatif de la ville/région
     uniquement pour garder le marqueur visible. */
  const CITY_COORDS = {
    'paris':[48.8566,2.3522],'marseille':[43.2965,5.3698],'lyon':[45.7640,4.8357],
    'toulouse':[43.6047,1.4442],'nice':[43.7102,7.2620],'nantes':[47.2184,-1.5536],
    'montpellier':[43.6108,3.8767],'strasbourg':[48.5734,7.7521],'bordeaux':[44.8378,-0.5792],
    'lille':[50.6292,3.0573],'rennes':[48.1173,-1.6778],'reims':[49.2583,4.0317],
    'saint-etienne':[45.4397,4.3872],'toulon':[43.1242,5.9280],'grenoble':[45.1885,5.7245],
    'dijon':[47.3220,5.0415],'angers':[47.4784,-0.5632],'nimes':[43.8367,4.3601],
    'aix-en-provence':[43.5297,5.4474],'clermont-ferrand':[45.7772,3.0870],
    'le havre':[49.4944,0.1079],'brest':[48.3904,-4.4861],'tours':[47.3941,0.6848],
    'amiens':[49.8941,2.2958],'limoges':[45.8336,1.2611],'perpignan':[42.6887,2.8948],
    'metz':[49.1193,6.1757],'besancon':[47.2378,6.0241],'orleans':[47.9030,1.9093],
    'rouen':[49.4432,1.0993],'caen':[49.1829,-0.3707],'avignon':[43.9493,4.8055],
    'poitiers':[46.5802,0.3404],'pau':[43.2951,-0.3708],'la rochelle':[46.1603,-1.1511],
    'bayonne':[43.4929,-1.4748],'biarritz':[43.4832,-1.5586],'albi':[43.9298,2.1480],
    'castres':[43.6059,2.2399],'tarbes':[43.2328,0.0781],'carcassonne':[43.2130,2.3491],
    'montauban':[44.0176,1.3542],'rodez':[44.3499,2.5757],'auch':[43.6464,0.5856],
    'agen':[44.2031,0.6164],'cahors':[44.4475,1.4419],'perigueux':[45.1840,0.7214],
    'brive-la-gaillarde':[45.1589,1.5333],'bayonne':[43.4929,-1.4748],
    'chambery':[45.5646,5.9178],'annecy':[45.8992,6.1294],'valence':[44.9334,4.8924],
    'avignon':[43.9493,4.8055],'arles':[43.6766,4.6278],'cannes':[43.5528,7.0174],
    'antibes':[43.5808,7.1239],'ajaccio':[41.9192,8.7386],'bastia':[42.6973,9.4509],
    'troyes':[48.2973,4.0744],'nancy':[48.6921,6.1844],'mulhouse':[47.7508,7.3359],
    'colmar':[48.0794,7.3585],'saint-malo':[48.6493,-2.0257],'vannes':[47.6582,-2.7608],
    'lorient':[47.7483,-3.3702],'quimper':[47.9960,-4.1028],'lavall':[48.0707,-0.7722],
    'le mans':[48.0061,0.1996],'cholet':[47.0594,-0.8792],'la roche-sur-yon':[46.6705,-1.4268]
  };
  const REGION_COORDS = {
    'ile-de-france':[48.8499,2.6370],'hauts-de-france':[49.9629,2.8278],
    'normandie':[49.1829,0.3707],'bretagne':[48.2020,-2.9326],
    'pays de la loire':[47.7633,-0.3299],'centre-val de loire':[47.5496,1.6751],
    'nouvelle-aquitaine':[45.7089,0.8109],'occitanie':[43.8927,2.2823],
    'auvergne-rhone-alpes':[45.4479,4.3853],'bourgogne-franche-comte':[47.2805,4.9994],
    'grand est':[48.6998,5.6000],'provence-alpes-cote d azur':[43.9352,6.0679],
    'corse':[42.0396,9.0129],'guadeloupe':[16.2650,-61.5510],
    'martinique':[14.6415,-61.0242],'guyane':[4.9224,-52.3135],
    'la reunion':[-21.1351,55.5364],'mayotte':[-12.8275,45.1662]
  };

  let eventsMap = null;
  let mapMarkers = [];
  let mapUserView = false; // true dès que des filtres recentrent la carte

  // Vue par défaut : la France métropolitaine, quelle que soit la taille de l'écran
  const FRANCE_BOUNDS = [[41.3, -5.2], [51.2, 9.6]];
  const showFrance = () => eventsMap.fitBounds(FRANCE_BOUNDS, { animate: false });

  const mapNorm = value => norm(String(value || ''))
    .replace(/['’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  function getEventCoords(e) {
    const lat = Number(e.latitude ?? e.lat);
    const lng = Number(e.longitude ?? e.lng ?? e.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { coords:[lat,lng], exact:true };
    }

    const cityKey = mapNorm(e.city);
    if (CITY_COORDS[cityKey]) return { coords:CITY_COORDS[cityKey], exact:false };

    const regionKey = mapNorm(e.region);
    if (REGION_COORDS[regionKey]) return { coords:REGION_COORDS[regionKey], exact:false };

    return null;
  }

  const MAP_COLORS = {
    auto:'#E63946', moto:'#F58220', quad:'#2FA58A',
    truck:'#4E6FD8', nautisme:'#2D9CDB', aviation:'#9B59B6'
  };

  function initEventsMap() {
    if (!window.L || !document.getElementById('eventsMap')) {
      const status = document.getElementById('mapStatus');
      if (status) status.textContent = 'La carte interactive est momentanément indisponible.';
      return;
    }
    if (eventsMap) return;

    eventsMap = L.map('eventsMap', {
      zoomControl: true,
      scrollWheelZoom: true,
      minZoom: 4,
      maxZoom: 12,
      zoomSnap: 0.25
    });
    showFrance();

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(eventsMap);

    setTimeout(() => { eventsMap.invalidateSize(); if (!mapUserView) showFrance(); }, 50);
  }

  function escapeMapHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function updateEventsMap(items) {
    const count = document.getElementById('mapEventCount');
    const status = document.getElementById('mapStatus');
    if (count) count.textContent = String(items.length);

    initEventsMap();
    if (!eventsMap) return;

    mapMarkers.forEach(marker => eventsMap.removeLayer(marker));
    mapMarkers = [];

    const bounds = [];
    let approximateCount = 0;

    items.forEach(e => {
      const position = getEventCoords(e);
      if (!position) return;

      if (!position.exact) approximateCount++;
      const color = MAP_COLORS[e.cat] || '#FF5B14';

      const marker = L.marker(position.coords, {
        icon: L.divIcon({
          className: 'motor-map-marker',
          html: `<span class="motor-map-pin cat-${e.cat || 'auto'}"></span>`,
          iconSize: [28, 36],
          iconAnchor: [14, 34],
          popupAnchor: [0, -30]
        }),
        title: e.title
      }).addTo(eventsMap);

      const date = fmt(e.date, { day:'numeric', month:'long' });
      const url = safeExternalUrl(e.url);
      marker.bindPopup(`
        <div class="map-popup">
          <span class="map-popup-cat">${escapeMapHtml(CATS[e.cat] || 'Événement')}</span>
          <strong>${escapeMapHtml(e.title)}</strong>
          <span>${escapeMapHtml(e.city || e.region || 'France')} · ${escapeMapHtml(date)}</span>
          ${position.exact ? '' : '<small>Position approximative</small>'}
          <button type="button" data-map-event="${escapeMapHtml(e.id)}">Voir l’événement</button>
          ${url ? `<a href="${escapeMapHtml(url)}" target="_blank" rel="noopener noreferrer">Site officiel ↗</a>` : ''}
        </div>
      `);

      marker.on('popupopen', ev => {
        const popup = ev.popup.getElement();
        const button = popup?.querySelector('[data-map-event]');
        if (button) button.addEventListener('click', () => {
          const eventId = button.getAttribute('data-map-event');
          openEvent(Number.isNaN(Number(eventId)) ? eventId : Number(eventId));
          eventsMap.closePopup();
        });
      });

      mapMarkers.push(marker);
      bounds.push(position.coords);
    });

    const filtersActive = Object.keys(DEFAULT).some(k => state[k] !== DEFAULT[k]);
    mapUserView = filtersActive && bounds.length > 0;
    if (mapUserView && bounds.length === 1) {
      eventsMap.setView(bounds[0], 8, { animate:false });
    } else if (mapUserView) {
      eventsMap.fitBounds(bounds, { padding:[35,35], maxZoom:8, animate:false });
    } else {
      showFrance(); // par défaut : toute la France
    }

    if (status) {
      if (!items.length) status.textContent = 'Aucun événement ne correspond aux filtres actuels.';
      else if (!bounds.length) status.textContent = `${items.length} événement${items.length > 1 ? 's' : ''} trouvé${items.length > 1 ? 's' : ''}. Ajoutez des coordonnées latitude/longitude dans Supabase pour afficher les pins.`;
      else status.textContent = approximateCount
        ? `${items.length} événement${items.length > 1 ? 's' : ''} · ${approximateCount} position${approximateCount > 1 ? 's' : ''} approximative${approximateCount > 1 ? 's' : ''}`
        : `${items.length} événement${items.length > 1 ? 's' : ''} · positions exactes`;
    }
  }

  initEventsMap();

  const whatEl = $('#what'), whereEl = $('#where'), whenEl = $('#when');
  const tilesEl = $('#tiles'), cardsEl = $('#cards'), emptyEl = $('#empty');
  const countEl = $('#count'), resetTop = $('#resetTop'), allLink = $('.all-events-link');

  /* Catégories */
  Object.entries(CATS).forEach(([key, label]) => {
    const b = el('button', { class: 'tile', type: 'button', 'aria-pressed': 'false', 'data-cat': key },
      el('span', { class: 'tile-icon' }, icon(key)),
      el('span', { class: 'tile-name', text: label }),
      el('span', { class: 'tile-desc', text: CAT_DESC[key] }),
      el('span', { class: 'tile-count', text: '' })
    );
    b.addEventListener('click', () => {
      state.cat = state.cat === key ? 'all' : key;
      render();
      $('#results').scrollIntoView();
    });
    tilesEl.append(b);
  });

  /* Régions */
  REGIONS.forEach(r => {
    const b = el('button', { class: 'pill', type: 'button', text: r });
    b.addEventListener('click', () => {
      Object.assign(state, DEFAULT, { where: r, when: 'all' });
      render();
      $('#results').scrollIntoView();
    });
    $('#regionList').append(el('li', {}, b));
  });

  /* Cartes et fiche événement : rendu commun avec la page « Événements » (event-ui.js).
     On convertit simplement nos données vers le modèle attendu par event-ui.js. */
  // Lu à l'usage (pas au chargement) : event-ui.js peut arriver après ce fichier
  const ui = () => window.ME_EVENT_UI;
  const toModel = e => ({
    id: e.id,
    dbId: e.source === 'supabase' && e.dbId ? e.dbId : null,
    title: e.title, cat: e.cat, sub: e.sub,
    start: e.date, end: e.endDate,
    city: e.city, region: e.region, place: e.address || '',
    desc: e.description, image: safeImg(e.image_url), url: safeExternalUrl(e.url), price: e.price,
    organizer: { id: e.organizerId, name: e.organizer, avatar: e.organizerAvatar, verified: e.verified }
  });
  const favorites = { isOn: ev => isFav(ev.id), toggle: ev => toggleFav(ev.id) };
  const card = e => ui().card(toModel(e), { onOpen: () => openEvent(e.id) });

  function render() {
    const w = WHEN[state.when];
    const what = norm(state.what.trim());
    const where = norm(state.where.trim());
    const items = ALL_EVENTS
      .filter(e => (state.cat === 'all' || e.cat === state.cat)
        && (e.endDate || e.date) >= w.from && e.date <= w.to
        && (!what || norm(`${e.title} ${e.sub} ${CATS[e.cat]}`).includes(what))
        && (!where || norm(`${e.city} ${e.region}`).includes(where)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr'));

    // L'accueil n'affiche qu'un aperçu : la liste complète est sur la page « Événements »
    const n = items.length;
    updateEventsMap(items);
    const limit = matchMedia('(max-width: 600px)').matches ? 4 : 6;
    cardsEl.replaceChildren(...items.slice(0, limit).map(card));
    emptyEl.hidden = !loaded || n > 0;

    const cat = state.cat === 'all' ? '' : ` (${CATS[state.cat]})`;
    countEl.textContent = !loaded ? 'Chargement des événements…'
      : n === 0 ? 'Aucun événement' : `${n} événement${plural(n)} ${w.label}${cat}`;

    // Le lien « Voir tous les événements » garde les filtres choisis
    if (allLink) {
      const p = new URLSearchParams();
      if (state.cat !== 'all') p.set('cat', state.cat);
      const q = state.what.trim() || state.where.trim();
      if (q) p.set('q', q);
      if (state.when !== 'all') p.set('when', state.when);
      allLink.href = './evenements.html' + (p.toString() ? `?${p}` : '');
    }

    tilesEl.querySelectorAll('.tile').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.cat === state.cat)));
    if (whatEl) whatEl.value = state.what;
    if (whereEl) whereEl.value = state.where;
    if (whenEl) whenEl.value = state.when;
    resetTop.hidden = Object.keys(DEFAULT).every(k => state[k] === DEFAULT[k]);
  }

  /* Recherche */
  whatEl?.addEventListener('input', () => { state.what = whatEl.value; render(); });
  whereEl?.addEventListener('input', () => { state.where = whereEl.value; render(); });
  whenEl?.addEventListener('change', () => { state.when = whenEl.value; render(); });
  $('#search')?.addEventListener('submit', ev => { ev.preventDefault(); render(); });
  const reset = () => { Object.assign(state, DEFAULT); render(); };
  resetTop.addEventListener('click', reset);
  $('#resetEmpty').addEventListener('click', reset);

  /* Fenêtre d'ajout d'événement (maquette : rien n'est envoyé) */
  const dlg = $('#dlg'), form = $('#addForm'), done = $('#done');
  const fCat = $('#f-cat'), fSub = $('#f-sub');
  Object.entries(CATS).forEach(([k, v]) => fCat.append(el('option', { value: k, text: v })));
  const fillSubs = () => fSub.replaceChildren(...SUBS[fCat.value].map(s => el('option', { value: s, text: s })));
  fCat.addEventListener('change', fillSubs);
  fillSubs();

  document.querySelectorAll('[data-open-add]').forEach(b => b.addEventListener('click', () => {
    form.reset();
    fillSubs();
    form.hidden = false;
    done.hidden = true;
    dlg.showModal();
  }));
  $('#dlgClose').addEventListener('click', () => dlg.close());
  $('#doneClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
  // Aperçu de l'affiche choisie
  const imgPrev = $('#f-img-preview');
  let prevUrl = null;
  const clearPrev = () => { if (prevUrl) URL.revokeObjectURL(prevUrl); prevUrl = null; imgPrev.hidden = true; imgPrev.removeAttribute('src'); };
  form.addEventListener('reset', () => setTimeout(clearPrev));
  $('#f-img').addEventListener('change', () => {
    clearPrev();
    const file = $('#f-img').files?.[0];
    if (!file) return;
    const allowed = new Set(['image/jpeg','image/png','image/webp']);
    if (!allowed.has(file.type) || file.size > 5 * 1024 * 1024) {
      $('#f-img').value = '';
      alert('Image refusée : JPG, PNG ou WebP uniquement, 5 Mo maximum.');
      return;
    }
    prevUrl = URL.createObjectURL(file); imgPrev.src = prevUrl; imgPrev.hidden = false;
  });

  // La soumission réelle est gérée par account.js après authentification Supabase.


  /* ===== V2 : favoris, fiches, calendrier, à la une, alertes ===== */
  const FAV_KEY = 'motors-events-favorites-v1';
  const ALERT_KEY = 'motors-events-alert-v1';
  const safeReadJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value;
    } catch (_) {
      try { localStorage.removeItem(key); } catch (_) {}
      return fallback;
    }
  };
  const getFavs = () => {
    const value = safeReadJSON(FAV_KEY, []);
    return Array.isArray(value) ? value.filter(Number.isInteger) : [];
  };
  const setFavs = v => {
    const clean = [...new Set(v.filter(Number.isInteger))].slice(0, 200);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(clean)); } catch (_) {}
    updateFavCount();
  };
  const isFav = id => getFavs().includes(id);
  function toggleFav(id){ const e=ALL_EVENTS.find(x=>x.id===id); if(window.ME_SOCIAL && e && e.source==='supabase'){ return window.ME_SOCIAL.toggleFavorite(e); } const f=getFavs(); const i=f.indexOf(id); i>=0?f.splice(i,1):f.push(id); setFavs(f); }
  function updateFavCount(){ $('#favCount').textContent=getFavs().length; }

  const safeExternalUrl = value => {
    try {
      const u = new URL(String(value || ''), location.origin);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return u.href;
    } catch (_) { return null; }
  };
  function openEvent(id){
    const e = ALL_EVENTS.find(x => x.id === id); if (!e) return;
    ui().openDetail(toModel(e), { favorites });
  }
  window.addEventListener('motors:open-db-event', ev => { const id=Number(ev.detail); const e=ALL_EVENTS.find(x=>x.dbId===id); if(e) openEvent(e.id); });

  function renderFeatured(){
    const top=ALL_EVENTS.filter(e=>(e.endDate||e.date)>=WHEN.all.from).sort((a,b)=>(!!safeImg(b.image_url))-(!!safeImg(a.image_url))||a.date.localeCompare(b.date)).slice(0,3);
    $('#featuredGrid').replaceChildren(...top.map(e=>{const img=safeImg(e.image_url);return el('article',{class:'featured-item',tabindex:'0'},img?el('img',{class:'featured-item-image',src:img,alt:'',loading:'lazy'}):null,img?el('div',{class:'featured-item-overlay'}):null,el('div',{class:img?'featured-item-content':'featured-item-plain'},el('span',{class:'featured-badge',text:CATS[e.cat]}),el('h3',{text:e.title}),el('p',{text:`${e.city} · ${fmt(e.date,{day:'numeric',month:'long'})}`})));}));
    $('#featuredGrid').querySelectorAll('.featured-item').forEach((n,i)=>{n.addEventListener('click',()=>openEvent(top[i].id));n.addEventListener('keydown',ev=>{if(ev.key==='Enter')openEvent(top[i].id)})});
  }
  function renderCalendar(){
    const groups={}; ALL_EVENTS.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>(groups[e.date]??=[]).push(e));
    $('#calendarGrid').replaceChildren(...Object.entries(groups).map(([date,items])=>el('article',{class:'calendar-day'},el('div',{class:'calendar-day-head'},el('b',{text:fmt(date,{weekday:'long'})}),el('span',{text:fmt(date,{day:'numeric',month:'long',year:'numeric'})})),el('div',{class:'calendar-events'},...items.map(e=>el('button',{class:'calendar-event',type:'button'},el('strong',{text:e.title}),el('small',{text:`${e.city} · ${durationLabel(e.date, e.endDate)} · ${e.price}`})))))));
    const nodes=$('#calendarGrid').querySelectorAll('.calendar-event'); let i=0; ALL_EVENTS.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>nodes[i++].addEventListener('click',()=>openEvent(e.id)));
  }

  $('#calendarBtn').addEventListener('click',()=>{ $('#calendarSection').hidden=false; renderCalendar(); $('#calendarSection').scrollIntoView({behavior:'smooth'}); });
  $('#closeCalendar').addEventListener('click',()=>$('#calendarSection').hidden=true);
  $('#showAllBtn').addEventListener('click',()=>$('#results').scrollIntoView({behavior:'smooth'}));
  $('#favoritesBtn').addEventListener('click',()=>{
    const f=getFavs();
    if(!f.length){ alert('Aucun favori pour le moment.'); return; }
    $('#calendarSection').hidden=false;
    $('#calendar-title').textContent='Mes favoris';
    document.querySelector('.calendar-sub').textContent='Vos événements enregistrés.';
    const favEvents=ALL_EVENTS.filter(e=>f.includes(e.id));
    $('#calendarGrid').replaceChildren(...favEvents.map(e=>{
      const article=el('article',{class:'calendar-day'});
      const head=el('div',{class:'calendar-day-head'},el('b',{text:e.title}),el('span',{text:`${e.city} · ${fmt(e.date,{day:'numeric',month:'long'})}`}));
      article.append(head);
      article.addEventListener('click',()=>openEvent(e.id));
      return article;
    }));
    $('#calendarSection').scrollIntoView({behavior:'smooth'});
  });
  $('#favQuickBtn').addEventListener('click',()=>$('#favoritesBtn').click());

  $('#nearbyBtn').addEventListener('click',()=>{
    if(!navigator.geolocation){alert('La géolocalisation n’est pas disponible sur ce navigateur.');return;}
    navigator.geolocation.getCurrentPosition(()=>{alert('Position détectée. Pour une vraie recherche par distance, il faudra ensuite connecter les adresses à une API cartographique.');},()=>alert('Impossible d’obtenir votre position. Vérifiez l’autorisation de localisation.'));
  });

  const alertsDlg=$('#alertsDlg');
  Object.entries(CATS).forEach(([k,v])=>$('#alertCat').append(el('option',{value:k,text:v})));
  $('#alertCat').prepend(el('option',{value:'all',text:'Toutes les catégories'}));
  $('#alertRegion').append(el('option',{value:'all',text:'Toutes les régions'})); REGIONS.forEach(r=>$('#alertRegion').append(el('option',{value:r,text:r})));
  $('#alertsBtn').addEventListener('click',()=>alertsDlg.showModal());
  $('#alertsClose').addEventListener('click',()=>alertsDlg.close());
  $('#alertsForm').addEventListener('submit',ev=>{
    ev.preventDefault();
    const keyword = $('#alertKeyword').value.trim().slice(0, 80);
    const payload = {cat:$('#alertCat').value, region:$('#alertRegion').value, keyword};
    try { localStorage.setItem(ALERT_KEY, JSON.stringify(payload)); } catch (_) {}
    $('#alertStatus').textContent='Alerte enregistrée sur cet appareil.';
  });
  updateFavCount(); window.addEventListener('motors:favorites-changed', updateFavCount); renderFeatured();

  window.addEventListener('motors:supabase-events', ev => {
    const incoming = Array.isArray(ev.detail) ? ev.detail : [];
    loaded = true;
    ALL_EVENTS = incoming;
    tilesEl.querySelectorAll('.tile').forEach(t => { const n = ALL_EVENTS.filter(e => e.cat === t.dataset.cat).length; t.querySelector('.tile-count').textContent = `${n} événement${plural(n)}`; });
    renderFeatured();
    renderCalendar();
    updateFavCount();
    render();
  });

  // Si la base ne répond pas, on arrête d'afficher « Chargement… ».
  setTimeout(() => { if (!loaded) { loaded = true; render(); } }, 8000);

  window.addEventListener('resize', () => eventsMap?.invalidateSize());
  render();
})();