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
    close.className = 'link-btn'; close.type = 'button'; close.textContent = 'Fermer';
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
    const body = document.createElement('div'); body.className = 'dlg-body me-space';
    body.innerHTML = `
      <div class="me-profile-head">
        <div class="me-avatar" id="me-avatar">ME</div>
        <div><h3 id="me-name">Mon profil</h3><p id="me-email-view" class="me-muted"></p></div>
        <button class="btn btn-line" type="button" id="me-logout">Se déconnecter</button>
      </div>
      <div class="me-space-grid">
        <section class="me-panel">
          <h3>Profil public</h3>
          <form id="profileForm" class="me-form">
            <div><label for="p-display">Nom affiché</label><input id="p-display" maxlength="100" required></div>
            <div><label for="p-username">Pseudo</label><input id="p-username" maxlength="30" pattern="[A-Za-z0-9_-]{3,30}" required></div>
            <div><label for="p-city">Ville</label><input id="p-city" maxlength="120"></div>
            <div><label for="p-region">Région</label><select id="p-region"></select></div>
            <div class="full"><label for="p-bio">Bio</label><textarea id="p-bio" maxlength="500"></textarea></div>
            <div class="full"><label for="p-website">Site web</label><input id="p-website" type="url" maxlength="300" placeholder="https://"></div>
            <div class="full"><label for="p-avatar">Photo de profil</label><input id="p-avatar" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG ou WebP — 5 Mo maximum.</small></div>
            <button class="btn btn-orange" type="submit">Enregistrer mon profil</button>
            <p id="profileStatus" class="me-status" aria-live="polite"></p>
          </form>
        </section>
        <section class="me-panel">
          <div class="me-panel-head"><div><h3>Mes événements</h3><p class="me-muted">Suivez vos annonces et leur validation.</p></div><button class="btn btn-orange" type="button" id="me-add-event">Ajouter</button></div>
          <div id="myEvents" class="my-events"></div>
        </section>
      </div>`;
    d.append(body); document.body.append(d);

    const regionSelect = $('#p-region', d);
    REGIONS.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r || 'Région'; regionSelect.append(o); });
    $('#me-logout', d).addEventListener('click', async () => { await supabase.auth.signOut(); d.close(); });
    $('#me-add-event', d).addEventListener('click', () => { d.close(); openAddForAuthenticated(); });
    $('#profileForm', d).addEventListener('submit', saveProfile);
    $('#p-avatar', d).addEventListener('change', ev => { if (ev.target.files[0] && !allowedImage(ev.target.files[0])) { ev.target.value = ''; notify('Image refusée : JPG, PNG ou WebP, 5 Mo maximum.'); } });
    return d;
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
    const b = $('#accountBtn'); if (!b) return;
    if (session) { b.textContent = profile?.display_name ? `👤 ${profile.display_name.slice(0, 18)}` : '👤 Mon profil'; b.classList.add('connected'); }
    else { b.textContent = 'Compte'; b.classList.remove('connected'); }
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
      const result = await supabase.from('profiles').select('id,display_name,username').in('id', ids);
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
    renderAccountButton();
    await loadApprovedEvents();
    if (session && profile?.role && ['admin', 'moderator'].includes(profile.role)) {
      document.body.classList.add('is-admin');
    } else document.body.classList.remove('is-admin');
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
    const payload = { title, category, subtype, start_date: start, end_date: end, place, city, region, description: desc, official_url: url || null };
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

  function wire() {
    accountDialog = buildAuthDialog();
    profileDialog = buildProfileDialog();
    adminDialog = buildAdminDialog();
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
    $('.me-profile-head')?.append(adminButton);
  }

  async function main() {
    wire();
    if (!configured) { console.warn('Motor\'s Events : renseignez supabase-config.js pour activer les comptes.'); return; }
    supabase = createClient(cfg.url, cfg.publishableKey);
    supabase.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
      queueMicrotask(async () => {
        await loadProfile(); renderAccountButton();
        const adminBtn = $('.admin-open');
        if (adminBtn) adminBtn.hidden = !(session && ['admin', 'moderator'].includes(profile?.role));
        await loadApprovedEvents();
      });
    });
    await refresh();
  }

  main();
})();
