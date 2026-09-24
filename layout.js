/* Motor's Events – en-tête (header) et pied de page (footer) communs à toutes les pages.

   ➜ Pour changer le menu, un lien, un texte ou le copyright : modifiez ce fichier, UNE SEULE FOIS.
     Toutes les pages sont mises à jour en même temps.

   Chaque page contient simplement :
     <div id="site-header"></div>   à l'endroit de l'en-tête
     <div id="site-footer"></div>   à l'endroit du pied de page
     <script src="./layout.js"></script>   en bas de page, AVANT les autres scripts

   Nouvelle page ? Ajoutez ces trois lignes et c'est fini. */
(() => {
  'use strict';

  /* =====================================================================
     À MODIFIER ICI
     ===================================================================== */

  const SITE_NAME = "Motor's Events";

  // Menu du haut. « href » : lien de la page. Les liens avec # pointent vers une section de l'accueil.
  const MENU = [
    { label: 'Catégories', href: './index.html#categories' },
    { label: 'Événements', href: './evenements.html' },
    { label: 'À la une',   href: './index.html#featured' },
    { label: 'Communauté', href: './index.html#community' },
    { label: 'Contact',    href: './contact.html' },               // #contact = le pied de page, présent sur toutes les pages
  ];

  // Réseaux sociaux : remplacez les adresses par celles de vos vraies pages.
  // « header: true » = affiché dans la barre du haut ET dans le pied de page ; sinon, pied de page seulement.
  const SOCIALS = [
    { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/motorsevents', header: true },
    { id: 'facebook',  label: 'Facebook',  href: 'https://www.facebook.com/motorsevents',    header: true },
    { id: 'youtube',   label: 'YouTube',   href: 'https://www.youtube.com/channel/UC59dT8S1aaZmm3Asd-96TDg',  header: false },
  ];

  const FOOTER_TEXT = 'Le site de référencement des événements auto, moto, quad, truck, nautisme et aviation en France.';

  const FOOTER_LINKS = [
    { label: 'Contact',                      href: './contact.html' },
    { label: 'Mentions légales',             href: './mentions-legales.html' },
    { label: "Conditions d'utilisation",     href: './conditions-utilisation.html' },
    { label: 'Politique de confidentialité', href: './politique-confidentialite.html' },
    { label: 'Gestion des cookies',          href: './cookies.html' },
  ];

  const COPYRIGHT = `© ${new Date().getFullYear()} Motor's Events — Tous droits réservés.`;

  /* =====================================================================
     Fabrication (pas besoin d'y toucher)
     ===================================================================== */

  // Petit outil pour créer un élément (les textes passent par textContent, jamais innerHTML)
  function h(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid != null && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }

  // Logo : constante écrite ici, aucun contenu venant d'un utilisateur
  const LOGO = '<svg width="34" height="28" viewBox="0 0 34 28" aria-hidden="true">'
    + '<polygon points="9,0 34,0 25,28 0,28" fill="#FF5B14"/>'
    + '<polygon points="15,7 28,7 24,21 11,21" fill="#0A1A3B"/></svg>';

  // Icônes des réseaux : constantes écrites ici, aucun contenu venant d'un utilisateur
  const SOCIAL_ICONS = {
    instagram: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">'
      + '<path d="M14 13.5h2.5l1-4H14v-2c0-1.030 0-2 2-2h1.500V2.140C17.170 2.100 15.940 2 14.640 2 11.930 2 10 3.660 10 6.700v2.800H7v4h3V22h4z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">'
      + '<path d="M21.600 7.200a2.500 2.500 0 0 0-1.800-1.800C18.200 5 12 5 12 5s-6.200 0-7.800.4A2.500 2.500 0 0 0 2.400 7.200C2 8.800 2 12 2 12s0 3.200.4 4.800a2.500 2.500 0 0 0 1.800 1.800C5.800 19 12 19 12 19s6.200 0 7.800-.4a2.500 2.500 0 0 0 1.800-1.800c.4-1.600.4-4.800.4-4.800s0-3.200-.4-4.800zM10 15V9l5.200 3z"/></svg>',
  };

  function socialLinks(onlyHeader) {
    const items = SOCIALS.filter((s) => s.href && (!onlyHeader || s.header));
    if (!items.length) return null;
    return h('div', { class: onlyHeader ? 'socials socials-header' : 'socials socials-footer' },
      items.map((s) => {
        const a = h('a', {
          class: 'social-link', href: s.href, target: '_blank', rel: 'noopener noreferrer',
          'aria-label': `${SITE_NAME} sur ${s.label}`, title: s.label,
        });
        a.insertAdjacentHTML('afterbegin', SOCIAL_ICONS[s.id] || '');
        return a;
      }));
  }

  // Petite feuille de style pour les icônes (fichier séparé : compatible avec une CSP stricte)
  if (!document.querySelector('link[data-social-css]')) {
    const css = h('link', { rel: 'stylesheet', href: './social.css', 'data-social-css': true });
    document.head.append(css);
  }

  // « /evenements.html », « /evenements » et « /evenements/ » sont la même page
  const cleanPath = (p) => p.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
  const here = cleanPath(location.pathname);

  function menuItem({ label, href }) {
    const url = new URL(href, location.href);
    const isCurrentPage = !url.hash && cleanPath(url.pathname) === here;
    return h('li', {}, h('a', { href, 'aria-current': isCurrentPage ? 'page' : null, text: label }));
  }

  function buildHeader() {
    // Sur l'accueil (où se trouve la fenêtre d'ajout), le bouton l'ouvre ; ailleurs, c'est un lien vers l'accueil.
    const hasAddDialog = Boolean(document.getElementById('dlg'));
    const addBtn = hasAddDialog
      ? h('button', { class: 'btn btn-orange', id: 'headerAddBtn', type: 'button', 'data-open-add': true, hidden: true, text: 'Ajouter un événement' })
      : h('a', { class: 'btn btn-orange', id: 'headerAddBtn', href: './index.html#publier', hidden: true, text: 'Ajouter un événement' });

    const brand = h('a', { class: 'brand', href: './index.html', 'aria-label': `${SITE_NAME}, accueil` });
    brand.insertAdjacentHTML('afterbegin', LOGO);
    brand.append(SITE_NAME);

    return h('header', { class: 'site-header on-dark' },
      h('div', { class: 'wrap bar' },
        brand,
        h('nav', { class: 'main-nav', 'aria-label': 'Navigation principale' }, h('ul', {}, MENU.map(menuItem))),
        h('div', { class: 'actions' },
          socialLinks(true),
          h('button', { class: 'login', id: 'favoritesBtn', type: 'button', hidden: true }, '♡ Favoris ', h('span', { id: 'favCount', text: '0' })),
          h('button', { class: 'login', id: 'alertsBtn', type: 'button', hidden: true, text: '🔔 Alertes' }),
          h('button', { class: 'account-btn', id: 'accountBtn', type: 'button', 'aria-label': 'Se connecter', text: 'Se connecter' }),
          addBtn)));
  }

  function buildFooter() {
    return [
      h('div', { class: 'checker', 'aria-hidden': 'true' }),
      h('footer', { class: 'site-footer on-dark', id: 'contact' },
        h('div', { class: 'wrap' },
          h('div', { class: 'footer-grid' },
            h('div', {},
              h('a', { class: 'brand', href: './index.html', text: SITE_NAME }),
              h('p', { text: FOOTER_TEXT }),
              socialLinks(false)),
            h('ul', { class: 'footer-links' },
              FOOTER_LINKS.map(({ label, href }) => h('li', {}, h('a', { href, text: label }))))),
          h('div', { class: 'footer-legal-bottom' }, h('p', { text: COPYRIGHT })))),
    ];
  }

  function mount(slotId, nodes) {
    const slot = document.getElementById(slotId);
    if (slot) slot.replaceWith(...[].concat(nodes));
  }

  mount('site-header', buildHeader());
  mount('site-footer', buildFooter());
})();