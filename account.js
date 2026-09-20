import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

(() => {
  'use strict';

  const cfg = window.ME_SUPABASE_CONFIG || {};
  const configured = /^https:\/\/[^\s]+\.supabase\.co$/.test(cfg.url || '')
    && String(cfg.publishableKey || '').startsWith('sb_')
    && !String(cfg.publishableKey).includes('YOUR_');

  const $ = (s, r = document) => r.querySelector(s);
  const safeText = (v, max = 5000) => String(v ?? '').trim().slice(0, max);
  const allowedImage = file => file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024;
  const validUrl = value => {
    if (!value) return true;
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  };

  const REGIONS = ['', 'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d’Azur', 'Guadeloupe', 'Guyane', 'La Réunion', 'Martinique', 'Mayotte'];
  const CATS = {
    auto: ['4X4', 'Circuit', 'Course de côtes', 'Rallye', 'Régularité', 'Salons et rencontres', 'Sortie/Balade', 'Track day/Roulage', 'Vente aux enchères', 'VHC'],
    moto: ['Circuit', 'Enduro', 'Motocross', 'Salons et rencontres', 'Sortie/Balade', 'Stunt', 'Track day/Roulage', 'Trial'],
    quad: ['Baja', 'Course sable', 'Quad cross', 'Rando quad', 'Sortie/Balade'],
    truck: ['Camion circuit', 'Camion cross', 'Salons et rencontres', 'Trial Truck'],
    nautisme: ['Inshore', 'Offshore', 'Plaisance', 'Salons et rencontres', 'Sortie/Balade'],
    aviation: ['Rallye', 'Salons et rencontres', 'Show aérien', 'Stage/Baptême', 'Voltige']
  };

  let supabase = null;
  let session = null;
  let profile = null;
  let accountDialog = null;
  let profileDialog = null;
  let adminDialog = null;
  let publicProfileDialog = null;
  let authMode = 'login';
  let editingEventId = null;

  function notify(message, good = false) {
    const box = document.createElement('div');
    box.className = 'me-toast';
    box.textContent = message;
    if (good) box.classList.add('good');
    document.body.append(box);
    setTimeout(() => box.remove(), 3800);
  }

  function modalBase(id, title) {
    const d = document.createElement('dialog');
    d.id = id;
    d.className = 'me-dialog';
    const head = document.createElement('div');
    head.className = 'dlg-head';
    const h = document.createElement('h2'); h.textContent = title;
    const close = document.createElement('button');
    close.className = 'dialog-x'; close.type = 'button'; close.setAttribute('aria-label', 'Fermer'); close.textContent = '×';
    close.addEventListener('click', () => d.close());
    head.append(h, close); d.append(head);
    return d;
  }

  function buildAuthDialog() {
    const d = modalBase('authDlg', 'Votre compte');
    const body = document.createElement('div'); body.className = 'dlg-body';
    const intro = document.createElement('p'); intro.className = 'me-muted';
    intro.textContent = 'Connectez-vous pour publier des événements et gérer votre profil.';
    body.append(intro);

    const tabs = document.createElement('div'); tabs.className = 'me-tabs';
    const loginTab = document.createElement('button'); loginTab.type = 'button'; loginTab.textContent = 'Connexion';
    const signupTab = document.createElement('button'); signupTab.type = 'button'; signupTab.textContent = 'Créer un compte';
    tabs.append(loginTab, signupTab); body.append(tabs);

    const form = document.createElement('form'); form.className = 'me-form';
    const displayWrap = field('Nom affiché', 'me-display', 'text', 'name');
    const usernameWrap = field('Pseudo', 'me-username', 'text', 'nickname');
    usernameWrap.querySelector('input').pattern = '[A-Za-z0-9_-]{3,30}';
    const emailWrap = field('Email', 'me-email', 'email', 'email'); emailWrap.querySelector('input').required = true;
    const passWrap = field('Mot de passe', 'me-password', 'password', 'current-password'); passWrap.querySelector('input').minLength = 8; passWrap.querySelector('input').maxLength = 128; passWrap.querySelector('input').required = true;
    const submit = document.createElement('button'); submit.className = 'btn btn-orange'; submit.type = 'submit';
    const reset = document.createElement('button'); reset.className = 'link-btn auth-reset'; reset.type = 'button'; reset.textContent = 'Mot de passe oublié ?';
    const status = document.createElement('p'); status.className = 'me-status'; status.setAttribute('aria-live', 'polite');
    form.append(displayWrap, usernameWrap, emailWrap, passWrap, submit, reset, status);
    body.append(form); d.append(body); document.body.append(d);

    const sync = () => {
      const signup = authMode === 'signup';
      displayWrap.hidden = !signup; usernameWrap.hidden = !signup;
      submit.textContent = signup ? 'Créer mon compte' : 'Se connecter';
      passWrap.querySelector('input').autocomplete = signup ? 'new-password' : 'current-password';
      reset.hidden = signup;
      loginTab.classList.toggle('active', !signup); signupTab.classList.toggle('active', signup);
      status.textContent = '';
    };
    loginTab.addEventListener('click', () => { authMode = 'login'; sync(); });
    signupTab.addEventListener('click', () => { authMode = 'signup'; sync(); });

    reset.addEventListener('click', async () => {
      const email = safeText($('#me-email', form).value, 254).toLowerCase();
      if (!email) { status.textContent = 'Indique ton adresse email avant de demander la réinitialisation.'; return; }
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.href });
      status.textContent = error ? 'Impossible d’envoyer le lien pour le moment.' : 'Lien de réinitialisation envoyé si cette adresse existe.';
    });

    form.addEventListener('submit', async ev => {
      ev.preventDefault(); status.textContent = '';
      if (!supabase) return;
      const email = safeText($('#me-email', form).value, 254).toLowerCase();
      const password = $('#me-password', form).value;
      if (authMode === 'signup') {
        const display_name = safeText($('#me-display', form).value, 100) || 'Membre Motor\'s Events';
        const username = safeText($('#me-username', form).value, 30).toLowerCase();
        if (!/^[a-z0-9_-]{3,30}$/.test(username)) { status.textContent = 'Le pseudo doit contenir 3 à 30 caractères : lettres, chiffres, _ ou -.'; return; }
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username, display_name } } });
        if (error) { status.textContent = error.message; return; }
        if (data.session) { d.close(); await refresh(); }
        else status.textContent = 'Compte créé. Vérifie ton email pour confirmer ton adresse.';
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { status.textContent = 'Email ou mot de passe incorrect.'; return; }
        d.close(); await refresh();
      }
    });
    sync();
    return d;
  }

  function field(label, id, type = 'text', autocomplete = '') {
    const wrap = document.createElement('div'); wrap.className = 'full';
    const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
    const input = document.createElement('input'); input.id = id; input.type = type; input.maxLength = type === 'email' ? 254 : 100; if (autocomplete) input.autocomplete = autocomplete;
    wrap.append(lab, input); return wrap;
  }

  function buildProfileDialog() {
    const d = modalBase('profileDlg', 'Mon espace');
    d.classList.add('profile-dialog');
    const body = document.createElement('div'); body.className = 'dlg-body me-space';

    const head = document.createElement('section'); head.className = 'profile-hero';
    const avatar = document.createElement('div'); avatar.className = 'me-avatar profile-avatar-large'; avatar.id = 'me-avatar';
    const identity = document.createElement('div'); identity.className = 'profile-identity';
    const name = document.createElement('h3'); name.id = 'me-name'; name.textContent = 'Mon profil';
    const handle = document.createElement('p'); handle.id = 'me-email-view'; handle.className = 'me-muted';
    const stats = document.createElement('div'); stats.className = 'profile-stats';
    [['profileFollowers','Abonnés'],['profileFollowing','Abonnements'],['profileWishCount','Wishlist']].forEach(([id,label]) => {
      const item=document.createElement('div'); const value=document.createElement('strong'); value.id=id; value.textContent='0'; const lab=document.createElement('span'); lab.textContent=label; item.append(value,lab); stats.append(item);
    });
    identity.append(name, handle, stats); head.append(avatar, identity);
    const logout = document.createElement('button'); logout.className='btn btn-line profile-logout'; logout.type='button'; logout.textContent='Se déconnecter'; head.append(logout);
    body.append(head);

    const tabs=document.createElement('div'); tabs.className='profile-tabs';
    [['overview','Profil'],['wishlist','♡ Wishlist'],['following','Abonnements'],['events','Mes événements']].forEach(([key,label],i)=>{
      const b=document.createElement('button'); b.type='button'; b.dataset.profileTab=key; b.textContent=label; if(!i)b.classList.add('active'); tabs.append(b);
    });
    body.append(tabs);

    const overview=document.createElement('section'); overview.dataset.profilePanel='overview'; overview.className='profile-panel-grid';
    const panel=document.createElement('section'); panel.className='me-panel profile-edit-panel';
    const ph=document.createElement('div'); ph.className='panel-title-row'; const pt=document.createElement('div'); const ptitle=document.createElement('h3'); ptitle.textContent='Informations publiques'; const psub=document.createElement('p'); psub.className='me-muted'; psub.textContent='Ces informations peuvent être visibles par les autres membres.'; pt.append(ptitle,psub); ph.append(pt);
    const form=document.createElement('form'); form.id='profileForm'; form.className='me-form';
    const mk=(label,id,type='text',placeholder='')=>{const w=document.createElement('div'); const l=document.createElement('label'); l.htmlFor=id; l.textContent=label; const i=document.createElement('input'); i.id=id;i.type=type;i.maxLength=type==='url'?300:120;if(placeholder)i.placeholder=placeholder;w.append(l,i);return w;};
    form.append(mk('Nom affiché','p-display'),mk('Pseudo','p-username'),mk('Ville','p-city'));
    const rw=document.createElement('div'); const rl=document.createElement('label'); rl.htmlFor='p-region';rl.textContent='Région';const rs=document.createElement('select');rs.id='p-region';rw.append(rl,rs);form.append(rw);
    const bio=mk('Bio','p-bio'); bio.classList.add('full'); bio.querySelector('input').remove(); const ta=document.createElement('textarea');ta.id='p-bio';ta.maxLength=500;bio.append(ta);form.append(bio);
    const web=mk('Site web','p-website','url','https://'); web.classList.add('full'); form.append(web);
    const av=document.createElement('div');av.className='full';const al=document.createElement('label');al.htmlFor='p-avatar';al.textContent='Photo de profil';const af=document.createElement('input');af.id='p-avatar';af.type='file';af.accept='image/jpeg,image/png,image/webp';const ah=document.createElement('small');ah.textContent='JPG, PNG ou WebP — 5 Mo maximum.';av.append(al,af,ah);form.append(av);
    const save=document.createElement('button');save.className='btn btn-orange';save.type='submit';save.textContent='Enregistrer mon profil';form.append(save);
    const status=document.createElement('p');status.id='profileStatus';status.className='me-status';status.setAttribute('aria-live','polite');form.append(status);
    panel.append(ph,form);
    const side=document.createElement('aside');side.className='me-panel profile-side-panel';
    side.append(el('div',{class:'profile-side-icon',text:'⌁'}),el('h3',{text:'Construisez votre réseau'}),el('p',{class:'me-muted',text:'Suivez les organisateurs que vous aimez et retrouvez leurs prochains événements dans vos abonnements.'}));
    const manage=document.createElement('div');manage.className='profile-side-links';
    [['wishlist','♡','Ma wishlist','Enregistrez les rassos à ne pas manquer'],['following','＋','Mes abonnements','Retrouvez vos organisateurs suivis']].forEach(([tab,iconTxt,titleTxt,desc])=>{const b=document.createElement('button');b.type='button';b.dataset.goProfileTab=tab;b.append(el('span',{class:'side-link-icon',text:iconTxt}),el('span',{},el('strong',{text:titleTxt}),el('small',{text:desc})));manage.append(b);});
    side.append(manage); overview.append(panel,side); body.append(overview);

    const wishlist=document.createElement('section');wishlist.dataset.profilePanel='wishlist';wishlist.className='profile-list-panel';wishlist.hidden=true;
    const wishHead = el('div',{class:'panel-title-row'}, el('div',{}, el('h3',{text:'Ma wishlist'}), el('p',{class:'me-muted',text:'Les événements que vous avez enregistrés.'}))); const wishBox=document.createElement('div'); wishBox.className='social-list'; wishBox.id='profileWishlist'; wishlist.append(wishHead,wishBox); body.append(wishlist);

    const following=document.createElement('section');following.dataset.profilePanel='following';following.className='profile-list-panel';following.hidden=true;
    const followHead = el('div',{class:'panel-title-row'}, el('div',{}, el('h3',{text:'Mes abonnements'}), el('p',{class:'me-muted',text:'Les organisateurs et passionnés que vous suivez.'}))); const followBox=document.createElement('div'); followBox.className='social-list'; followBox.id='profileFollowing'; following.append(followHead,followBox); body.append(following);

    const events=document.createElement('section');events.dataset.profilePanel='events';events.className='profile-list-panel';events.hidden=true;
    const eh=document.createElement('div');eh.className='panel-title-row';eh.append(el('div',{},el('h3',{text:'Mes événements'}),el('p',{class:'me-muted',text:'Suivez vos annonces et leur validation.'})));const add=document.createElement('button');add.id='me-add-event';add.className='btn btn-orange';add.type='button';add.textContent='Ajouter un événement';eh.append(add);events.append(eh);const my=document.createElement('div');my.id='myEvents';my.className='my-events';events.append(my);body.append(events);

    d.append(body);
    const regionSelect=$('#p-region',d); REGIONS.forEach(r=>{const o=document.createElement('option');o.value=r;o.textContent=r||'Région';regionSelect.append(o);});
    const activateTab=(key)=>{d.querySelectorAll('[data-profile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.profileTab===key));d.querySelectorAll('[data-profile-panel]').forEach(p=>p.hidden=p.dataset.profilePanel!==key);if(key==='wishlist')renderWishlist();if(key==='following')renderFollowing();if(key==='events')renderMyEvents();};
    d.querySelectorAll('[data-profile-tab]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.profileTab)));
    d.querySelectorAll('[data-go-profile-tab]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.goProfileTab)));
    logout.addEventListener('click',async()=>{await supabase.auth.signOut();d.close();});
    add.addEventListener('click',()=>{d.close();openAddForAuthenticated();});
    form.addEventListener('submit',saveProfile);
    af.addEventListener('change',ev=>{if(ev.target.files[0]&&!allowedImage(ev.target.files[0])){ev.target.value='';notify('Image refusée : JPG, PNG ou WebP, 5 Mo maximum.');}});
    return d;
  }

  function el(tag, attrs={}, ...children){
    const n=document.createElement(tag); Object.entries(attrs||{}).forEach(([k,v])=>{if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k.startsWith('data-'))n.setAttribute(k,v);else n.setAttribute(k,v);});
    children.flat().forEach(c=>{if(c)n.append(c)}); return n;
  }

  function buildPublicProfileDialog(){
    const d=modalBase('publicProfileDlg','Profil'); d.classList.add('public-profile-dialog'); const body=document.createElement('div');body.className='dlg-body';body.id='publicProfileBody';body.append(el('div',{class:'public-profile-loading',text:'Chargement du profil…'}));d.append(body);return d;
  }

  function buildAdminDialog() {
    const d = modalBase('adminDlg', 'Modération');
    const body = document.createElement('div'); body.className = 'dlg-body';
    const intro = document.createElement('p'); intro.className = 'me-muted'; intro.textContent = 'Valide ou refuse les événements envoyés par les organisateurs.';
    const list = document.createElement('div'); list.id = 'adminEvents'; list.className = 'my-events';
    body.append(intro, list); d.append(body); document.body.append(d);
    return d;
  }

  function renderAccountButton() {
    const b = $('#accountBtn');
    const favorites = $('#favoritesBtn');
    const alerts = $('#alertsBtn');
    const headerAdd = $('#headerAddBtn');
    if (!b) return;

    // Les fonctions réservées aux membres restent totalement masquées
    // tant qu'aucune session Supabase n'est active.
    const connected = Boolean(session);
    if (favorites) favorites.hidden = !connected;
    if (alerts) alerts.hidden = !connected;
    if (headerAdd) headerAdd.hidden = !connected;

    if (connected) {
      b.textContent = profile?.display_name
        ? `👤 ${profile.display_name.slice(0, 18)}`
        : '👤 Mon profil';
      b.setAttribute('aria-label', 'Mon profil');
      b.classList.add('connected');
    } else {
      // Le seul bouton conservé hors connexion permet d'ouvrir la connexion.
      b.textContent = 'Se connecter';
      b.setAttribute('aria-label', 'Se connecter');
      b.classList.remove('connected');
    }
  }

  async function loadProfile() {
    if (!session) { profile = null; return; }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) { console.error(error); return; }
    profile = data;
  }

  async function loadApprovedEvents() {
    const { data, error } = await supabase.from('events').select('id,title,category,subtype,start_date,end_date,place,city,region,description,official_url,image_url,user_id,status').eq('status', 'approved').order('start_date', { ascending: true }).limit(200);
    if (error) { console.warn('Impossible de charger les événements Supabase:', error.message); return; }
    const rows = data || [];
    const ids = [...new Set(rows.map(e => e.user_id).filter(Boolean))];
    let profiles = {};
    if (ids.length) {
      const result = await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids);
      (result.data || []).forEach(p => { profiles[p.id] = p; });
    }
    const mapped = rows.map(e => ({
      id: 1000000000 + Number(e.id), dbId: e.id, title: e.title, cat: e.category, sub: e.subtype,
      city: e.city, region: e.region, date: e.start_date, price: 'Voir organisateur',
      organizer: profiles[e.user_id]?.display_name || profiles[e.user_id]?.username || 'Organisateur',
      verified: false, description: e.description, address: e.place, url: e.official_url || '', image_url: e.image_url || '', source: 'supabase'
    }));
    window.dispatchEvent(new CustomEvent('motors:supabase-events', { detail: mapped }));
  }

  async function refresh() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    session = data.session;
    await loadProfile();
    await loadSocialState();
    renderAccountButton();
    await loadApprovedEvents();
    await loadTopMembers();
    if (session && profile?.role && ['admin', 'moderator'].includes(profile.role)) {
      document.body.classList.add('is-admin');
    } else document.body.classList.remove('is-admin');
  }


  async function loadSocialState(){
    if(!session) return;
    const {data:favs}=await supabase.from('favorites').select('event_id').eq('user_id',session.user.id);
    const local=JSON.parse(localStorage.getItem('motors-events-favorites-v1')||'[]');
    const dbIds=(favs||[]).map(x=>1000000000+Number(x.event_id));
    try{localStorage.setItem('motors-events-favorites-v1',JSON.stringify([...new Set([...local,...dbIds])].filter(Number.isInteger).slice(0,200)));}catch(_){ }
    const {data:following}=await supabase.from('follows').select('following_id').eq('follower_id',session.user.id);
    window.ME_SOCIAL_FOLLOWING=new Set((following||[]).map(x=>x.following_id));
  }

  async function toggleFavorite(event){
    if(!session){notify('Connectez-vous pour enregistrer un événement dans votre wishlist.');accountDialog.showModal();return false;}
    if(event.source==='supabase' && event.dbId){
      const active=isFavoriteLocal(event.id);
      const result=active?await supabase.from('favorites').delete().eq('user_id',session.user.id).eq('event_id',event.dbId):await supabase.from('favorites').insert({user_id:session.user.id,event_id:event.dbId});
      if(result.error){notify(result.error.message);return active;}
      setFavoriteLocal(event.id,!active);
      notify(!active?'Événement ajouté à votre wishlist.':'Événement retiré de votre wishlist.',true);
      if(profileDialog?.open) updateProfileCounts();
      return !active;
    }
    const active=isFavoriteLocal(event.id); setFavoriteLocal(event.id,!active); return !active;
  }
  function isFavoriteLocal(id){try{const a=JSON.parse(localStorage.getItem('motors-events-favorites-v1')||'[]');return Array.isArray(a)&&a.includes(id);}catch(_){return false;}}
  function setFavoriteLocal(id,on){try{const a=Array.isArray(JSON.parse(localStorage.getItem('motors-events-favorites-v1')||'[]'))?JSON.parse(localStorage.getItem('motors-events-favorites-v1')||'[]'):[];const next=on?[...new Set([...a,id])]:a.filter(x=>x!==id);localStorage.setItem('motors-events-favorites-v1',JSON.stringify(next));window.dispatchEvent(new CustomEvent('motors:favorites-changed'));}catch(_){}}

  async function followUser(userId){
    if(!session){notify('Connectez-vous pour suivre un membre.');accountDialog.showModal();return false;}
    if(userId===session.user.id){notify('Vous ne pouvez pas vous suivre vous-même.');return false;}
    const following=window.ME_SOCIAL_FOLLOWING||new Set(); const active=following.has(userId);
    const result=active?await supabase.from('follows').delete().eq('follower_id',session.user.id).eq('following_id',userId):await supabase.from('follows').insert({follower_id:session.user.id,following_id:userId});
    if(result.error){notify(result.error.message);return active;}
    if(active)following.delete(userId);else following.add(userId);window.ME_SOCIAL_FOLLOWING=following;
    return !active;
  }

  async function socialCount(userId,type){
    if(!supabase) return 0;
    const {data,error}=await supabase.rpc('get_follow_counts',{target_user:userId});
    if(error || !data?.length) return 0;
    return Number(type==='followers'?data[0].followers:data[0].following)||0;
  }

  async function updateProfileCounts(){
    if(!profile||!session)return;
    const [followers,following]=await Promise.all([socialCount(session.user.id,'followers'),socialCount(session.user.id,'following')]);
    const favs=(()=>{try{return JSON.parse(localStorage.getItem('motors-events-favorites-v1')||'[]')}catch(_){return[]}})();
    $('#profileFollowers').textContent=followers;$('#profileFollowing').textContent=following;$('#profileWishCount').textContent=favs.length;
  }

  async function renderWishlist(){
    const box=$('#profileWishlist');if(!box||!session)return;box.textContent='Chargement…';
    const {data:favs,error}=await supabase.from('favorites').select('event_id,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false});box.replaceChildren();
    if(error){box.textContent=error.message;return;} if(!favs?.length){box.append(el('div',{class:'social-empty'},el('strong',{text:'Votre wishlist est vide'}),el('p',{text:'Ouvrez un événement et appuyez sur ♡ pour le garder sous la main.'})));return;}
    const ids=favs.map(x=>x.event_id);const {data:events}=await supabase.from('events').select('id,title,category,subtype,start_date,city,region,image_url,status,user_id').in('id',ids).order('start_date',{ascending:true});
    (events||[]).forEach(e=>{const row=el('article',{class:'social-card'},e.image_url?el('img',{src:e.image_url,alt:'',loading:'lazy'}):el('div',{class:'social-card-placeholder',text:'ME'}),el('div',{},el('strong',{text:e.title}),el('p',{text:`${e.city} · ${e.region} · ${fmtDateShort(e.start_date)}`}),el('small',{text:e.status==='approved'?'Publié':'En attente'})));row.addEventListener('click',()=>{const closeBtn=dummy=>dummy;window.dispatchEvent(new CustomEvent('motors:open-db-event',{detail:e.id}));});box.append(row);});
  }
  function fmtDateShort(date){try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00`));}catch(_){return date||'';}}

  async function renderFollowing(){
    const box=$('#profileFollowing');if(!box||!session)return;box.textContent='Chargement…';const {data, error}=await supabase.from('follows').select('following_id,created_at').eq('follower_id',session.user.id).order('created_at',{ascending:false});box.replaceChildren();if(error){box.textContent=error.message;return;}if(!data?.length){box.append(el('div',{class:'social-empty'},el('strong',{text:'Aucun abonnement'}),el('p',{text:'Depuis le profil d’un organisateur, choisissez Suivre pour créer votre réseau.'})));return;}
    const ids=data.map(x=>x.following_id);const {data:profiles}=await supabase.from('profiles').select('id,display_name,username,city,region,avatar_url,bio').in('id',ids);const map=Object.fromEntries((profiles||[]).map(p=>[p.id,p]));
    ids.forEach(id=>{const p=map[id];if(!p)return;const row=el('article',{class:'social-card profile-follow-card'},p.avatar_url?el('img',{src:p.avatar_url,alt:'',loading:'lazy'}):el('div',{class:'social-card-placeholder',text:(p.display_name||'ME').slice(0,2).toUpperCase()}),el('div',{},el('strong',{text:p.display_name||p.username||'Membre'}),el('p',{text:p.city?`${p.city}${p.region?' · '+p.region:''}`:'Membre Motor\'s Events'}),el('small',{text:p.bio||'Organisateur / passionné'})));row.addEventListener('click',()=>openPublicProfile(id));box.append(row);});
  }

  async function openPublicProfile(userId){
    if(!publicProfileDialog)publicProfileDialog=buildPublicProfileDialog();const box=$('#publicProfileBody');box.replaceChildren(el('div',{class:'public-profile-loading',text:'Chargement du profil…'}));publicProfileDialog.showModal();
    const [{data:p,error},followers,following]=await Promise.all([supabase.from('profiles').select('id,display_name,username,bio,city,region,website,avatar_url').eq('id',userId).maybeSingle(),socialCount(userId,'followers'),socialCount(userId,'following')]);
    if(error||!p){box.replaceChildren(el('p',{text:'Profil introuvable.'}));return;}
    const isSelf=session?.user?.id===userId;const followed=window.ME_SOCIAL_FOLLOWING?.has(userId);const hero=el('section',{class:'public-profile-hero'},p.avatar_url?el('img',{src:p.avatar_url,alt:'',class:'public-avatar'}):el('div',{class:'public-avatar public-avatar-fallback',text:(p.display_name||'ME').slice(0,2).toUpperCase()}),el('div',{},el('span',{class:'profile-kicker',text:'Membre Motor\'s Events'}),el('h2',{text:p.display_name||p.username||'Membre'}),el('p',{class:'public-handle',text:p.username?`@${p.username}`:''}),el('p',{class:'public-location',text:[p.city,p.region].filter(Boolean).join(' · ')})),el('div',{class:'public-profile-action'}));
    if(!isSelf){const b=el('button',{class:`btn ${followed?'btn-line':'btn-orange'}`,type:'button',text:followed?'✓ Abonné':'Suivre'});b.addEventListener('click',async()=>{const now=await followUser(userId);b.textContent=now?'✓ Abonné':'Suivre';b.className=`btn ${now?'btn-line':'btn-orange'}`;});hero.querySelector('.public-profile-action').append(b);}
    const stats=el('div',{class:'public-stats'},el('div',{},el('strong',{text:String(followers)}),el('span',{text:'Abonnés'})),el('div',{},el('strong',{text:String(following)}),el('span',{text:'Abonnements'})));
    const content=el('div',{class:'public-profile-content'},el('p',{text:p.bio||'Aucune bio renseignée.'}),p.website?el('a',{href:validUrl(p.website)?p.website:'#',target:'_blank',rel:'noopener noreferrer',referrerpolicy:'no-referrer',text:'Visiter le site'}):null);
    box.replaceChildren(hero,stats,content);
  }

  function renderProfile() {
    if (!profile) return;
    $('#me-name').textContent = profile.display_name || 'Mon profil';
    $('#me-email-view').textContent = session?.user?.email || '';
    $('#p-display').value = profile.display_name || '';
    $('#p-username').value = profile.username || '';
    $('#p-city').value = profile.city || '';
    $('#p-region').value = profile.region || '';
    $('#p-bio').value = profile.bio || '';
    $('#p-website').value = profile.website || '';
    updateProfileCounts();
    const a = $('#me-avatar'); a.replaceChildren();
    if (profile.avatar_url) { const img = document.createElement('img'); img.src = profile.avatar_url; img.alt = ''; img.loading = 'lazy'; a.append(img); }
    else a.textContent = (profile.display_name || 'ME').slice(0, 2).toUpperCase();
  }

  async function saveProfile(ev) {
    ev.preventDefault();
    const status = $('#profileStatus'); status.textContent = '';
    if (!session) return;
    const display_name = safeText($('#p-display').value, 100) || 'Membre Motor\'s Events';
    const username = safeText($('#p-username').value, 30).toLowerCase();
    const website = safeText($('#p-website').value, 300);
    if (!/^[a-z0-9_-]{3,30}$/.test(username)) { status.textContent = 'Pseudo invalide.'; return; }
    if (!validUrl(website)) { status.textContent = 'Le site web doit commencer par http:// ou https://.'; return; }
    let avatar_url = profile?.avatar_url || null;
    const file = $('#p-avatar').files?.[0];
    if (file) {
      if (!allowedImage(file)) { status.textContent = 'Image invalide.'; return; }
      const ext = file.type.split('/')[1];
      const path = `${session.user.id}/avatar-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) { status.textContent = up.error.message; return; }
      avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
    const payload = { id: session.user.id, display_name, username, city: safeText($('#p-city').value, 120), region: safeText($('#p-region').value, 120), bio: safeText($('#p-bio').value, 500), website, avatar_url };
    const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
    if (error) { status.textContent = error.message.includes('profiles_username_key') ? 'Ce pseudo est déjà utilisé.' : error.message; return; }
    profile = data; status.textContent = 'Profil enregistré.'; renderProfile(); renderAccountButton();
  }

  async function renderMyEvents() {
    const box = $('#myEvents'); if (!box || !session) return;
    box.textContent = 'Chargement…';
    const { data, error } = await supabase.from('events').select('id,title,start_date,city,status,rejection_reason').eq('user_id', session.user.id).order('created_at', { ascending: false });
    box.replaceChildren();
    if (error) { box.textContent = error.message; return; }
    if (!data?.length) { box.textContent = 'Vous n’avez encore publié aucun événement.'; return; }
    data.forEach(e => {
      const row = document.createElement('article'); row.className = 'my-event';
      const title = document.createElement('strong'); title.textContent = e.title;
      const meta = document.createElement('small'); meta.textContent = `${e.city || 'Lieu non renseigné'} · ${e.start_date}`;
      const status = document.createElement('span'); status.className = `status status-${e.status}`; status.textContent = e.status === 'approved' ? 'Publié' : e.status === 'rejected' ? 'Refusé' : 'En attente';
      const actions = document.createElement('div'); actions.className = 'my-event-actions';
      if (e.status !== 'approved') {
        const edit = document.createElement('button'); edit.className = 'link-btn'; edit.type = 'button'; edit.textContent = 'Modifier'; edit.addEventListener('click', () => openEditEvent(e.id)); actions.append(edit);
      }
      const del = document.createElement('button'); del.className = 'link-btn danger'; del.type = 'button'; del.textContent = 'Supprimer'; del.addEventListener('click', () => deleteEvent(e.id)); actions.append(del);
      row.append(title, meta, status, actions);
      if (e.rejection_reason) { const r = document.createElement('p'); r.textContent = `Motif : ${e.rejection_reason}`; row.append(r); }
      box.append(row);
    });
  }

  function openProfile() {
    if (!session) { authMode = 'login'; accountDialog.showModal(); return; }
    renderProfile(); renderMyEvents();
    $('#profileDlg .me-panel-head')?.querySelector('h3')?.parentElement?.parentElement;
    profileDialog.showModal();
  }

  function openAddForAuthenticated() {
    if (!session) { accountDialog.showModal(); return; }
    editingEventId = null;
    const dlg = $('#dlg'); if (!dlg) return;
    const form = $('#addForm'); form.reset();
    if ($('#f-region')) $('#f-region').value = '';
    $('#dlg-titre').textContent = 'Ajouter un événement';
    const submit = form.querySelector('button[type="submit"]'); if (submit) submit.textContent = 'Envoyer pour vérification';
    $('#done').hidden = true; form.hidden = false; dlg.showModal();
  }

  async function openEditEvent(id) {
    if (!session) return;
    const { data, error } = await supabase.from('events').select('*').eq('id', id).eq('user_id', session.user.id).maybeSingle();
    if (error || !data) { notify('Impossible de charger cet événement.'); return; }
    editingEventId = id;
    const dlg = $('#dlg'), form = $('#addForm');
    form.reset();
    $('#f-title').value = data.title || ''; $('#f-cat').value = data.category || 'auto'; $('#f-cat').dispatchEvent(new Event('change')); $('#f-sub').value = data.subtype || '';
    $('#f-start').value = data.start_date || ''; $('#f-end').value = data.end_date || ''; $('#f-place').value = data.place || ''; $('#f-city').value = data.city || ''; $('#f-region').value = data.region || ''; $('#f-desc').value = data.description || ''; $('#f-url').value = data.official_url || '';
    $('#dlg-titre').textContent = 'Modifier mon événement';
    const submit = form.querySelector('button[type="submit"]'); if (submit) submit.textContent = 'Enregistrer les modifications';
    $('#done').hidden = true; form.hidden = false; profileDialog.close(); dlg.showModal();
  }

  async function deleteEvent(id) {
    if (!session || !confirm('Supprimer définitivement cet événement ?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id).eq('user_id', session.user.id);
    if (error) notify(error.message); else { notify('Événement supprimé.', true); await renderMyEvents(); await loadApprovedEvents(); }
  }

  async function submitEvent(ev) {
    ev.preventDefault();
    if (!session) { notify('Connectez-vous pour publier un événement.'); accountDialog.showModal(); return; }
    const status = $('#eventSubmitStatus'); if (status) status.textContent = '';
    const title = safeText($('#f-title').value, 120), place = safeText($('#f-place').value, 200), city = safeText($('#f-city').value, 120), region = safeText($('#f-region').value, 120), desc = safeText($('#f-desc').value, 5000), url = safeText($('#f-url').value, 300);
    const start = $('#f-start').value, end = $('#f-end').value || null, category = $('#f-cat').value, subtype = $('#f-sub').value;
    if (!title || !place || !city || !region || !desc || !start) { notify('Remplissez tous les champs obligatoires.'); return; }
    if (end && end < start) { notify('La date de fin doit être après la date de début.'); return; }
    if (!validUrl(url)) { notify('Le lien officiel doit commencer par http:// ou https://.'); return; }
    const image = $('#f-img').files?.[0];
    let image_url = null;
    if (image) {
      if (!allowedImage(image)) { notify('Image refusée : JPG, PNG ou WebP, 5 Mo maximum.'); return; }
      const ext = image.type.split('/')[1];
      const path = `${session.user.id}/event-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from('event-images').upload(path, image, { contentType: image.type, upsert: false });
      if (up.error) { notify(up.error.message); return; }
      image_url = supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;
    }
  const payload = {
    title,
    category,
    subtype,
    start_date: start,
    end_date: end,
    starts_at: `${start}T00:00:00`,
    ends_at: end ? `${end}T23:59:59` : null,
    place,
    city,
    region,
    description: desc,
    official_url: url || null
  };

if (image_url) payload.image_url = image_url;
    let result;
    if (editingEventId) {
      result = await supabase.from('events').update(payload).eq('id', editingEventId).eq('user_id', session.user.id);
    } else {
      result = await supabase.from('events').insert({ ...payload, user_id: session.user.id, status: 'pending' });
    }
    if (result.error) { notify(result.error.message); return; }
    editingEventId = null; $('#dlg').close(); ev.currentTarget.reset();
    notify('Événement envoyé pour validation.', true); await refresh();
  }

  async function renderAdmin() {
    const box = $('#adminEvents'); if (!box || !session || !['admin', 'moderator'].includes(profile?.role)) return;
    box.textContent = 'Chargement…';
    const { data, error } = await supabase.from('events').select('id,title,category,subtype,start_date,city,region,description,official_url,image_url,user_id,status,rejection_reason,created_at').eq('status', 'pending').order('created_at', { ascending: true });
    box.replaceChildren();
    if (error) { box.textContent = error.message; return; }
    if (!data?.length) { box.textContent = 'Aucun événement en attente.'; return; }
    const ids = [...new Set(data.map(e => e.user_id))];
    const pr = await supabase.from('profiles').select('id,display_name,username').in('id', ids);
    const names = Object.fromEntries((pr.data || []).map(p => [p.id, p.display_name || p.username || 'Organisateur']));
    data.forEach(e => {
      const row = document.createElement('article'); row.className = 'my-event admin-event';
      const title = document.createElement('strong'); title.textContent = e.title;
      const meta = document.createElement('small'); meta.textContent = `${names[e.user_id] || 'Organisateur'} · ${e.city || ''} · ${e.start_date}`;
      const desc = document.createElement('p'); desc.className = 'admin-description'; desc.textContent = e.description;
      const actions = document.createElement('div'); actions.className = 'my-event-actions';
      const approve = document.createElement('button'); approve.className = 'btn btn-orange'; approve.type = 'button'; approve.textContent = 'Publier'; approve.addEventListener('click', () => moderate(e.id, 'approved'));
      const reject = document.createElement('button'); reject.className = 'link-btn danger'; reject.type = 'button'; reject.textContent = 'Refuser'; reject.addEventListener('click', () => moderate(e.id, 'rejected'));
      actions.append(approve, reject); row.append(title, meta, desc, actions); box.append(row);
    });
  }

  async function moderate(id, status) {
    if (!session || !['admin', 'moderator'].includes(profile?.role)) return;
    let rejection_reason = null;
    if (status === 'rejected') { rejection_reason = safeText(prompt('Motif du refus (facultatif)') || '', 500); }
    const { error } = await supabase.from('events').update({ status, rejection_reason }).eq('id', id);
    if (error) { notify(error.message); return; }
    notify(status === 'approved' ? 'Événement publié.' : 'Événement refusé.', true); await renderAdmin(); await loadApprovedEvents();
  }

  function renderMemberCard(p, extra = '') {
    const name = p.display_name || p.username || 'Membre';
    const initials = name.slice(0, 2).toUpperCase();
    const avatar = p.avatar_url
      ? el('img', { src: p.avatar_url, alt: '', loading: 'lazy' })
      : el('div', { class: 'member-avatar-fallback', text: initials });
    const meta = [p.city, p.region].filter(Boolean).join(' · ') || 'Membre Motor\'s Events';
    const card = el('article', { class: 'member-result-card' },
      el('div', { class: 'member-avatar' }, avatar),
      el('div', { class: 'member-result-main' },
        el('strong', { text: name }),
        p.username ? el('span', { text: `@${p.username}` }) : null,
        el('small', { text: meta }),
        extra ? el('em', { text: extra }) : null
      ),
      el('span', { class: 'member-arrow', text: '→' })
    );
    card.addEventListener('click', () => openPublicProfile(p.id));
    return card;
  }

  async function searchMembers(term) {
    const box = $('#memberResults');
    if (!box || !supabase) return;
    term = safeText(term, 60);
    box.replaceChildren();
    if (!term) {
      box.append(el('div', { class: 'community-empty' },
        el('strong', { text: 'Entrez un nom, un pseudo ou une ville' }),
        el('p', { text: 'Les profils publics Motor\'s Events apparaîtront ici.' })
      ));
      return;
    }
    box.append(el('div', { class: 'community-loading', text: 'Recherche…' }));
    const pattern = `%${term}%`;
    const [byName, byUsername, byCity] = await Promise.all([
      supabase.from('profiles').select('id,display_name,username,city,region,avatar_url,bio').ilike('display_name', pattern).limit(20),
      supabase.from('profiles').select('id,display_name,username,city,region,avatar_url,bio').ilike('username', pattern).limit(20),
      supabase.from('profiles').select('id,display_name,username,city,region,avatar_url,bio').ilike('city', pattern).limit(20)
    ]);
    const errors = [byName.error, byUsername.error, byCity.error].filter(Boolean);
    if (errors.length) {
      box.replaceChildren(el('div', { class: 'community-empty' }, el('strong', { text: 'Recherche indisponible' }), el('p', { text: errors[0].message })));
      return;
    }
    const map = new Map();
    [...(byName.data || []), ...(byUsername.data || []), ...(byCity.data || [])].forEach(p => map.set(p.id, p));
    const results = [...map.values()].slice(0, 12);
    if (!results.length) {
      box.append(el('div', { class: 'community-empty' }, el('strong', { text: 'Aucun membre trouvé' }), el('p', { text: 'Essaie un autre nom, pseudo ou ville.' })));
      return;
    }
    results.forEach(p => box.append(renderMemberCard(p)));
  }

  async function loadTopMembers() {
    const box = $('#topMembers');
    if (!box || !supabase) return;
    box.replaceChildren(el('div', { class: 'community-loading', text: 'Chargement…' }));
    const { data, error } = await supabase.rpc('get_top_publishers', { limit_count: 6 });
    if (error) {
      box.replaceChildren(el('div', { class: 'community-empty' }, el('strong', { text: 'Impossible de charger le classement' }), el('p', { text: error.message })));
      return;
    }
    if (!data?.length) {
      box.replaceChildren(el('div', { class: 'community-empty' }, el('strong', { text: 'Pas encore de classement' }), el('p', { text: 'Les membres apparaîtront ici après leurs premiers événements publiés.' })));
      return;
    }
    data.forEach((p, index) => {
      const rank = el('span', { class: 'member-rank', text: String(index + 1).padStart(2, '0') });
      const card = renderMemberCard(p, `${Number(p.event_count) || 0} événement${Number(p.event_count) > 1 ? 's' : ''} publié${Number(p.event_count) > 1 ? 's' : ''}`);
      card.prepend(rank);
      box.append(card);
    });
  }

  function wire() {
    accountDialog = buildAuthDialog();
    profileDialog = buildProfileDialog();
    adminDialog = buildAdminDialog();
    publicProfileDialog = buildPublicProfileDialog();

    // Les <dialog> créés dynamiquement doivent être attachés au document
    // avant l'appel à showModal(). Sans cela, le bouton Compte ne peut pas
    // ouvrir la fenêtre et le navigateur lève InvalidStateError.
    [accountDialog, profileDialog, publicProfileDialog].forEach(dialog => {
      if (dialog && !dialog.isConnected) document.body.appendChild(dialog);
    });

    $('#accountBtn')?.addEventListener('click', openProfile);
    document.querySelectorAll('[data-open-add]').forEach(b => b.addEventListener('click', ev => {
      if (!session) { ev.preventDefault(); setTimeout(() => { if ($('#dlg')?.open) $('#dlg').close(); accountDialog.showModal(); }, 0); }
    }));
    $('#addForm')?.addEventListener('submit', submitEvent);
    const fRegion = $('#f-region');
    if (fRegion) REGIONS.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r || 'Choisir une région'; fRegion.append(o); });
    $('#f-img')?.addEventListener('change', ev => { if (ev.target.files[0] && !allowedImage(ev.target.files[0])) { ev.target.value = ''; notify('Image refusée : JPG, PNG ou WebP, 5 Mo maximum.'); } });
    $('#profileDlg')?.addEventListener('close', () => { editingEventId = null; });
    const adminButton = document.createElement('button'); adminButton.className = 'btn btn-orange admin-open'; adminButton.type = 'button'; adminButton.textContent = '🛡️ Modération'; adminButton.hidden = true; adminButton.addEventListener('click', () => { renderAdmin(); adminDialog.showModal(); });
    $('.profile-hero')?.append(adminButton);
    window.ME_SOCIAL = { toggleFavorite, isFavorite: isFavoriteLocal, followUser, openPublicProfile };

    $('#memberSearchForm')?.addEventListener('submit', ev => {
      ev.preventDefault();
      searchMembers($('#memberSearchInput')?.value || '');
    });
    $('#memberSearchInput')?.addEventListener('input', ev => {
      if (!ev.target.value.trim()) searchMembers('');
    });
  }

  async function main() {
    wire();
    if (!configured) { console.warn('Motor\'s Events : renseignez supabase-config.js pour activer les comptes.'); return; }
    supabase = createClient(cfg.url, cfg.publishableKey);
    supabase.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
      queueMicrotask(async () => {
        await loadProfile(); await loadSocialState(); renderAccountButton();
        const adminBtn = $('.admin-open');
        if (adminBtn) adminBtn.hidden = !(session && ['admin', 'moderator'].includes(profile?.role));
        await loadApprovedEvents();
        await loadTopMembers();
      });
    });
    window.addEventListener('motors:open-db-event', ev => {
      const id=Number(ev.detail);
      const btn=document.querySelector(`[data-db-event-id=\"${id}\"]`);
      if(btn) btn.click();
    });
    await refresh();
  }

  main();
})();
