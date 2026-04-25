// frontend/js/nav.js — v3 (Flicker-Free Seamless Router)

function renderNav(currentPage) {
  let user = null;
  try { user = api.getUser(); } catch (e) { api.clearAuth(); }

  if (!user) {
    document.body.classList.remove('preloading');
    window.location.href = '/index.html';
    return;
  }

  const menus = [
    { group: 'MONITORING', items: [
      { href: 'dashboard.html',     icon: 'home',     label: 'Dashboard',       roles: ['admin','noc','technician'] },
      { href: 'topology.html',      icon: 'topology', label: 'Topology Map',    roles: ['admin','noc','technician'] },
    ]},
    { group: 'INVENTORY', items: [
      { href: 'joint-closure.html', icon: 'box',      label: 'Joint Closure',   roles: ['admin','noc','technician'] },
      { href: 'cables.html',        icon: 'activity', label: 'Cables',          roles: ['admin','noc','technician'] },
    ]},
    { group: 'MANAGEMENT', items: [
      { href: 'users.html',         icon: 'users',    label: 'User Management', roles: ['admin'] },
    ]}
  ];

  const svgs = {
    home:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    users:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    logout:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    sun:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="4.22" x2="19.78" y2="5.64"/></svg>`,
    moon:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    topology: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="7" y1="16" x2="10" y2="8"/><line x1="17" y1="16" x2="14" y2="8"/></svg>`,
    box:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
  };

  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  _applyThemeImmediate();

  let navHtml = '';
  menus.forEach(group => {
    const visible = group.items.filter(item => item.roles.includes((user.role || '').toLowerCase()));
    if (!visible.length) return;
    navHtml += `<div class="sidebar-section-label">${group.group}</div>`;
    visible.forEach(item => {
      const active = currentPage === item.href ? ' active' : '';
      navHtml += `<a href="${item.href}" class="nav-item${active}" onclick="handleNav(event,this)">${svgs[item.icon]}<span>${item.label}</span></a>`;
    });
  });

  // Inject logo if missing
  if (!sidebar.querySelector('.sidebar-logo')) {
    sidebar.insertAdjacentHTML('afterbegin', `
      <div class="sidebar-logo">
        <div class="logo-icon"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" width="20" height="20"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
        <div class="logo-text"><h1>CoreNMS</h1><div>Fiber Management</div></div>
      </div>
      <nav id="sidebar-nav" class="sidebar-nav"></nav>
    `);
  }

  const navEl = document.getElementById('sidebar-nav');
  if (navEl) navEl.innerHTML = navHtml;

  if (!document.getElementById('sidebar-footer')) {
    const footer = document.createElement('div');
    footer.id = 'sidebar-footer';
    footer.className = 'sidebar-footer';
    footer.innerHTML = `
      <div class="user-info">
        <div class="user-avatar">${(user.full_name || user.username)[0].toUpperCase()}</div>
        <div class="user-info-text">
          <div class="name">${user.full_name || user.username}</div>
          <div class="role">${user.role}</div>
        </div>
        <div class="footer-actions">
          <button id="btn-theme" class="btn-icon-sm" title="Toggle Theme"><span class="theme-icon-sun" style="display:none">${svgs.sun}</span><span class="theme-icon-moon">${svgs.moon}</span></button>
          <button id="btn-logout" class="btn-icon-sm danger" title="Keluar">${svgs.logout}</button>
        </div>
      </div>`;
    sidebar.appendChild(footer);
    document.getElementById('btn-logout').onclick = () => { api.clearAuth(); window.location.href = '/index.html'; };
    document.getElementById('btn-theme').onclick = toggleTheme;
  }
  _syncThemeIcon();
  requestAnimationFrame(() => { requestAnimationFrame(() => { document.body.classList.remove('preloading'); }); });
}

// ─── High-Speed Navigation with Smooth Transitions ───────────────────────────
function handleNav(event, el) {
  event.preventDefault();
  const href = el.getAttribute('href');
  const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
  const targetPath = href.split('/').pop();
  
  if (currentPath === targetPath) return;

  // Visual feedback on nav items
  document.querySelectorAll('#sidebar-nav .nav-item').forEach(a => a.classList.remove('active'));
  el.classList.add('active');

  // Loader bar
  let loader = document.getElementById('nav-loader-bar');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'nav-loader-bar';
    document.body.appendChild(loader);
  }
  loader.classList.add('active');

  // Smooth exit animation
  const main = document.querySelector('.main-content');
  if (main) {
    main.classList.add('page-exiting');
  }

  // Very fast reload to prevent visual lag
  setTimeout(() => {
    window.location.href = href;
  }, 120);
}

function _applyThemeImmediate() {
  const theme = localStorage.getItem('core_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.background = theme === 'dark' ? '#0d0f18' : '#f8fafc';
}

function _syncThemeIcon() {
  const theme = localStorage.getItem('core_theme') || 'dark';
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  btn.querySelector('.theme-icon-sun').style.display  = theme === 'light' ? 'block' : 'none';
  btn.querySelector('.theme-icon-moon').style.display = theme === 'dark'  ? 'block' : 'none';
}

function applyTheme() { _applyThemeImmediate(); _syncThemeIcon(); }

function toggleTheme() {
  const next = (localStorage.getItem('core_theme') || 'dark') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('core_theme', next);
  applyTheme();
}
