import { createClient }
  from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.ME_SUPABASE_CONFIG || {};

const supabase = createClient(
  cfg.url,
  cfg.publishableKey
);


const $ = selector =>
  document.querySelector(selector);


let session = null;
let profile = null;
let rejectingEventId = null;


/* =========================
   HELPERS
========================= */

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[char]
  );
}


function formatDate(value) {

  if (!value) return 'Date inconnue';

  const date = new Date(value);

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle: 'medium',
      timeStyle: 'short'
    }
  ).format(date);
}


function showToast(message) {

  const toast = $('#toast');

  toast.textContent = message;

  toast.classList.add('show');

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}


/* =========================
   AUTH / ADMIN CHECK
========================= */

async function checkAdmin() {

  const {
    data: {
      session: currentSession
    }
  } = await supabase.auth.getSession();

  session = currentSession;

  if (!session) {
    blockAccess();
    return false;
  }


  const {
    data,
    error
  } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      role
    `)
    .eq('id', session.user.id)
    .single();


  if (error || !data || data.role !== 'admin') {

    blockAccess();

    return false;
  }


  profile = data;

  $('#adminName').textContent =
    data.display_name ||
    data.username ||
    'Administrateur';

  $('#loadingScreen').classList.add('hidden');
  $('#adminApp').classList.remove('hidden');

  return true;
}


function blockAccess() {

  $('#loadingScreen').classList.add('hidden');

  $('#blockedScreen').classList.remove('hidden');

  $('#adminApp').classList.add('hidden');
}


/* =========================
   LOAD EVENTS
========================= */

async function loadStats() {

  const [
    pending,
    approved,
    rejected
  ] = await Promise.all([

    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved'),

    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rejected')

  ]);


  $('#pendingCount').textContent =
    pending.count ?? 0;

  $('#approvedCount').textContent =
    approved.count ?? 0;

  $('#rejectedCount').textContent =
    rejected.count ?? 0;
}


async function loadPendingEvents() {

  const list = $('#eventList');
  const empty = $('#emptyState');

  list.innerHTML = `
    <div class="empty-state">
      Chargement des événements…
    </div>
  `;

  const {
    data,
    error
  } = await supabase
    .from('events')
    .select(`
      id,
      title,
      category,
      subtype,
      starts_at,
      ends_at,
      start_date,
      end_date,
      place,
      city,
      region,
      description,
      official_url,
      image_url,
      status,
      rejection_reason,
      created_at,
      user_id
    `)
    .eq('status', 'pending')
    .order('created_at', {
      ascending: true
    });


  if (error) {

    list.innerHTML = '';

    showToast(error.message);

    return;
  }


  const events = data || [];

  $('#pendingLabel').textContent =
    `${events.length} événement${events.length > 1 ? 's' : ''}`;


  if (!events.length) {

    list.innerHTML = '';

    empty.classList.remove('hidden');

    return;
  }


  empty.classList.add('hidden');

  list.innerHTML =
    events.map(renderEvent).join('');
}


function renderEvent(event) {

  const image = event.image_url
    ? `
      <div class="event-image">
        <img
          src="${escapeHtml(event.image_url)}"
          alt=""
          loading="lazy"
        >
      </div>
    `
    : `
      <div class="event-image no-image">
        Aucune image
      </div>
    `;


  const date =
    event.starts_at ||
    event.start_date;


  return `
    <article
      class="event-card"
      data-event-id="${escapeHtml(event.id)}"
    >

      ${image}

      <div class="event-content">

        <span class="event-category">
          ${escapeHtml(event.category || 'Événement')}
        </span>

        <h3 class="event-title">
          ${escapeHtml(event.title)}
        </h3>

        <div class="event-info">

          <span>
            📅 ${escapeHtml(formatDate(date))}
          </span>

          <span>
            📍 ${escapeHtml(event.place || '')}
            ${event.city ? ` — ${escapeHtml(event.city)}` : ''}
          </span>

          ${
            event.region
              ? `
                <span>
                  ${escapeHtml(event.region)}
                </span>
              `
              : ''
          }

        </div>

        <p class="event-description">
          ${escapeHtml(event.description)}
        </p>

        ${
          event.official_url
            ? `
              <a
                class="event-link"
                href="${escapeHtml(event.official_url)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir le lien officiel →
              </a>
            `
            : ''
        }

      </div>


      <div class="event-actions">

        <button
          type="button"
          class="btn btn-approve"
          data-action="approve"
          data-id="${escapeHtml(event.id)}"
        >
          ✓ Valider
        </button>

        <button
          type="button"
          class="btn btn-danger"
          data-action="reject"
          data-id="${escapeHtml(event.id)}"
        >
          × Refuser
        </button>

      </div>

    </article>
  `;
}


/* =========================
   APPROVE
========================= */

async function approveEvent(eventId) {

  const confirmed =
    window.confirm(
      'Valider cet événement et le rendre public ?'
    );

  if (!confirmed) return;


  const {
    error
  } = await supabase.rpc(
    'approve_event',
    {
      event_id: Number(eventId)
    }
  );


  if (error) {

    showToast(error.message);

    return;
  }


  showToast(
    'Événement validé.'
  );

  await refresh();
}


/* =========================
   REJECT
========================= */

function openReject(eventId) {

  rejectingEventId = Number(eventId);

  $('#rejectReason').value = '';

  $('#rejectDialog').showModal();

  setTimeout(() => {
    $('#rejectReason').focus();
  }, 50);
}


async function rejectEvent() {

  if (!rejectingEventId) return;


  const reason =
    $('#rejectReason').value.trim();


  if (!reason) {

    showToast(
      'Indique une raison du refus.'
    );

    return;
  }


  const {
    error
  } = await supabase.rpc(
    'reject_event',
    {
      event_id: rejectingEventId,
      reason
    }
  );


  if (error) {

    showToast(error.message);

    return;
  }


  $('#rejectDialog').close();

  rejectingEventId = null;

  showToast(
    'Événement refusé.'
  );

  await refresh();
}


/* =========================
   REFRESH
========================= */

async function refresh() {

  await Promise.all([
    loadStats(),
    loadPendingEvents()
  ]);
}


/* =========================
   EVENTS
========================= */

document.addEventListener(
  'click',
  event => {

    const button =
      event.target.closest('[data-action]');

    if (!button) return;


    const id =
      button.dataset.id;

    if (!id) return;


    if (
      button.dataset.action === 'approve'
    ) {

      approveEvent(id);

    }


    if (
      button.dataset.action === 'reject'
    ) {

      openReject(id);

    }

  }
);


$('#refreshBtn').addEventListener(
  'click',
  refresh
);


$('#confirmReject').addEventListener(
  'click',
  rejectEvent
);


$('#logoutBtn').addEventListener(
  'click',
  async () => {

    await supabase.auth.signOut();

    window.location.href =
      'index.html';

  }
);


/* =========================
   AUTH LISTENER
========================= */

supabase.auth.onAuthStateChange(
  async (_event, newSession) => {

    session = newSession;

    if (!newSession) {

      blockAccess();

      return;
    }

    const ok =
      await checkAdmin();

    if (ok) {
      await refresh();
    }

  }
);


/* =========================
   START
========================= */

async function init() {

  const configured =
    /^https:\/\/[^\s]+\.supabase\.co$/
      .test(cfg.url || '')
    &&
    String(cfg.publishableKey || '')
      .startsWith('sb_')
    &&
    !String(cfg.publishableKey)
      .includes('YOUR_');


  if (!configured) {

    $('#loadingScreen').innerHTML = `
      <p>
        Configuration Supabase manquante.
      </p>
    `;

    return;
  }


  const ok =
    await checkAdmin();

  if (ok) {
    await refresh();
  }
}


init();