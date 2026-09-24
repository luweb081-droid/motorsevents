/* Motor's Events – rendu COMMUN des cartes et de la fiche événement.
   Une seule source pour l'accueil (script.js) et la page « Tous les événements » (evenements.js) :
   si on modifie l'apparence ici, elle change partout.

   Modèle d'événement attendu (chaque page convertit ses données vers ce format) :
   {
     id, dbId,                       // id = clé de la page ; dbId = id dans Supabase (pour « J'y vais »)
     title, cat, sub,
     start: 'AAAA-MM-JJ', end: 'AAAA-MM-JJ' | null,
     city, region, place,            // place = adresse ou nom du lieu
     desc, image, url, price,
     organizer: { id, name, avatar, verified }
   }
   Les textes viennent des membres : jamais d'innerHTML, tout passe par textContent. */
(() => {
  'use strict';

  const CATS = {
    auto: 'Auto', moto: 'Moto', quad: 'Quad / SSV',
    truck: 'Truck', nautisme: 'Nautisme', aviation: 'Aviation',
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- Outils DOM ---------- */

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

  function icon(id) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#i-${id}`);
    svg.append(use);
    return svg;
  }

  /* Icônes ajoutées au sprite de la page (remplacent les emojis 📅 ⏱ 🎟 👥, qui changent
     d'un appareil à l'autre). Même style que les autres : trait sur une grille 48×48. */
  const EXTRA_ICONS = {
    calendar: ['M8 12h32v28H8z', 'M8 21h32', 'M16 7v9', 'M32 7v9'],
    clock: ['M24 8a16 16 0 1 0 0 32 16 16 0 0 0 0-32z', 'M24 16v9l6 4'],
    ticket: ['M6 15h36v7a3 3 0 0 0 0 6v7H6v-7a3 3 0 0 0 0-6z', 'M31 15v20'],
    users: ['M17 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M5 39c0-7 5-11 12-11s12 4 12 11', 'M32 22a5 5 0 1 0 0-10', 'M36 28c5 1 8 5 8 11'],
    eye: ['M4 24s7-13 20-13 20 13 20 13-7 13-20 13S4 24 4 24z'],
  };
  (function ensureIcons() {
    const sprite = document.querySelector('svg.sprite');
    if (!sprite) return;
    for (const [id, paths] of Object.entries(EXTRA_ICONS)) {
      if (sprite.querySelector(`#i-${id}`)) continue;
      const sym = document.createElementNS(SVG_NS, 'symbol');
      sym.setAttribute('id', `i-${id}`);
      sym.setAttribute('viewBox', '0 0 48 48');
      for (const d of paths) {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        sym.append(p);
      }
      sprite.append(sym);
    }
  })();

  (function ensureBadgeStyles() {
    if (document.getElementById('me-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 'me-badge-styles';
    style.textContent = `
      .cover { position: relative; }
      .price-badge, .views-badge {
        position: absolute; bottom: 8px; z-index: 3;
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 9px; border-radius: 999px;
        font: 600 12px/1.2 inherit; white-space: nowrap;
        background: rgba(17,17,17,.72); color: #fff;
        backdrop-filter: blur(2px);
      }
      .price-badge .icon, .views-badge .icon { width: 12px; height: 12px; flex: none; fill: none; stroke: currentColor; stroke-width: 3; }
      .price-badge { left: 8px; }
      .views-badge { right: 8px; }
    `;
    document.head.append(style);
  })();

  /* ---------- Dates ---------- */

  const day = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null;      // midi : pas de décalage d'heure d'été
  };
  const fmt = (o) => new Intl.DateTimeFormat('fr-FR', o);
  const F = {
    wd: fmt({ weekday: 'short' }), d: fmt({ day: 'numeric' }), mo: fmt({ month: 'short' }),
    short: fmt({ day: 'numeric', month: 'short' }),
    long: fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  };
  const nbDays = (ev) => {
    const a = day(ev.start), b = day(ev.end);
    return a && b ? Math.max(1, Math.round((b - a) / 86400000) + 1) : 1;
  };
  const isMulti = (ev) => nbDays(ev) > 1;
  const range = (f, ev) => {
    const a = day(ev.start), b = day(ev.end);
    if (!a) return '';
    if (!b || !isMulti(ev)) return f.format(a);
    try { return f.formatRange(a, b); } catch { return `${f.format(a)} – ${f.format(b)}`; }
  };

  /* ---------- Petits utilitaires ---------- */

  const httpUrl = (u) => {
    try {
      const x = new URL(String(u), location.href);
      return /^https?:$/.test(x.protocol) ? x.href : null;
    } catch { return null; }
  };
  const known = (ev) => ev.cat in CATS;
  const catIcon = (ev) => (known(ev) ? ev.cat : 'pin');
  const catLabel = (ev) => CATS[ev.cat] || 'Événement';

  function whereText(ev) {
    const parts = [ev.place];
    const low = () => parts.join(' ').toLowerCase();
    if (ev.city && !low().includes(ev.city.toLowerCase())) parts.push(ev.city);
    if (ev.region && !low().includes(ev.region.toLowerCase())) parts.push(ev.region);
    return parts.filter(Boolean).join(', ');
  }

  // Lien qui ouvre directement la fiche sur la page « Événements », d'où qu'on le partage
  const shareUrl = (ev) => {
    if (ev.dbId == null) return location.href;
    try { return new URL(`evenements.html#e-${ev.dbId}`, location.href).href; } catch { return location.href; }
  };

  /* ==================================================================
     CARTE (liste)
     ================================================================== */

  function card(ev, { onOpen } = {}) {
    const cover = h('div', { class: 'cover' });
    if (ev.image) {
      cover.classList.add('has-img');
      cover.append(h('img', {
        class: 'cover-img', src: ev.image, alt: '', loading: 'lazy', decoding: 'async',
        onerror: (e) => {                                   // affiche cassée : retour au visuel par défaut
          e.target.remove();
          cover.classList.remove('has-img');
          cover.prepend(icon(catIcon(ev)));
        },
      }));
    } else {
      cover.append(icon(catIcon(ev)));
    }
    const a = day(ev.start);
    if (a) {
      cover.append(h('span', { class: 'date' },
        h('small', { text: F.wd.format(a) }),
        h('b', { text: F.d.format(a) }),
        h('small', { text: F.mo.format(a) })));
    }
    if (ev.price) {
      cover.append(h('span', { class: 'price-badge' }, icon('ticket'), h('span', { text: String(ev.price).trim() })));
    }
    const viewCount = Math.max(0, Number(ev.views) || 0);
    cover.append(h('span', { class: 'views-badge' }, icon('eye'), h('span', { text: String(viewCount) })));

    const where = [ev.city, ev.region].filter(Boolean).join(', ') || ev.place;
    const open = (e) => { e.preventDefault(); onOpen?.(ev); };
    const href = `#e-${ev.dbId ?? ev.id}`;

    return h('li', { class: `card ${known(ev) ? `cat-${ev.cat}` : 'cat-autre'}` },
      cover,
      h('div', { class: 'card-body' },
        h('span', { class: 'card-cat' },
          icon(catIcon(ev)),
          h('span', { text: catLabel(ev) }),
          ev.sub && h('span', { class: 'card-sub', text: ev.sub })),
        h('h3', {}, h('a', { href, text: ev.title, onclick: open })),
        where && h('p', { class: 'card-place' }, icon('pin'), h('span', { text: where })),
        h('div', { class: 'card-foot' },
          h('span', { class: 'price', text: isMulti(ev) ? range(F.short, ev) : '' }),
          h('div', { class: 'card-actions' },
            ev.dbId != null && h('button', {
              class: 'btn btn-line attend-btn', type: 'button', text: "J'y vais",
              onclick: (e) => { e.preventDefault(); e.stopPropagation(); window.ME_SOCIAL?.toggleAttendance?.(ev.dbId, ev.title); },
            }),
            h('a', { class: 'go', href, onclick: open }, 'Détails', icon('chevron'))))));
  }

  /* ==================================================================
     FICHE DÉTAILLÉE (fenêtre)
     ================================================================== */

  let ctl = null;                                            // annule les écouteurs de la fiche précédente

  function infoRow(iconId, label, value) {
    return h('div', {},
      h('strong', {}, icon(iconId), h('span', { class: 'sr-only', text: label })),
      h('span', { text: value }));
  }

  function organizerBox(ev, signal, opts) {
    const org = ev.organizer || {};
    if (!org.id && !org.name) return null;

    const nameEl = h('strong', { class: 'organizer-name', text: org.name || 'Organisateur' });
    const badge = h('span', { class: 'verified', text: '✓ Organisateur vérifié' });
    badge.hidden = !org.verified;
    const slot = h('span', { class: 'organizer-avatar-slot' });

    const paintAvatar = (name, avatar) => {
      const src = avatar && httpUrl(avatar);
      slot.replaceChildren(src
        ? h('img', { class: 'organizer-avatar-img', src, alt: '', loading: 'lazy' })
        : h('div', { class: 'organizer-avatar', text: (name || 'ME').slice(0, 2).toUpperCase() }));
    };
    paintAvatar(org.name, org.avatar);

    // Certaines pages ne connaissent pas encore le nom : elles le chargent après l'ouverture
    if (!org.name && opts.resolveOrganizer) {
      Promise.resolve(opts.resolveOrganizer(ev)).then((p) => {
        if (!p || signal.aborted) return;
        if (p.name) nameEl.textContent = p.name;
        paintAvatar(p.name, p.avatar);
        badge.hidden = !p.verified;
      }).catch((err) => console.error('[fiche] organisateur', err));
    }

    return h('div', { class: 'detail-box' },
      h('h3', { text: 'Organisateur' }),
      h('button', {
        class: 'organizer-link', type: 'button',
        onclick: () => org.id && window.ME_SOCIAL?.openPublicProfile?.(org.id),
      }, slot, h('div', {}, nameEl, badge)));
  }

  function attendanceBox(ev, signal) {
    if (ev.dbId == null) return null;
    const attend = h('button', { class: 'btn btn-orange attend-btn', type: 'button', text: "J'y vais", disabled: true });
    const countN = h('span', { class: 'attendees-n', text: '0' });
    const count = h('button', { class: 'btn btn-line attendees-btn', type: 'button', disabled: true },
      icon('users'), countN);

    const refresh = async () => {
      const social = window.ME_SOCIAL;
      if (!social?.getAttendanceState) return;
      try {
        const info = await social.getAttendanceState(ev.dbId);
        if (!info || signal.aborted) return;
        attend.disabled = false;
        attend.textContent = info.going ? "✓ J'y vais" : "J'y vais";
        attend.classList.toggle('attendance-active', Boolean(info.going));
        attend.setAttribute('aria-pressed', String(Boolean(info.going)));
        countN.textContent = String(info.count || 0);
        count.disabled = !info.count;
        count.title = info.count ? 'Voir qui y va' : 'Personne pour le moment';
      } catch (err) { console.error('[fiche] participation', err); }
    };

    attend.addEventListener('click', async () => {
      attend.disabled = true;
      try { await window.ME_SOCIAL?.toggleAttendance?.(ev.dbId, ev.title); } catch (err) { console.error(err); }
      refresh();
    });
    count.addEventListener('click', () => window.ME_SOCIAL?.showAttendees?.(ev.dbId, ev.title));

    // account.js peut se charger après : on relance dès que l'API sociale est prête
    window.addEventListener('motors:social-ready', refresh, { once: true, signal });
    refresh();

    return h('div', { class: 'detail-box event-attendance-detail' },
      h('h3', { text: 'Participation' }),
      h('div', { class: 'detail-actions' }, attend, count));
  }

  function actionsRow(ev, signal, opts) {
    const actions = [];
    const url = httpUrl(ev.url);
    if (url) {
      actions.push(h('a', {
        class: 'btn btn-orange', href: url, target: '_blank',
        rel: 'noopener noreferrer', referrerpolicy: 'no-referrer', text: 'Site officiel',
      }));
    }

    const cityInPlace = ev.city && (ev.place || '').toLowerCase().includes(ev.city.toLowerCase());
    const mapQuery = [ev.place, cityInPlace ? '' : ev.city].filter(Boolean).join(' ');
    if (mapQuery) {
      actions.push(h('a', {
        class: 'btn btn-line', target: '_blank', rel: 'noopener noreferrer',
        href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
        text: 'Voir sur la carte',
      }));
    }

    const fav = opts.favorites;
    if (fav) {
      const btn = h('button', { class: 'btn btn-line', type: 'button' });
      const paint = () => {
        const on = Boolean(fav.isOn(ev));
        btn.textContent = on ? '♥ Retirer des favoris' : '♡ Ajouter aux favoris';
        btn.classList.toggle('favorite-active', on);
        btn.setAttribute('aria-pressed', String(on));
      };
      btn.addEventListener('click', async () => {
        try { await fav.toggle(ev); } catch (err) { console.error('[fiche] favori', err); }
        paint();
      });
      window.addEventListener('motors:favorites-changed', paint, { signal });
      paint();
      actions.push(btn);
    }

    const share = h('button', { class: 'btn btn-line', type: 'button', text: 'Partager' });
    share.addEventListener('click', async () => {
      const url2 = shareUrl(ev);
      if (navigator.share) {
        try { await navigator.share({ title: ev.title, text: `${ev.title} — Motor's Events`, url: url2 }); } catch { /* annulé */ }
        return;
      }
      try {
        await navigator.clipboard.writeText(url2);
        share.textContent = 'Lien copié';
        setTimeout(() => { share.textContent = 'Partager'; }, 2000);
      } catch { /* presse-papiers refusé : on ne fait rien */ }
    });
    actions.push(share);

    return h('div', { class: 'detail-actions' }, actions);
  }

  /* opts :
       favorites: { isOn(ev), toggle(ev) }   → bouton favoris (omis = pas de bouton)
       resolveOrganizer(ev): Promise<{name, avatar, verified}>  → si le nom n'est pas connu d'avance */
  function openDetail(ev, opts = {}) {
    const dlg = document.getElementById('eventDlg');
    const root = document.getElementById('eventDetail');
    if (!dlg || !root) return;

    ctl?.abort();
    ctl = new AbortController();
    const { signal } = ctl;

    const where = whereText(ev);
    const when = range(F.long, ev);
    const subtitle = [ev.city || ev.region, when].filter(Boolean).join(' · ');

    const hero = h('div', { class: `event-detail-hero${ev.image ? ' has-img' : ''}` },
      ev.image && h('img', { class: 'event-detail-img', src: ev.image, alt: '' }),
      ev.image && h('div', { class: 'event-detail-shade' }),
      h('span', { class: 'featured-badge', text: catLabel(ev) }),
      h('h2', { id: 'eventDlgTitle', text: ev.title }),
      subtitle && h('p', { text: subtitle }));

    const about = h('div', { class: 'detail-box' },
      ev.desc && h('h3', { text: 'À propos' }),
      ev.desc && h('p', { class: 'detail-desc', text: ev.desc }),
      actionsRow(ev, signal, opts));

    const poster = ev.image && h('div', { class: 'detail-box' },
      h('h3', { text: 'Affiche' }),
      h('a', { href: ev.image, target: '_blank', rel: 'noopener noreferrer' },
        h('img', { class: 'detail-poster', src: ev.image, alt: `Affiche : ${ev.title}`, loading: 'lazy' })));

    const price = ev.price && String(ev.price).trim();
    const info = h('div', { class: 'detail-box' },
      h('h3', { text: 'Informations' }),
      h('div', { class: 'detail-meta' },
        when && infoRow('calendar', 'Date', when),
        isMulti(ev) && infoRow('clock', 'Durée', `${nbDays(ev)} jours`),
        where && infoRow('pin', 'Lieu', where),
        ev.sub && infoRow(catIcon(ev), 'Type', `${catLabel(ev)} · ${ev.sub}`),
        price && infoRow('ticket', 'Tarif', price),
        infoRow('eye', 'Vues', String(Math.max(0, Number(ev.views) || 0)))));

    root.replaceChildren(
      h('button', { class: 'dialog-x', type: 'button', 'aria-label': 'Fermer', text: '×', onclick: () => dlg.close() }),
      hero,
      h('div', { class: 'event-detail-content' },
        h('div', { class: 'detail-layout' },
          h('div', { class: 'detail-main' }, about, poster),
          h('div', { class: 'detail-side' },
            organizerBox(ev, signal, opts),
            info,
            attendanceBox(ev, signal)))));

    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    root.scrollTop = 0;
  }

  // Un clic sur le fond sombre ferme la fiche (une seule fois pour toutes les pages)
  document.getElementById('eventDlg')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });

  window.ME_EVENT_UI = { CATS, card, openDetail };
})();