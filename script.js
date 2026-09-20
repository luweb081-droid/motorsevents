'use strict';

/* Motor's Events – maquette
   Données fictives. Aucun contenu n'est injecté via innerHTML :
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
  const WHEN = {
    weekend: { from: '2026-09-26', to: '2026-09-27', label: 'ce week-end (26 et 27 septembre)' },
    next:    { from: '2026-10-03', to: '2026-10-04', label: 'le week-end prochain (3 et 4 octobre)' },
    all:     { from: '0000-00-00', to: '9999-99-99', label: 'à venir' }
  };
  const REGIONS = ['Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur', 'Guadeloupe', 'Guyane', 'La Réunion', 'Martinique', 'Mayotte'];

  const EVENTS = [
    { id: 1,  title: 'Balade moto des vignobles',         cat: 'moto',     sub: 'Sortie/Balade',        city: 'Bordeaux',         region: 'Nouvelle-Aquitaine',           date: '2026-09-26', price: 'Gratuit', organizer:'Moto Club Gironde', verified:true, description:'Une grande balade conviviale à travers les vignobles avec pause et exposition des motos.', address:'Place des Quinconces, Bordeaux', url:'https://example.com' },
    { id: 2,  title: 'Rassemblement youngtimers',         cat: 'auto',     sub: 'Salons et rencontres', city: 'Toulouse',         region: 'Occitanie',                    date: '2026-09-26', price: '3 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 3,  title: 'Course de côte de la vallée',       cat: 'auto',     sub: 'Course de côtes',      city: 'Grenoble',         region: 'Auvergne-Rhône-Alpes',         date: '2026-09-27', price: 'Gratuit', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 4,  title: 'Meeting aérien de fin de saison',   cat: 'aviation', sub: 'Show aérien',          city: 'Tours',            region: 'Centre-Val de Loire',          date: '2026-09-27', price: '8 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 5,  title: 'Motocross open',                    cat: 'moto',     sub: 'Motocross',            city: 'Béthune',          region: 'Hauts-de-France',              date: '2026-09-26', price: '10 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 6,  title: 'Randonnée quad en forêt',           cat: 'quad',     sub: 'Rando quad',           city: 'Épinal',           region: 'Grand Est',                    date: '2026-09-27', price: '25 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 7,  title: 'Trial truck',                       cat: 'truck',    sub: 'Trial Truck',          city: 'Dijon',            region: 'Bourgogne-Franche-Comté',      date: '2026-09-26', price: '5 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 8,  title: 'Régates de bateaux moteurs',        cat: 'nautisme', sub: 'Offshore',             city: 'La Rochelle',      region: 'Nouvelle-Aquitaine',           date: '2026-09-27', price: 'Gratuit', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 9,  title: 'Sortie 4x4 dans les volcans',       cat: 'auto',     sub: '4X4',                  city: 'Clermont-Ferrand', region: 'Auvergne-Rhône-Alpes',         date: '2026-09-27', price: '40 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 10, title: 'Salon du nautisme d\'automne',      cat: 'nautisme', sub: 'Salons et rencontres', city: 'Vannes',           region: 'Bretagne',                     date: '2026-09-26', price: '6 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 11, title: 'Journée de roulage sur circuit',    cat: 'auto',     sub: 'Track day/Roulage',    city: 'Magny-Cours',      region: 'Bourgogne-Franche-Comté',      date: '2026-10-03', price: '150 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 12, title: 'Vente aux enchères de youngtimers', cat: 'auto',     sub: 'Vente aux enchères',   city: 'Paris',            region: 'Île-de-France',                date: '2026-10-03', price: 'Gratuit', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 13, title: 'Bourse d\'échange moto',            cat: 'moto',     sub: 'Salons et rencontres', city: 'Lyon',             region: 'Auvergne-Rhône-Alpes',         date: '2026-10-04', price: '4 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 14, title: 'Show de stunt',                     cat: 'moto',     sub: 'Stunt',                city: 'Aix-en-Provence',  region: 'Provence-Alpes-Côte d\'Azur',  date: '2026-10-04', price: '12 €', organizer:'Association Motor’s Events', verified:true, description:'Événement automobile et mécanique ouvert aux passionnés et au public.', address:'Lieu communiqué par l’organisateur', url:'https://example.com' },
    { id: 15, title: 'Camion cross',                      cat: 'truck',    sub: 'Camion cross',         city: 'Strasbourg',       region: 'Grand Est',                    date: '2026-10-04', price: '8 €' }
  ];

  // Les événements de démonstration restent disponibles, puis les événements
  // approuvés de Supabase sont ajoutés/remplacés à leur arrivée.
  let ALL_EVENTS = [...EVENTS];

  const DEFAULT = { cat: 'all', what: '', where: '', when: 'weekend' };
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
    kids.forEach(k => n.append(k));
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
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const plural = n => (n > 1 ? 's' : '');

  const whatEl = $('#what'), whereEl = $('#where'), whenEl = $('#when');
  const tilesEl = $('#tiles'), cardsEl = $('#cards'), emptyEl = $('#empty');
  const countEl = $('#count'), resetTop = $('#resetTop');

  /* Catégories */
  Object.entries(CATS).forEach(([key, label]) => {
    const n = EVENTS.filter(e => e.cat === key).length;
    const b = el('button', { class: 'tile', type: 'button', 'aria-pressed': 'false', 'data-cat': key },
      el('span', { class: 'tile-icon' }, icon(key)),
      el('span', { class: 'tile-name', text: label }),
      el('span', { class: 'tile-desc', text: CAT_DESC[key] }),
      el('span', { class: 'tile-count', text: `${n} événement${plural(n)}` })
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

  /* Cartes */
  function card(e) {
    const day = fmt(e.date, { weekday: 'long', day: 'numeric', month: 'long' });
    const link = el('a', { href: '#', text: e.title, 'aria-label': `${e.title}, ${e.city}, ${day}` });
    link.addEventListener('click', ev => { ev.preventDefault(); openEvent(e.id); });
    const cover = el('div', { class: 'cover' },
      icon(e.cat, 'icon big'),
      el('div', { class: 'date' },
        el('small', { text: fmt(e.date, { weekday: 'short' }) }),
        el('b', { text: fmt(e.date, { day: 'numeric' }) }),
        el('small', { text: fmt(e.date, { month: 'short' }) })
      )
    );
    const body = el('div', { class: 'card-body' },
      el('p', { class: 'card-cat' }, icon(e.cat), `${CATS[e.cat]}, ${e.sub}`),
      el('h3', {}, link),
      el('p', { class: 'card-place' }, icon('pin'), `${e.city}, ${e.region}`),
      el('div', { class: 'card-foot' },
        el('span', { class: 'price', text: e.price }),
        el('span', { class: 'go' }, 'Voir l\'événement', icon('chevron'))
      )
    );
    return el('li', {}, el('article', { class: `card cat-${e.cat}` }, cover, body));
  }

  function render() {
    const w = WHEN[state.when];
    const what = norm(state.what.trim());
    const where = norm(state.where.trim());
    const items = ALL_EVENTS
      .filter(e => (state.cat === 'all' || e.cat === state.cat)
        && e.date >= w.from && e.date <= w.to
        && (!what || norm(`${e.title} ${e.sub} ${CATS[e.cat]}`).includes(what))
        && (!where || norm(`${e.city} ${e.region}`).includes(where)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr'));

    cardsEl.replaceChildren(...items.map(card));
    emptyEl.hidden = items.length > 0;

    const n = items.length;
    const cat = state.cat === 'all' ? '' : ` (${CATS[state.cat]})`;
    countEl.textContent = n === 0 ? 'Aucun événement' : `${n} événement${plural(n)} ${w.label}${cat}`;

    tilesEl.querySelectorAll('.tile').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.cat === state.cat)));
    whatEl.value = state.what;
    whereEl.value = state.where;
    whenEl.value = state.when;
    resetTop.hidden = Object.keys(DEFAULT).every(k => state[k] === DEFAULT[k]);
  }

  /* Recherche */
  whatEl.addEventListener('input', () => { state.what = whatEl.value; render(); });
  whereEl.addEventListener('input', () => { state.where = whereEl.value; render(); });
  whenEl.addEventListener('change', () => { state.when = whenEl.value; render(); });
  $('#search').addEventListener('submit', ev => { ev.preventDefault(); $('#results').scrollIntoView(); });
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
  $('#f-img').addEventListener('change', () => {
    const file = $('#f-img').files?.[0];
    if (!file) return;
    const allowed = new Set(['image/jpeg','image/png','image/webp']);
    if (!allowed.has(file.type) || file.size > 5 * 1024 * 1024) {
      $('#f-img').value = '';
      alert('Image refusée : JPG, PNG ou WebP uniquement, 5 Mo maximum.');
    }
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
  function toggleFav(id){ const f=getFavs(); const i=f.indexOf(id); i>=0?f.splice(i,1):f.push(id); setFavs(f); }
  function updateFavCount(){ $('#favCount').textContent=getFavs().length; }

  const eventDlg=$('#eventDlg'), eventDetail=$('#eventDetail');
  const safeExternalUrl = value => {
    try {
      const u = new URL(String(value || ''), location.origin);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return u.href;
    } catch (_) { return null; }
  };
  function openEvent(id){
    const e=ALL_EVENTS.find(x=>x.id===id); if(!e) return;
    const fav=isFav(id);
    eventDetail.replaceChildren();
    const hero=el('div',{class:'event-detail-hero'},
      el('span',{class:'featured-badge',text:CATS[e.cat]}),
      el('h2',{text:e.title}),
      el('p',{text:`${e.city} · ${fmt(e.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}`})
    );
    const content=el('div',{class:'event-detail-content'});
    const layout=el('div',{class:'detail-layout'});
    const left=el('div');
    left.append(el('div',{class:'detail-box'},
      el('h3',{text:'À propos'}), el('p',{text:e.description}),
      el('div',{class:'detail-actions'},
        el('button',{class:`btn btn-line ${fav?'favorite-active':''}`,type:'button',text:fav?'♥ Retirer des favoris':'♡ Ajouter aux favoris'}),
        el('button',{class:'btn btn-line',type:'button',text:'Partager'}),
        ...(safeExternalUrl(e.url) ? [el('a',{class:'btn btn-orange',href:safeExternalUrl(e.url),target:'_blank',rel:'noopener noreferrer',referrerpolicy:'no-referrer',text:'Site officiel'})] : [])
      )
    ));
    const shareBtn=left.querySelectorAll('button')[1];
    const favBtn=left.querySelectorAll('button')[0];
    favBtn.addEventListener('click',()=>{toggleFav(id);openEvent(id);});
    shareBtn.addEventListener('click',async()=>{ const data={title:e.title,text:`${e.title} — Motor's Events`,url:location.href}; if(navigator.share){try{await navigator.share(data)}catch(_){}} else {await navigator.clipboard?.writeText(location.href); shareBtn.textContent='Lien copié';} });
    left.append(el('div',{class:'detail-box'},
      el('h3',{text:'Photos'}), el('div',{class:'gallery'}, el('div'),el('div'),el('div'))
    ));
    const right=el('aside');
    const org=el('div',{class:'detail-box'},el('h3',{text:'Organisateur'}),el('div',{class:'organizer'},el('div',{class:'organizer-avatar',text:(e.organizer||'ME').slice(0,2).toUpperCase()}),el('div',{},el('strong',{text:e.organizer||'Organisateur'}),e.verified?el('span',{class:'verified',text:'✓ Organisateur vérifié'}):null)));
    right.append(org);
    const infoBox = el('div',{class:'detail-box'});
    infoBox.append(el('h3',{text:'Informations'}));
    const meta = el('div',{class:'detail-meta'});
    meta.append(
      el('div',{},el('strong',{text:'📅'}),el('span',{text:fmt(e.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})})),
      el('div',{},el('strong',{text:'📍'}),el('span',{text:e.address || `${e.city}, ${e.region}`})),
      el('div',{},el('strong',{text:'🎟'}),el('span',{text:e.price}))
    );
    infoBox.append(meta);
    right.append(infoBox);
    layout.append(left,right); content.append(layout); eventDetail.append(hero,content); eventDlg.showModal();
  }
  eventDlg.addEventListener('click',ev=>{if(ev.target===eventDlg)eventDlg.close()});

  function renderFeatured(){
    const top=ALL_EVENTS.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
    $('#featuredGrid').replaceChildren(...top.map(e=>el('article',{class:'featured-item',tabindex:'0'},el('span',{class:'featured-badge',text:'À LA UNE'}),el('h3',{text:e.title}),el('p',{text:`${e.city} · ${fmt(e.date,{day:'numeric',month:'long'})}`}))));
    $('#featuredGrid').querySelectorAll('.featured-item').forEach((n,i)=>{n.addEventListener('click',()=>openEvent(top[i].id));n.addEventListener('keydown',ev=>{if(ev.key==='Enter')openEvent(top[i].id)})});
  }
  function renderCalendar(){
    const groups={}; ALL_EVENTS.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>(groups[e.date]??=[]).push(e));
    $('#calendarGrid').replaceChildren(...Object.entries(groups).map(([date,items])=>el('article',{class:'calendar-day'},el('div',{class:'calendar-day-head'},el('b',{text:fmt(date,{weekday:'long'})}),el('span',{text:fmt(date,{day:'numeric',month:'long',year:'numeric'})})),el('div',{class:'calendar-events'},...items.map(e=>el('button',{class:'calendar-event',type:'button'},el('strong',{text:e.title}),el('small',{text:`${e.city} · ${e.price}`})))))));
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
  updateFavCount(); renderFeatured();

  window.addEventListener('motors:supabase-events', ev => {
    const incoming = Array.isArray(ev.detail) ? ev.detail : [];
    const demo = EVENTS.filter(e => e.source !== 'supabase');
    ALL_EVENTS = [...demo, ...incoming];
    renderFeatured();
    renderCalendar();
    updateFavCount();
    render();
  });

  render();
})();