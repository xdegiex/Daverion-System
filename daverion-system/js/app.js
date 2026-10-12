/* ============================================================
   DAVERION SYSTEM v3 – Firebase Firestore (multi-user sync)
   ============================================================ */

const GATE_PASS = 'dav';
const GATE_DURATION = 60 * 60 * 1000;

const USERS = {
  administr: { pass: 'nimda!2', role: 'admin', label: 'Administrator' },
  mechan:    { pass: 'mech!@',  role: 'utrzymanie', label: 'Utrzymanie Ruchu' },
  kierow:    { pass: 'kier!@',  role: 'kierownik', label: 'Kierownik' },
  admi:      { pass: 'adm!@',   role: 'biuro', label: 'Biuro' },
  dzjak:     { pass: 'dzj!@',   role: 'jakosc', label: 'Dział Jakości' },
  magaz:     { pass: 'mag!@',   role: 'magazyn', label: 'Magazyn' },
  prod:      { pass: 'pro!@',   role: 'produkcja', label: 'Produkcja' }
};

const PAGES = [
  { id: 'dashboard', label: 'Panel główny', icon: '▣', section: 'main' },
  { id: 'aktualnosci', label: 'Aktualności', icon: '📰', section: 'main' },
  { id: 'kalendarz', label: 'Kalendarz', icon: '📅', section: 'main' },
  { id: 'park', label: 'Park Maszyn', icon: '⚙', section: 'prod' },
  { id: 'mes', label: 'MES Produkcja', icon: '🏭', section: 'prod' },
  { id: 'qhse', label: 'QHSE', icon: '🛡', section: 'prod' },
  { id: 'ci', label: 'Lean / WCM / CI', icon: '◆', section: 'prod' },
  { id: 'magazyn', label: 'Magazyn', icon: '📦', section: 'prod' },
  { id: 'magazyn-ur', label: 'Magazyn UR', icon: '🔧', section: 'prod' },
  { id: 'pracownicy', label: 'Pracownicy', icon: '👥', section: 'hr' },
  { id: 'kontakty', label: 'Kontakty', icon: '📞', section: 'hr' },
  { id: 'awaria', label: '! Zgłoś Awarię !', icon: '⚠', section: 'alert', special: true },
  { id: 'czat', label: 'Czat Firmowy', icon: '💬', section: 'comm' },
  { id: 'dzial-mech', label: 'Dział Mechaniczny', icon: '🔩', section: 'depts' },
  { id: 'dzial-jakosc', label: 'Dział Jakości', icon: '✓', section: 'depts' },
  { id: 'dzial-admin', label: 'Dział Administracji', icon: '📋', section: 'depts' },
  { id: 'dzial-magazyn', label: 'Dział Magazyn', icon: '🏷', section: 'depts' },
  { id: 'dzial-produkcja', label: 'Dział Produkcji', icon: '🏭', section: 'depts' },
  { id: 'ustawienia', label: 'Ustawienia', icon: '⚙', section: 'admin', roles: ['admin'] }
];

const SECTION_LABELS = {
  main: 'Główne', prod: 'Produkcja', hr: 'Kadry', alert: '',
  comm: 'Komunikacja', depts: 'Działy', admin: 'System'
};

/* ========== STATE ========== */
let state = {
  gateOk: false,
  user: null,
  currentPage: 'dashboard',
  theme: 'dark',
  hiddenPages: [],
  alertActive: false,
  cloud: false,
  data: {
    news: [], events: {}, contacts: [], warehouse: [], machines: [],
    urWarehouse: { 'Elektronarzędzia': [], 'Narzędzia': [], 'Części Zamienne': [], 'Części Naprawcze': [], 'Inne': [] },
    employees: { 'Produkcja': [], 'Magazyn': [], 'Administracja': [], 'Utrzymanie Ruchu': [], 'Dział Jakości': [] },
    failures: [], chat: [],
    depts: { 'dzial-mech': [], 'dzial-jakosc': [], 'dzial-admin': [], 'dzial-magazyn': [], 'dzial-produkcja': [] },
    users: Object.keys(USERS).map(l => ({ login: l, ...USERS[l] })),
    mes: {
      orders: [],
      reports: [],
      downtimes: [],
      lines: [],
      shifts: [],
      queue: [],
      changeovers: [],
      scrapReasons: ['Wada materiału', 'Błąd operatora', 'Ustawienia maszyny', 'Transport', 'Inne']
    },
    qhse: {
      incidents: [],
      inspections: [],
      trainings: [],
      nearMisses: [],
      permits: []
    },
    ci: {
      initiatives: [],
      kanban: [],
      pokaYoke: [],
      jidoka: [],
      andon: [],
      heijunka: [],
      hoshin: [],
      muda: [],
      tpm: [],
      gemba: [],
      kpis: []
    }
  }
};

let db = null;
let unsubs = [];

/* ========== UTILS ========== */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function nowStr() {
  return new Date().toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function toast(msg, type = 'success') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = type + ' show';
  setTimeout(() => t.classList.remove('show'), 2800);
}
function setSyncBadge(ok) {
  const b = $('#sync-badge');
  if (!b) return;
  b.style.display = 'inline';
  if (ok) {
    b.textContent = '☁ sync';
    b.style.background = '#166534';
    b.style.color = '#bbf7d0';
  } else {
    b.textContent = '○ lokalnie';
    b.style.background = '#444';
    b.style.color = '#aaa';
  }
}

/* ========== PERMISSIONS ========== */
function canEdit(pageId) {
  const r = state.user?.role;
  if (!r) return false;
  if (r === 'admin') return true;
  if (r === 'utrzymanie') return ['park','aktualnosci','czat','kalendarz','magazyn-ur','mes','qhse','ci'].includes(pageId);
  if (r === 'kierownik') return ['park','aktualnosci','czat','kalendarz','magazyn','pracownicy','dzial-admin','dzial-produkcja','mes','qhse','ci'].includes(pageId);
  if (r === 'biuro') return ['awaria','czat','aktualnosci','dzial-admin','pracownicy','kontakty','qhse','ci'].includes(pageId);
  if (r === 'jakosc') return ['awaria','czat','aktualnosci','dzial-jakosc','mes','qhse','ci'].includes(pageId);
  if (r === 'magazyn') return ['awaria','czat','magazyn','dzial-magazyn','qhse'].includes(pageId);
  if (r === 'produkcja') return ['awaria','czat','aktualnosci','dzial-produkcja','mes','qhse','ci'].includes(pageId);
  return false;
}
function canEditMesFull() {
  const r = state.user?.role;
  return r === 'admin' || r === 'kierownik';
}
function canMesReport() {
  const r = state.user?.role;
  return r === 'admin' || r === 'kierownik' || r === 'produkcja' || r === 'utrzymanie' || r === 'jakosc';
}
function canClearAlert() {
  const r = state.user?.role;
  return r === 'admin' || r === 'utrzymanie' || r === 'kierownik';
}
function canDownloadReport() {
  const r = state.user?.role;
  return r === 'admin' || r === 'kierownik';
}

/* ========== LOCAL STORAGE (fallback + session) ========== */
function loadLocalSession() {
  try {
    const gate = localStorage.getItem('ds_gate');
    if (gate) {
      const g = JSON.parse(gate);
      if (Date.now() < g.expires) state.gateOk = true;
      else localStorage.removeItem('ds_gate');
    }
    const saved = localStorage.getItem('ds_session');
    if (saved) {
      const p = JSON.parse(saved);
      state.theme = p.theme || 'dark';
      if (p.user) state.user = p.user;
    }
    // local data only if no cloud
    if (!state.cloud) {
      const d = localStorage.getItem('ds_data');
      if (d) {
        const p = JSON.parse(d);
        state.data = { ...state.data, ...p.data };
        if (!state.data.mes) state.data.mes = { orders: [], reports: [], downtimes: [], lines: [], shifts: [], queue: [], changeovers: [], scrapReasons: ['Wada materiału', 'Błąd operatora', 'Ustawienia maszyny', 'Transport', 'Inne'] };
        ['orders','reports','downtimes','lines','shifts','queue','changeovers'].forEach(k => { if (!state.data.mes[k]) state.data.mes[k] = []; });
        if (!state.data.qhse) state.data.qhse = { incidents: [], inspections: [], trainings: [], nearMisses: [], permits: [] };
        ['incidents','inspections','trainings','nearMisses','permits'].forEach(k => { if (!state.data.qhse[k]) state.data.qhse[k] = []; });
        if (!state.data.ci) state.data.ci = { initiatives: [], kanban: [], pokaYoke: [], jidoka: [], andon: [], heijunka: [], hoshin: [], muda: [], tpm: [], gemba: [], kpis: [] };
        Object.keys(state.data.ci).forEach(k => { if (!Array.isArray(state.data.ci[k])) state.data.ci[k] = []; });
        state.hiddenPages = p.hiddenPages || [];
        state.alertActive = p.alertActive || false;
      }
    }
  } catch (e) { console.warn(e); }
}
function saveSession() {
  try {
    localStorage.setItem('ds_session', JSON.stringify({ theme: state.theme, user: state.user }));
  } catch (e) {}
}
function saveLocalData() {
  if (state.cloud) return;
  try {
    localStorage.setItem('ds_data', JSON.stringify({
      data: state.data, hiddenPages: state.hiddenPages, alertActive: state.alertActive
    }));
  } catch (e) {}
}
function setGate() {
  localStorage.setItem('ds_gate', JSON.stringify({ expires: Date.now() + GATE_DURATION }));
  state.gateOk = true;
}

/* ========== FIREBASE ========== */
function initFirebase() {
  // Akceptuj config jeśli FIREBASE_READY=true LUB firebaseConfig ma prawdziwy apiKey
  var hasConfig = (typeof firebaseConfig !== 'undefined' && firebaseConfig && firebaseConfig.apiKey
    && String(firebaseConfig.apiKey).indexOf('WSTAW') === -1);
  var readyFlag = (typeof FIREBASE_READY !== 'undefined' && FIREBASE_READY);
  if (!readyFlag && !hasConfig) {
    state.cloud = false;
    setSyncBadge(false);
    console.info('[Daverion] Firebase nie skonfigurowany – tryb lokalny (localStorage)');
    console.info('[Daverion] Sprawdź czy plik js/firebase-config.js jest wgrany na hosting');
    return false;
  }
  if (typeof firebase === 'undefined') {
    state.cloud = false;
    setSyncBadge(false);
    console.error('[Daverion] Biblioteka firebase nie załadowana (CDN)');
    return false;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
    state.cloud = true;
    setSyncBadge(true);
    console.info('[Daverion] Firebase Firestore aktywny – synchronizacja włączona');
    startListeners();
    return true;
  } catch (e) {
    console.error('[Daverion] Firebase init error', e);
    state.cloud = false;
    setSyncBadge(false);
    return false;
  }
}

function col(name) { return db.collection(name); }

function startListeners() {
  unsubs.forEach(u => u && u());
  unsubs = [];

  // news
  unsubs.push(col('news').orderBy('ts', 'desc').onSnapshot(snap => {
    state.data.news = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'aktualnosci' || state.currentPage === 'dashboard') renderPage();
  }, err => console.warn('news listener', err)));

  // machines
  unsubs.push(col('machines').onSnapshot(snap => {
    state.data.machines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (['park','dashboard'].includes(state.currentPage)) renderPage();
  }));

  // warehouse
  unsubs.push(col('warehouse').onSnapshot(snap => {
    state.data.warehouse = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (['magazyn','dashboard'].includes(state.currentPage)) renderPage();
  }));

  // contacts
  unsubs.push(col('contacts').onSnapshot(snap => {
    state.data.contacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'kontakty') renderPage();
  }));

  // failures
  unsubs.push(col('failures').orderBy('ts', 'desc').onSnapshot(snap => {
    state.data.failures = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (['awaria','dashboard'].includes(state.currentPage)) renderPage();
  }));

  // chat
  unsubs.push(col('chat').orderBy('ts', 'desc').limit(100).onSnapshot(snap => {
    state.data.chat = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'czat') renderPage();
  }));

  // events (calendar) – stored as docs with id = YYYY-MM-DD
  unsubs.push(col('events').onSnapshot(snap => {
    const ev = {};
    snap.docs.forEach(d => { ev[d.id] = d.data().items || []; });
    state.data.events = ev;
    if (['kalendarz','dashboard'].includes(state.currentPage)) renderPage();
  }));

  // ur items
  unsubs.push(col('urItems').onSnapshot(snap => {
    const base = { 'Elektronarzędzia': [], 'Narzędzia': [], 'Części Zamienne': [], 'Części Naprawcze': [], 'Inne': [] };
    snap.docs.forEach(d => {
      const item = { id: d.id, ...d.data() };
      if (base[item.category]) base[item.category].push(item);
    });
    state.data.urWarehouse = base;
    if (state.currentPage === 'magazyn-ur') renderPage();
  }));

  // employees
  unsubs.push(col('employees').onSnapshot(snap => {
    const base = { 'Produkcja': [], 'Magazyn': [], 'Administracja': [], 'Utrzymanie Ruchu': [], 'Dział Jakości': [] };
    snap.docs.forEach(d => {
      const item = { id: d.id, ...d.data() };
      if (base[item.category]) base[item.category].push(item);
    });
    state.data.employees = base;
    if (state.currentPage === 'pracownicy') renderPage();
  }));

  // dept posts
  unsubs.push(col('deptPosts').orderBy('ts', 'desc').onSnapshot(snap => {
    const base = { 'dzial-mech': [], 'dzial-jakosc': [], 'dzial-admin': [], 'dzial-magazyn': [], 'dzial-produkcja': [] };
    snap.docs.forEach(d => {
      const item = { id: d.id, ...d.data() };
      if (base[item.dept]) base[item.dept].push(item);
    });
    state.data.depts = base;
    if (state.currentPage.startsWith('dzial-')) renderPage();
  }));

  // MES – orders
  unsubs.push(col('mesOrders').orderBy('ts', 'desc').onSnapshot(snap => {
    state.data.mes.orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'mes' || state.currentPage === 'dashboard') renderPage();
  }, err => console.warn('mesOrders', err)));

  // MES – production reports
  unsubs.push(col('mesReports').orderBy('ts', 'desc').limit(200).onSnapshot(snap => {
    state.data.mes.reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'mes' || state.currentPage === 'dashboard') renderPage();
  }, err => console.warn('mesReports', err)));

  // MES – downtimes
  unsubs.push(col('mesDowntimes').orderBy('ts', 'desc').limit(100).onSnapshot(snap => {
    state.data.mes.downtimes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'mes') renderPage();
  }, err => console.warn('mesDowntimes', err)));

  // MES – lines
  unsubs.push(col('mesLines').onSnapshot(snap => {
    state.data.mes.lines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'mes') renderPage();
  }, err => console.warn('mesLines', err)));

  // MES – shifts
  unsubs.push(col('mesShifts').onSnapshot(snap => {
    state.data.mes.shifts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'mes') renderPage();
  }, err => console.warn('mesShifts', err)));

  // MES – production queue
  unsubs.push(col('mesQueue').orderBy('seq', 'asc').onSnapshot(snap => {
    state.data.mes.queue = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'mes') renderPage();
  }, err => console.warn('mesQueue', err)));

  // MES – changeovers
  unsubs.push(col('mesChangeovers').orderBy('ts', 'desc').limit(50).onSnapshot(snap => {
    state.data.mes.changeovers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'mes') renderPage();
  }, err => console.warn('mesChangeovers', err)));

  // QHSE collections
  unsubs.push(col('qhseIncidents').orderBy('ts', 'desc').limit(100).onSnapshot(snap => {
    state.data.qhse.incidents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'qhse' || state.currentPage === 'dashboard') renderPage();
  }, err => console.warn('qhseIncidents', err)));
  unsubs.push(col('qhseInspections').orderBy('ts', 'desc').limit(100).onSnapshot(snap => {
    state.data.qhse.inspections = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'qhse') renderPage();
  }, err => console.warn('qhseInspections', err)));
  unsubs.push(col('qhseTrainings').orderBy('ts', 'desc').limit(100).onSnapshot(snap => {
    state.data.qhse.trainings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'qhse') renderPage();
  }, err => console.warn('qhseTrainings', err)));
  unsubs.push(col('qhseNearMisses').orderBy('ts', 'desc').limit(100).onSnapshot(snap => {
    state.data.qhse.nearMisses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'qhse') renderPage();
  }, err => console.warn('qhseNearMisses', err)));
  unsubs.push(col('qhsePermits').orderBy('ts', 'desc').limit(100).onSnapshot(snap => {
    state.data.qhse.permits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentPage === 'qhse') renderPage();
  }, err => console.warn('qhsePermits', err)));

  // Continuous Improvement collections
  const ciCols = [
    ['ciInitiatives','initiatives'],['ciKanban','kanban'],['ciPokaYoke','pokaYoke'],
    ['ciJidoka','jidoka'],['ciAndon','andon'],['ciHeijunka','heijunka'],['ciHoshin','hoshin'],
    ['ciMuda','muda'],['ciTpm','tpm'],['ciGemba','gemba'],['ciKpis','kpis']
  ];
  ciCols.forEach(([colName, key]) => {
    unsubs.push(col(colName).onSnapshot(snap => {
      state.data.ci[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (state.currentPage === 'ci') renderPage();
    }, err => console.warn(colName, err)));
  });

  // meta (alert, hidden pages, theme preference is local)
  unsubs.push(col('meta').doc('app').onSnapshot(snap => {
    if (snap.exists) {
      const m = snap.data();
      state.alertActive = !!m.alertActive;
      state.hiddenPages = m.hiddenPages || [];
      updateHeader();
      renderNav();
      if (state.currentPage === 'dashboard' || state.currentPage === 'awaria') renderPage();
    }
  }));
}

/* Cloud write helpers */
async function cloudAdd(collection, data) {
  if (!state.cloud) return null;
  const ref = await col(collection).add(data);
  return ref.id;
}
async function cloudSet(collection, id, data, merge = true) {
  if (!state.cloud) return;
  await col(collection).doc(id).set(data, { merge });
}
async function cloudDelete(collection, id) {
  if (!state.cloud) return;
  await col(collection).doc(id).delete();
}
async function cloudUpdateMeta(patch) {
  if (!state.cloud) return;
  await col('meta').doc('app').set(patch, { merge: true });
}

/* Unified save after local mutation (local mode) */
function persist() {
  if (state.cloud) return;
  saveLocalData();
}

/* ========== THEME ========== */
function applyTheme(t) {
  state.theme = t;
  document.body.setAttribute('data-theme', t);
  saveSession();
}

/* ========== NAV ========== */
function renderNav() {
  const nav = $('#sidebar-nav');
  if (!nav) return;
  nav.innerHTML = '';
  let lastSection = null;
  PAGES.forEach(p => {
    if (state.hiddenPages.includes(p.id)) return;
    if (p.roles && !p.roles.includes(state.user?.role)) return;
    if (p.section !== lastSection && SECTION_LABELS[p.section]) {
      const lab = document.createElement('div');
      lab.className = 'nav-section-label';
      lab.textContent = SECTION_LABELS[p.section];
      nav.appendChild(lab);
      lastSection = p.section;
    } else if (p.section !== lastSection) lastSection = p.section;

    const btn = document.createElement('button');
    btn.className = 'nav-btn' + (state.currentPage === p.id ? ' active' : '') + (p.special ? ' nav-alert' : '');
    btn.innerHTML = `<span class="nav-icon">${p.icon}</span><span>${p.label}</span>`;
    btn.onclick = () => { navigate(p.id); closeSidebarMobile(); };
    nav.appendChild(btn);
  });
}
function navigate(pageId) {
  state.currentPage = pageId;
  renderNav();
  renderPage();
  window.scrollTo(0, 0);
}
function updateHeader() {
  const badge = $('#user-badge');
  if (badge) badge.textContent = state.user ? state.user.label : 'Gość';
  const dot = $('#alert-dot');
  if (dot) {
    if (state.alertActive) dot.classList.add('visible');
    else dot.classList.remove('visible');
  }
}
function openSidebarMobile() {
  $('#sidebar')?.classList.add('open');
  $('#sidebar-overlay')?.classList.add('open');
}
function closeSidebarMobile() {
  $('#sidebar')?.classList.remove('open');
  $('#sidebar-overlay')?.classList.remove('open');
}

/* ========== MODAL ========== */
function openModal(html) {
  $('#modal-content').innerHTML = html;
  $('#modal-overlay').classList.add('open');
}
function closeModal() { $('#modal-overlay').classList.remove('open'); }

/* ========== RENDER PAGES ========== */
function renderPage() {
  const main = $('#main-content');
  if (!main) return;
  const id = state.currentPage;
  let html = '';
  switch (id) {
    case 'dashboard': html = renderDashboard(); break;
    case 'mes': html = renderMes(); break;
    case 'qhse': html = renderQhse(); break;
    case 'ci': html = renderCi(); break;
    case 'aktualnosci': html = renderNews(); break;
    case 'kalendarz': html = renderCalendar(); break;
    case 'kontakty': html = renderContacts(); break;
    case 'magazyn': html = renderWarehouse(); break;
    case 'park': html = renderPark(); break;
    case 'magazyn-ur': html = renderUrWarehouse(); break;
    case 'pracownicy': html = renderEmployees(); break;
    case 'awaria': html = renderFailure(); break;
    case 'czat': html = renderChat(); break;
    case 'dzial-mech': case 'dzial-jakosc': case 'dzial-admin':
    case 'dzial-magazyn': case 'dzial-produkcja':
      html = renderDept(id); break;
    case 'ustawienia': html = renderSettings(); break;
    default: html = '<div class="empty-state">Strona nie znaleziona</div>';
  }
  main.innerHTML = `<div class="page active">${html}</div>`;
  bindPageEvents(id);
}

function renderDashboard() {
  const machines = state.data.machines;
  const cnt = { ok: 0, check: 0, fail: 0 };
  machines.forEach(m => cnt[m.status] = (cnt[m.status] || 0) + 1);
  const openFails = state.data.failures.length;
  const upcoming = Object.entries(state.data.events)
    .filter(([k]) => k >= todayKey()).sort((a,b) => a[0].localeCompare(b[0])).slice(0, 3);
  const recentNews = [...state.data.news].sort((a,b) => (b.ts||0) - (a.ts||0)).slice(0, 3);
  const recentFails = [...state.data.failures].sort((a,b) => (b.ts||0) - (a.ts||0)).slice(0, 3);

  return `
    <div class="page-header">
      <h2 class="page-title">Panel główny</h2>
      <span style="font-size:0.85rem;color:var(--text-muted);">${nowStr()} ${state.cloud ? '· ☁ online' : '· lokalnie'}</span>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-value">${machines.length}</div><div class="kpi-label">Maszyny</div></div>
      <div class="kpi-card ok"><div class="kpi-value">${cnt.ok||0}</div><div class="kpi-label">Status OK</div></div>
      <div class="kpi-card warn"><div class="kpi-value">${cnt.check||0}</div><div class="kpi-label">Do kontroli</div></div>
      <div class="kpi-card danger"><div class="kpi-value">${cnt.fail||0}</div><div class="kpi-label">W awarii</div></div>
      <div class="kpi-card ${state.alertActive?'danger':''}"><div class="kpi-value">${openFails}</div><div class="kpi-label">Zgłoszenia</div></div>
      <div class="kpi-card"><div class="kpi-value">${state.data.warehouse.length}</div><div class="kpi-label">Produkty mag.</div></div>
      <div class="kpi-card"><div class="kpi-value">${(state.data.mes?.orders||[]).filter(o=>o.status==='in_progress').length}</div><div class="kpi-label">MES w toku</div></div>
    </div>
    <div class="quick-actions">
      <button class="quick-btn alert-btn" onclick="navigate('awaria')">⚠ Zgłoś awarię</button>
      <button class="quick-btn" onclick="navigate('mes')">🏭 MES Produkcja</button>
      <button class="quick-btn" onclick="navigate('qhse')">🛡 QHSE</button>
      <button class="quick-btn" onclick="navigate('ci')">◆ Lean / WCM</button>
      <button class="quick-btn" onclick="navigate('park')">⚙ Park maszyn</button>
      <button class="quick-btn" onclick="navigate('czat')">💬 Czat</button>
      <button class="quick-btn" onclick="navigate('kalendarz')">📅 Kalendarz</button>
      ${state.user ? '' : '<button class="quick-btn" onclick="showUserLogin()">🔑 Zaloguj się</button>'}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;">
      <div class="card">
        <div class="card-title">Ostatnie awarie</div>
        ${recentFails.length ? recentFails.map(f => `
          <div class="activity-item"><div class="activity-dot danger"></div>
          <div><div>${esc(f.title)}</div><div class="activity-time">${f.date||''} · ${esc(f.author||'')}</div></div></div>`).join('')
          : '<div class="empty-state" style="padding:1rem;">Brak zgłoszeń</div>'}
        ${state.alertActive && canClearAlert() ? '<button class="btn btn-secondary btn-sm" style="margin-top:0.6rem;" id="dash-clear-alert">Wyłącz alarm</button>' : ''}
      </div>
      <div class="card">
        <div class="card-title">Nadchodzące wydarzenia</div>
        ${upcoming.length ? upcoming.map(([k, evs]) => `
          <div class="activity-item"><div class="activity-dot"></div>
          <div><div><strong>${k}</strong> – ${esc(evs[0]?.title||'')}</div>
          <div class="activity-time">${esc(evs[0]?.desc||'')}</div></div></div>`).join('')
          : '<div class="empty-state" style="padding:1rem;">Brak zaplanowanych wydarzeń</div>'}
      </div>
      <div class="card">
        <div class="card-title">Ostatnie aktualności</div>
        ${recentNews.length ? recentNews.map(n => `
          <div class="activity-item"><div class="activity-dot"></div>
          <div><div>${esc(n.title)}</div><div class="activity-time">${n.date||''} · ${esc(n.author||'')}</div></div></div>`).join('')
          : '<div class="empty-state" style="padding:1rem;">Brak wpisów</div>'}
      </div>
    </div>`;
}


/* ========== MES HELPERS ========== */
let mesTab = 'overview';

function mesCalcOee() {
  const reports = state.data.mes.reports || [];
  const downtimes = state.data.mes.downtimes || [];
  const today = todayKey();
  const todayReports = reports.filter(r => (r.dateKey || '') === today || (r.date || '').startsWith(today.slice(8,10) === '' ? today : today));
  // simpler: use all recent or filter by dateKey
  const dayReports = reports.filter(r => r.dateKey === today);
  const dayDown = downtimes.filter(d => d.dateKey === today && !d.open);

  let good = 0, scrap = 0, plannedMin = 480; // default shift 8h
  dayReports.forEach(r => { good += Number(r.qtyGood || 0); scrap += Number(r.qtyScrap || 0); });
  let downMin = 0;
  dayDown.forEach(d => { downMin += Number(d.durationMin || 0); });
  // also open downtimes
  downtimes.filter(d => d.dateKey === today && d.open && d.startedAt).forEach(d => {
    downMin += Math.max(0, Math.round((Date.now() - d.startedAt) / 60000));
  });

  const total = good + scrap;
  const availableMin = Math.max(1, plannedMin - downMin);
  const availability = Math.min(100, Math.round((availableMin / plannedMin) * 1000) / 10);
  // performance: assume target 60 pcs/hour = 1/min
  const targetRate = 1; // pcs per minute
  const performance = total > 0 ? Math.min(100, Math.round((total / (availableMin * targetRate)) * 1000) / 10) : 0;
  const quality = total > 0 ? Math.round((good / total) * 1000) / 10 : 100;
  const oee = Math.round((availability * performance * quality / 10000) * 10) / 10;

  const orders = state.data.mes.orders || [];
  const active = orders.filter(o => o.status === 'in_progress').length;
  const planned = orders.filter(o => o.status === 'planned').length;
  const doneToday = orders.filter(o => o.status === 'completed' && o.completedDateKey === today).length;

  return { good, scrap, total, downMin, availability, performance, quality, oee, active, planned, doneToday, dayReports: dayReports.length };
}

function renderMes() {
  const can = canEdit('mes');
  const full = canEditMesFull();
  const canRep = canMesReport();
  const oee = mesCalcOee();
  const orders = [...(state.data.mes.orders || [])];
  const reports = [...(state.data.mes.reports || [])].sort((a,b)=>(b.ts||0)-(a.ts||0));
  const downtimes = [...(state.data.mes.downtimes || [])].sort((a,b)=>(b.ts||0)-(a.ts||0));
  const lines = state.data.mes.lines || [];
  const shifts = state.data.mes.shifts || [];
  const machines = state.data.machines || [];

  const tabs = [
    { id: 'overview', label: 'Przegląd OEE' },
    { id: 'orders', label: 'Zlecenia' },
    { id: 'queue', label: 'Kolejka' },
    { id: 'reports', label: 'Meldunki' },
    { id: 'downtime', label: 'Przestoje' },
    { id: 'changeover', label: 'Przezbrojenia' },
    { id: 'lines', label: 'Linie / Zmiany' },
    { id: 'admin', label: 'Konfiguracja' }
  ];
  const queue = [...(state.data.mes.queue || [])].sort((a,b)=>(a.seq||0)-(b.seq||0));
  const changeovers = [...(state.data.mes.changeovers || [])].sort((a,b)=>(b.ts||0)-(a.ts||0));

  let html = `
    <div class="page-header">
      <h2 class="page-title">🏭 MES – System Realizacji Produkcji</h2>
      ${state.cloud ? '<span style="font-size:0.75rem;color:var(--success);">☁ na żywo</span>' : ''}
    </div>
    <div class="mes-tabs" style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1rem;">
      ${tabs.map(t => `<button class="btn btn-sm ${mesTab===t.id?'btn-primary':'btn-secondary'}" data-mes-tab="${t.id}">${t.label}</button>`).join('')}
    </div>`;

  // ---- OVERVIEW ----
  if (mesTab === 'overview') {
    html += `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-value">${oee.oee}%</div><div class="kpi-label">OEE dziś</div></div>
        <div class="kpi-card ok"><div class="kpi-value">${oee.availability}%</div><div class="kpi-label">Dostępność</div></div>
        <div class="kpi-card warn"><div class="kpi-value">${oee.performance}%</div><div class="kpi-label">Wydajność</div></div>
        <div class="kpi-card ${oee.quality<95?'danger':'ok'}"><div class="kpi-value">${oee.quality}%</div><div class="kpi-label">Jakość</div></div>
        <div class="kpi-card"><div class="kpi-value">${oee.good}</div><div class="kpi-label">Szt. OK dziś</div></div>
        <div class="kpi-card danger"><div class="kpi-value">${oee.scrap}</div><div class="kpi-label">Braki dziś</div></div>
        <div class="kpi-card"><div class="kpi-value">${oee.active}</div><div class="kpi-label">Zlecenia aktywne</div></div>
        <div class="kpi-card warn"><div class="kpi-value">${oee.downMin} min</div><div class="kpi-label">Przestój dziś</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;">
        <div class="card">
          <div class="card-title">Aktywne zlecenia</div>
          ${orders.filter(o=>o.status==='in_progress').length ? orders.filter(o=>o.status==='in_progress').slice(0,5).map(o => `
            <div class="activity-item"><div class="activity-dot"></div>
            <div><div><strong>${esc(o.number)}</strong> – ${esc(o.product)}</div>
            <div class="activity-time">${o.qtyDone||0} / ${o.qtyPlan||0} szt. · ${esc(o.line||'')}</div></div></div>`).join('')
            : '<div class="empty-state" style="padding:1rem;">Brak aktywnych zleceń</div>'}
        </div>
        <div class="card">
          <div class="card-title">Otwarte przestoje</div>
          ${downtimes.filter(d=>d.open).length ? downtimes.filter(d=>d.open).map(d => `
            <div class="activity-item"><div class="activity-dot danger"></div>
            <div><div>${esc(d.machine||d.line||'—')} – ${esc(d.reason)}</div>
            <div class="activity-time">od ${d.date||''} · ${esc(d.author||'')}</div></div></div>`).join('')
            : '<div class="empty-state" style="padding:1rem;">Brak otwartych przestojów</div>'}
        </div>
        <div class="card">
          <div class="card-title">Ostatnie meldunki</div>
          ${reports.slice(0,5).length ? reports.slice(0,5).map(r => `
            <div class="activity-item"><div class="activity-dot"></div>
            <div><div>${esc(r.orderNumber||'')} · +${r.qtyGood||0} OK / ${r.qtyScrap||0} braki</div>
            <div class="activity-time">${r.date||''} · ${esc(r.author||'')}</div></div></div>`).join('')
            : '<div class="empty-state" style="padding:1rem;">Brak meldunków</div>'}
        </div>
      </div>`;
  }

  // ---- ORDERS ----
  if (mesTab === 'orders') {
    const statusLabel = { planned: 'Planowane', in_progress: 'W toku', paused: 'Wstrzymane', completed: 'Zakończone', cancelled: 'Anulowane' };
    const statusClass = { planned: 'warn', in_progress: 'ok', paused: 'warn', completed: '', cancelled: 'danger' };
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Zlecenia produkcyjne</span>
      ${full || can ? '<button class="btn btn-primary btn-sm" id="mes-add-order">+ Nowe zlecenie</button>' : ''}
    </div>`;
    if (!orders.length) html += '<div class="empty-state">Brak zleceń – dodaj pierwsze</div>';
    orders.forEach(o => {
      const pct = o.qtyPlan ? Math.min(100, Math.round((Number(o.qtyDone||0) / Number(o.qtyPlan)) * 100)) : 0;
      html += `<div class="card" style="border-left:4px solid ${o.status==='in_progress'?'var(--success)':o.status==='completed'?'var(--primary)':o.status==='paused'?'var(--warning)':'var(--border)'};">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.5rem;align-items:flex-start;">
          <div>
            <div class="card-title">${esc(o.number)} · ${esc(o.product)}</div>
            <div style="font-size:0.85rem;color:var(--text-muted);">Linia: ${esc(o.line||'—')} · Priorytet: ${esc(o.priority||'normal')} · Termin: ${esc(o.dueDate||'—')}</div>
            <div style="margin-top:0.4rem;font-size:0.9rem;"><strong>${o.qtyDone||0}</strong> / ${o.qtyPlan||0} szt. (${pct}%)</div>
            <div style="height:8px;background:var(--border);border-radius:4px;margin-top:6px;max-width:240px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:var(--success);border-radius:4px;"></div>
            </div>
            <span class="status-badge ${statusClass[o.status]||''}" style="margin-top:8px;">${statusLabel[o.status]||o.status}</span>
          </div>
          ${can ? `<div style="display:flex;flex-direction:column;gap:4px;">
            <select class="mes-order-status" data-id="${o.id}" style="padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);">
              <option value="planned" ${o.status==='planned'?'selected':''}>Planowane</option>
              <option value="in_progress" ${o.status==='in_progress'?'selected':''}>W toku</option>
              <option value="paused" ${o.status==='paused'?'selected':''}>Wstrzymane</option>
              <option value="completed" ${o.status==='completed'?'selected':''}>Zakończone</option>
              <option value="cancelled" ${o.status==='cancelled'?'selected':''}>Anulowane</option>
            </select>
            ${full ? `<button class="btn btn-danger btn-sm" data-del-order="${o.id}">Usuń</button>` : ''}
          </div>` : ''}
        </div>
        ${o.notes ? `<div style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted);">${esc(o.notes)}</div>` : ''}
      </div>`;
    });
  }

  // ---- REPORTS ----
  if (mesTab === 'reports') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Meldunki produkcyjne (sztuki OK / braki)</span>
      ${canRep ? '<button class="btn btn-primary btn-sm" id="mes-add-report">+ Meldunek</button>' : ''}
    </div>
    <div class="card" style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr><th>Data</th><th>Zlecenie</th><th>OK</th><th>Braki</th><th>Powód braków</th><th>Operator</th>${canRep?'<th></th>':''}</tr></thead>
        <tbody>`;
    if (!reports.length) html += '<tr><td colspan="7" class="empty-state">Brak meldunków</td></tr>';
    reports.slice(0, 50).forEach(r => {
      html += `<tr>
        <td>${esc(r.date||'')}</td><td>${esc(r.orderNumber||'')}</td>
        <td style="color:var(--success);font-weight:600;">${r.qtyGood||0}</td>
        <td style="color:var(--danger);font-weight:600;">${r.qtyScrap||0}</td>
        <td>${esc(r.scrapReason||'—')}</td><td>${esc(r.author||'')}</td>
        ${canRep && canEditMesFull() ? `<td><button class="btn btn-danger btn-sm" data-del-report="${r.id}">×</button></td>` : (canRep?'<td></td>':'')}
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // ---- DOWNTIME ----
  if (mesTab === 'downtime') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Rejestr przestojów</span>
      ${canRep ? '<button class="btn btn-primary btn-sm" id="mes-add-down">+ Zgłoś przestój</button>' : ''}
    </div>`;
    if (!downtimes.length) html += '<div class="empty-state">Brak przestojów</div>';
    downtimes.forEach(d => {
      html += `<div class="card" style="border-left:4px solid ${d.open?'var(--danger)':'var(--border)'};">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.5rem;">
          <div>
            <div class="card-title">${esc(d.reason)} ${d.open?'<span class="status-badge fail">OTWARTY</span>':''}</div>
            <div style="font-size:0.85rem;">Maszyna/linia: ${esc(d.machine||d.line||'—')}</div>
            <div style="font-size:0.85rem;color:var(--text-muted);">${d.date||''} · ${d.durationMin!=null?d.durationMin+' min':'w toku'} · ${esc(d.author||'')}</div>
            ${d.notes ? `<div style="margin-top:0.3rem;font-size:0.85rem;">${esc(d.notes)}</div>` : ''}
          </div>
          ${canRep && d.open ? `<button class="btn btn-secondary btn-sm" data-close-down="${d.id}">Zamknij przestój</button>` : ''}
          ${full ? `<button class="btn btn-danger btn-sm" data-del-down="${d.id}">Usuń</button>` : ''}
        </div>
      </div>`;
    });
  }


  // ---- QUEUE ----
  if (mesTab === 'queue') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Kolejka produkcyjna (kolejność realizacji na liniach)</span>
      ${full || can ? '<button class="btn btn-primary btn-sm" id="mes-add-queue">+ Do kolejki</button>' : ''}
    </div>`;
    if (!queue.length) html += '<div class="empty-state">Kolejka pusta – dodaj zlecenia do kolejki</div>';
    else {
      html += `<div class="card" style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>#</th><th>Zlecenie</th><th>Produkt</th><th>Linia</th><th>Priorytet</th><th>Status</th><th>Plan start</th>${can?'<th></th>':''}</tr></thead><tbody>`;
      queue.forEach((q, idx) => {
        html += `<tr>
          <td><strong>${q.seq != null ? q.seq : idx+1}</strong></td>
          <td>${esc(q.orderNumber||'')}</td>
          <td>${esc(q.product||'')}</td>
          <td>${esc(q.line||'—')}</td>
          <td>${esc(q.priority||'normal')}</td>
          <td><span class="status-badge ${q.status==='running'?'ok':q.status==='waiting'?'warn':''}">${esc(q.status||'waiting')}</span></td>
          <td>${esc(q.plannedStart||'—')}</td>
          ${can ? `<td style="white-space:nowrap;">
            <button class="btn btn-secondary btn-sm" data-q-up="${q.id}" title="Wyżej">↑</button>
            <button class="btn btn-secondary btn-sm" data-q-down="${q.id}" title="Niżej">↓</button>
            <button class="btn btn-primary btn-sm" data-q-start="${q.id}">Start</button>
            <button class="btn btn-danger btn-sm" data-del-queue="${q.id}">×</button>
          </td>` : ''}
        </tr>`;
      });
      html += `</tbody></table></div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;">↑↓ zmienia kolejność · Start ustawia status „running” i powiązane zlecenie na „w toku”</p>`;
    }
  }

  // ---- CHANGEOVERS ----
  if (mesTab === 'changeover') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Przezbrojenia linii / narzędzi</span>
      ${can ? '<button class="btn btn-primary btn-sm" id="mes-add-co">+ Przezbrojenie</button>' : ''}
    </div>`;
    if (!changeovers.length) html += '<div class="empty-state">Brak przezbrojeń</div>';
    changeovers.forEach(c => {
      html += `<div class="card">
        <div class="card-title">${esc(c.line||'')} · ${esc(c.fromProduct||'?')} → ${esc(c.toProduct||'?')}</div>
        <div style="font-size:0.85rem;">Czas planowany: ${c.plannedMin||'—'} min · Rzeczywisty: ${c.actualMin!=null?c.actualMin+' min':'—'}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);">${c.date||''} · ${esc(c.author||'')} · ${esc(c.status||'')}</div>
        ${c.notes?`<div style="margin-top:0.3rem;font-size:0.85rem;">${esc(c.notes)}</div>`:''}
        ${full?`<button class="btn btn-danger btn-sm" style="margin-top:0.4rem;" data-del-co="${c.id}">Usuń</button>`:''}
      </div>`;
    });
  }

  // ---- ADMIN / CONFIG (admin + kierownik) ----
  if (mesTab === 'admin') {
    if (!full) {
      html += '<div class="empty-state">Konfiguracja MES dostępna dla Administratora i Kierownika</div>';
    } else {
      html += `
        <div class="card">
          <div class="card-title">Zarządzanie MES</div>
          <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.8rem;">
            Konto <strong>Administrator</strong> i <strong>Kierownik</strong> mają pełną kontrolę: linie, zmiany, zlecenia, kolejka, usuwanie danych.
          </p>
          <div class="quick-actions">
            <button class="btn btn-primary btn-sm" id="mes-add-line">+ Nowa linia produkcyjna</button>
            <button class="btn btn-primary btn-sm" id="mes-add-shift">+ Nowa zmiana</button>
            <button class="btn btn-secondary btn-sm" id="mes-add-order">+ Zlecenie</button>
            <button class="btn btn-secondary btn-sm" id="mes-add-queue">+ Pozycja w kolejce</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Istniejące linie (${lines.length})</div>
          ${!lines.length ? '<div class="empty-state">Brak linii – utwórz pierwszą</div>' :
            lines.map(l => `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--border);">
              <div><strong>${esc(l.name)}</strong> · ${esc(l.status||'aktywna')} ${l.targetRate ? '· ' + l.targetRate + ' szt/h' : ''}
              <div style="font-size:0.8rem;color:var(--text-muted);">${esc(l.description||'')}</div></div>
              <button class="btn btn-danger btn-sm" data-del-line="${l.id}">Usuń</button>
            </div>`).join('')}
        </div>
        <div class="card">
          <div class="card-title">Zmiany (${shifts.length})</div>
          ${!shifts.length ? '<div class="empty-state">Brak zmian</div>' :
            shifts.map(s => `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);">
              <div><strong>${esc(s.name)}</strong> ${esc(s.start||'')}–${esc(s.end||'')}</div>
              <button class="btn btn-danger btn-sm" data-del-shift="${s.id}">Usuń</button>
            </div>`).join('')}
        </div>`;
    }
  }

  // ---- LINES / SHIFTS ----
  if (mesTab === 'lines') {
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;">
      <div>
        <div class="page-header" style="margin-top:0;">
          <span class="category-title" style="border:none;margin:0;">Linie produkcyjne</span>
          ${full ? '<button class="btn btn-primary btn-sm" id="mes-add-line">+ Linia</button>' : ''}
        </div>`;
    if (!lines.length) html += '<div class="empty-state">Brak linii</div>';
    lines.forEach(l => {
      html += `<div class="card">
        <div class="card-title">${esc(l.name)}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);">${esc(l.description||'')}</div>
        <div style="font-size:0.85rem;margin-top:4px;">Status: <strong>${esc(l.status||'aktywna')}</strong>
          ${l.targetRate ? ` · Cel: ${l.targetRate} szt/h` : ''}</div>
        ${full ? `<button class="btn btn-danger btn-sm" style="margin-top:0.5rem;" data-del-line="${l.id}">Usuń</button>` : ''}
      </div>`;
    });
    html += `</div><div>
      <div class="page-header" style="margin-top:0;">
        <span class="category-title" style="border:none;margin:0;">Zmiany</span>
        ${full ? '<button class="btn btn-primary btn-sm" id="mes-add-shift">+ Zmiana</button>' : ''}
      </div>`;
    if (!shifts.length) html += '<div class="empty-state">Brak zdefiniowanych zmian</div>';
    shifts.forEach(s => {
      html += `<div class="card">
        <div class="card-title">${esc(s.name)}</div>
        <div style="font-size:0.85rem;">${esc(s.start||'')} – ${esc(s.end||'')}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);">${esc(s.notes||'')}</div>
        ${full ? `<button class="btn btn-danger btn-sm" style="margin-top:0.5rem;" data-del-shift="${s.id}">Usuń</button>` : ''}
      </div>`;
    });
    html += `</div></div>`;
  }

  return html;
}



let qhseTab = 'incidents';

function renderQhse() {
  const can = canEdit('qhse');
  const full = state.user?.role === 'admin' || state.user?.role === 'kierownik';
  const q = state.data.qhse || { incidents: [], inspections: [], trainings: [], nearMisses: [], permits: [] };
  const tabs = [
    { id: 'incidents', label: 'Incydenty / wypadki' },
    { id: 'near', label: 'Near miss' },
    { id: 'inspections', label: 'Audyty / inspekcje' },
    { id: 'trainings', label: 'Szkolenia BHP' },
    { id: 'permits', label: 'Pozwolenia / PTW' },
    { id: 'overview', label: 'Podsumowanie' }
  ];

  let html = `
    <div class="page-header">
      <h2 class="page-title">🛡 QHSE – Jakość, BHP, Środowisko</h2>
      ${state.cloud ? '<span style="font-size:0.75rem;color:var(--success);">☁ na żywo</span>' : ''}
    </div>
    <div class="mes-tabs" style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1rem;">
      ${tabs.map(t => `<button class="btn btn-sm ${qhseTab===t.id?'btn-primary':'btn-secondary'}" data-qhse-tab="${t.id}">${t.label}</button>`).join('')}
    </div>`;

  if (qhseTab === 'overview') {
    html += `<div class="kpi-grid">
      <div class="kpi-card danger"><div class="kpi-value">${(q.incidents||[]).length}</div><div class="kpi-label">Incydenty</div></div>
      <div class="kpi-card warn"><div class="kpi-value">${(q.nearMisses||[]).length}</div><div class="kpi-label">Near miss</div></div>
      <div class="kpi-card"><div class="kpi-value">${(q.inspections||[]).length}</div><div class="kpi-label">Inspekcje</div></div>
      <div class="kpi-card ok"><div class="kpi-value">${(q.trainings||[]).length}</div><div class="kpi-label">Szkolenia</div></div>
      <div class="kpi-card"><div class="kpi-value">${(q.permits||[]).filter(x=>x.status==='active').length}</div><div class="kpi-label">Aktywne PTW</div></div>
    </div>
    <div class="card"><div class="card-title">Ostatnie zdarzenia</div>
      ${[...(q.incidents||[])].sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,5).map(i =>
        `<div class="activity-item"><div class="activity-dot danger"></div><div><div>${esc(i.title)}</div><div class="activity-time">${i.date||''} · ${esc(i.severity||'')} · ${esc(i.author||'')}</div></div></div>`
      ).join('') || '<div class="empty-state" style="padding:1rem;">Brak incydentów</div>'}
    </div>`;
  }

  if (qhseTab === 'incidents') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Rejestr incydentów i wypadków</span>
      ${can ? '<button class="btn btn-primary btn-sm" id="qhse-add-inc">+ Incydent</button>' : ''}
    </div>`;
    const items = [...(q.incidents||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
    if (!items.length) html += '<div class="empty-state">Brak wpisów</div>';
    items.forEach(i => {
      html += `<div class="card" style="border-left:4px solid var(--danger);">
        <div class="card-title">${esc(i.title)} <span class="status-badge ${i.severity==='high'?'fail':i.severity==='medium'?'check':'ok'}">${esc(i.severity||'')}</span></div>
        <div class="card-text">${esc(i.description||'')}</div>
        <div class="card-meta"><span>${i.date||''}</span><span>${esc(i.location||'')}</span><span>${esc(i.author||'')}</span>
          ${i.status?`<span>${esc(i.status)}</span>`:''}
          ${full?`<button class="btn btn-danger btn-sm" data-del-inc="${i.id}">Usuń</button>`:''}
        </div>
      </div>`;
    });
  }

  if (qhseTab === 'near') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Near miss – zdarzenia prawie wypadkowe</span>
      ${can ? '<button class="btn btn-primary btn-sm" id="qhse-add-nm">+ Near miss</button>' : ''}
    </div>`;
    const items = [...(q.nearMisses||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
    if (!items.length) html += '<div class="empty-state">Brak zgłoszeń</div>';
    items.forEach(i => {
      html += `<div class="card" style="border-left:4px solid var(--warning);">
        <div class="card-title">${esc(i.title)}</div>
        <div class="card-text">${esc(i.description||'')}</div>
        <div class="card-meta"><span>${i.date||''}</span><span>${esc(i.location||'')}</span><span>${esc(i.author||'')}</span>
          ${full?`<button class="btn btn-danger btn-sm" data-del-nm="${i.id}">Usuń</button>`:''}
        </div>
      </div>`;
    });
  }

  if (qhseTab === 'inspections') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Audyty i inspekcje</span>
      ${can ? '<button class="btn btn-primary btn-sm" id="qhse-add-insp">+ Inspekcja</button>' : ''}
    </div>`;
    const items = [...(q.inspections||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
    if (!items.length) html += '<div class="empty-state">Brak inspekcji</div>';
    items.forEach(i => {
      html += `<div class="card">
        <div class="card-title">${esc(i.title)} · wynik: <strong>${esc(i.result||'—')}</strong></div>
        <div class="card-text">${esc(i.findings||'')}</div>
        <div class="card-meta"><span>${i.date||''}</span><span>${esc(i.area||'')}</span><span>${esc(i.author||'')}</span>
          ${full?`<button class="btn btn-danger btn-sm" data-del-insp="${i.id}">Usuń</button>`:''}
        </div>
      </div>`;
    });
  }

  if (qhseTab === 'trainings') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Szkolenia BHP / QHSE</span>
      ${can ? '<button class="btn btn-primary btn-sm" id="qhse-add-tr">+ Szkolenie</button>' : ''}
    </div>
    <div class="card" style="overflow-x:auto;"><table class="data-table">
      <thead><tr><th>Temat</th><th>Data</th><th>Uczestnicy</th><th>Prowadzący</th>${full?'<th></th>':''}</tr></thead><tbody>`;
    const items = [...(q.trainings||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
    if (!items.length) html += '<tr><td colspan="5" class="empty-state">Brak szkoleń</td></tr>';
    items.forEach(i => {
      html += `<tr><td>${esc(i.topic)}</td><td>${esc(i.date||'')}</td><td>${esc(i.participants||'')}</td><td>${esc(i.trainer||'')}</td>
        ${full?`<td><button class="btn btn-danger btn-sm" data-del-tr="${i.id}">×</button></td>`:''}</tr>`;
    });
    html += `</tbody></table></div>`;
  }

  if (qhseTab === 'permits') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="color:var(--text-muted);font-size:0.9rem;">Pozwolenia na pracę (PTW)</span>
      ${can ? '<button class="btn btn-primary btn-sm" id="qhse-add-ptw">+ Pozwolenie</button>' : ''}
    </div>`;
    const items = [...(q.permits||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
    if (!items.length) html += '<div class="empty-state">Brak pozwoleń</div>';
    items.forEach(i => {
      html += `<div class="card" style="border-left:4px solid ${i.status==='active'?'var(--warning)':'var(--border)'};">
        <div class="card-title">${esc(i.workType)} · ${esc(i.location||'')}</div>
        <div style="font-size:0.85rem;">Ważne: ${esc(i.validFrom||'')} – ${esc(i.validTo||'')} · Status: <strong>${esc(i.status||'')}</strong></div>
        <div style="font-size:0.85rem;color:var(--text-muted);">${esc(i.issuer||'')} · ${i.date||''}</div>
        ${can ? `<div style="margin-top:0.4rem;display:flex;gap:0.4rem;">
          ${i.status==='active'?`<button class="btn btn-secondary btn-sm" data-close-ptw="${i.id}">Zamknij</button>`:''}
          ${full?`<button class="btn btn-danger btn-sm" data-del-ptw="${i.id}">Usuń</button>`:''}
        </div>`:''}
      </div>`;
    });
  }

  return html;
}



let ciTab = 'philo';

const CI_COL_MAP = {
  initiatives: 'ciInitiatives', kanban: 'ciKanban', pokaYoke: 'ciPokaYoke',
  jidoka: 'ciJidoka', andon: 'ciAndon', heijunka: 'ciHeijunka', hoshin: 'ciHoshin',
  muda: 'ciMuda', tpm: 'ciTpm', gemba: 'ciGemba', kpis: 'ciKpis'
};

async function ciAdd(key, item) {
  if (state.cloud) await cloudAdd(CI_COL_MAP[key], item);
  else { item.id = uid(); state.data.ci[key].push(item); persist(); }
}
async function ciDel(key, id) {
  if (state.cloud) await cloudDelete(CI_COL_MAP[key], id);
  else { state.data.ci[key] = state.data.ci[key].filter(x => x.id !== id); persist(); }
}
async function ciSet(key, id, patch) {
  if (state.cloud) await cloudSet(CI_COL_MAP[key], id, patch);
  else {
    const x = state.data.ci[key].find(i => i.id === id);
    if (x) Object.assign(x, patch);
    persist();
  }
}

function renderCi() {
  const can = canEdit('ci');
  const full = state.user?.role === 'admin' || state.user?.role === 'kierownik';
  const ci = state.data.ci || {};
  const tabs = [
    { id: 'philo', label: 'Filozofie' },
    { id: 'methods', label: 'Metody' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'andon', label: 'Andon' },
    { id: 'losses', label: '3M / TPM / Gemba' },
    { id: 'kpi', label: 'KPI' }
  ];

  let html = `
    <div class="page-header">
      <h2 class="page-title">◆ Lean · WCM · Continuous Improvement</h2>
      ${state.cloud ? '<span style="font-size:0.75rem;color:var(--success);">☁</span>' : '<span style="font-size:0.75rem;color:var(--warning);">○ lokalnie</span>'}
    </div>
    <div class="mes-tabs" style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1rem;">
      ${tabs.map(t => `<button class="btn btn-sm ${ciTab===t.id?'btn-primary':'btn-secondary'}" data-ci-tab="${t.id}">${t.label}</button>`).join('')}
    </div>`;

  // PHILOSOPHIES
  if (ciTab === 'philo') {
    const defs = [
      { key: 'WCM', title: 'WCM – World Class Manufacturing', desc: 'Zintegrowany system zarządzania produkcją: eliminacja strat i dążenie do doskonałości operacyjnej.' },
      { key: 'Six Sigma', title: 'Six Sigma', desc: 'Metoda oparta na analizie statystycznej – minimalizacja błędów i zmienności procesów (DMAIC).' },
      { key: 'Lean', title: 'Lean Manufacturing / Management', desc: 'Dostarczanie wartości klientowi przy eliminacji marnotrawstwa (muda).' },
      { key: 'TQM', title: 'TQM – Total Quality Management', desc: 'Kompleksowe zarządzanie przez jakość z zaangażowaniem wszystkich pracowników.' }
    ];
    html += `<div class="ci-grid">`;
    defs.forEach(d => {
      const items = (ci.initiatives||[]).filter(i => i.system === d.key);
      html += `<div class="card ci-method-card">
        <h3>${d.title}</h3>
        <p>${d.desc}</p>
        <div style="font-size:0.8rem;margin-bottom:0.5rem;">Aktywne inicjatywy: <strong>${items.length}</strong></div>
        ${items.slice(0,3).map(i => `<div class="activity-item"><div class="activity-dot"></div><div><div>${esc(i.title)}</div><div class="activity-time">${esc(i.status||'')} · ${i.date||''}</div></div></div>`).join('')}
        ${can ? `<button class="btn btn-primary btn-sm" data-ci-init="${d.key}">+ Inicjatywa ${d.key}</button>` : ''}
      </div>`;
    });
    html += `</div>
      <div class="card" style="margin-top:1rem;"><div class="card-title">Wszystkie inicjatywy CI</div>`;
    const all = [...(ci.initiatives||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
    if (!all.length) html += '<div class="empty-state">Brak inicjatyw – dodaj pierwszą</div>';
    all.forEach(i => {
      html += `<div style="display:flex;justify-content:space-between;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--border);flex-wrap:wrap;">
        <div><strong>[${esc(i.system)}]</strong> ${esc(i.title)}
          <div style="font-size:0.8rem;color:var(--text-muted);">${esc(i.description||'')} · ${esc(i.status||'')} · ${i.date||''}</div></div>
        ${full?`<button class="btn btn-danger btn-sm" data-del-init="${i.id}">Usuń</button>`:''}
      </div>`;
    });
    html += `</div>`;
  }

  // METHODS overview
  if (ciTab === 'methods') {
    const methods = [
      { t: 'Poka-Yoke', d: 'Błędoodporność – zapobieganie błędom ludzkim.', key: 'pokaYoke', btn: 'poka' },
      { t: 'Jidoka', d: 'Autonomizacja – zatrzymanie przy wykryciu usterki.', key: 'jidoka', btn: 'jidoka' },
      { t: 'Heijunka', d: 'Poziomowanie produkcji – wygładzanie obciążenia.', key: 'heijunka', btn: 'heijunka' },
      { t: 'Hoshin Kanri', d: 'Cele strategiczne powiązane z działaniami codziennymi.', key: 'hoshin', btn: 'hoshin' }
    ];
    html += `<div class="ci-grid">`;
    methods.forEach(m => {
      const n = (ci[m.key]||[]).length;
      html += `<div class="card ci-method-card"><h3>${m.t}</h3><p>${m.d}</p>
        <div style="font-size:0.85rem;margin-bottom:0.5rem;">Wpisy: <strong>${n}</strong></div>
        ${can?`<button class="btn btn-primary btn-sm" data-ci-method="${m.btn}">+ Dodaj</button>`:''}
      </div>`;
    });
    html += `</div>`;
    // lists
    [['pokaYoke','Poka-Yoke','del-poka'],['jidoka','Jidoka','del-jidoka'],['heijunka','Heijunka','del-heijunka'],['hoshin','Hoshin Kanri','del-hoshin']].forEach(([key, title, del]) => {
      const items = ci[key]||[];
      if (!items.length) return;
      html += `<div class="card"><div class="card-title">${title}</div>`;
      items.forEach(i => {
        html += `<div style="padding:0.4rem 0;border-bottom:1px solid var(--border);font-size:0.88rem;">
          <strong>${esc(i.title||i.name||'')}</strong> ${esc(i.description||i.notes||'')}
          <span style="color:var(--text-muted);font-size:0.78rem;"> · ${i.date||''}</span>
          ${full?` <button class="btn btn-danger btn-sm" data-${del}="${i.id}">×</button>`:''}
        </div>`;
      });
      html += `</div>`;
    });
  }

  // KANBAN
  if (ciTab === 'kanban') {
    const cols = ['Backlog', 'Do zrobienia', 'W toku', 'Blokada', 'Gotowe'];
    html += `<div class="page-header" style="margin-top:0;">
      <span style="font-size:0.85rem;color:var(--text-muted);">Tablica Kanban – sterowanie przepływem (JIT)</span>
      ${can?'<button class="btn btn-primary btn-sm" id="ci-add-kanban">+ Karta</button>':''}
    </div><div class="kanban-board">`;
    cols.forEach(col => {
      const cards = (ci.kanban||[]).filter(k => (k.column||'Backlog') === col);
      html += `<div class="kanban-col"><h4>${col} (${cards.length})</h4>`;
      cards.forEach(k => {
        html += `<div class="kanban-card"><strong>${esc(k.title)}</strong>
          <span style="font-size:0.75rem;color:var(--text-muted);">${esc(k.assignee||'')} · ${esc(k.priority||'')}</span>
          ${can?`<div style="margin-top:4px;display:flex;gap:2px;flex-wrap:wrap;">
            ${cols.filter(c=>c!==col).map(c=>`<button class="btn btn-secondary btn-sm" data-kanban-move="${k.id}|${c}" style="font-size:0.65rem;padding:2px 6px;">${c}</button>`).join('')}
            ${full?`<button class="btn btn-danger btn-sm" data-del-kanban="${k.id}" style="font-size:0.65rem;padding:2px 6px;">×</button>`:''}
          </div>`:''}
        </div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
  }

  // ANDON
  if (ciTab === 'andon') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="font-size:0.85rem;color:var(--text-muted);">System Andon – sygnalizacja statusu</span>
      ${can?'<button class="btn btn-primary btn-sm" id="ci-add-andon">+ Stanowisko</button>':''}
    </div>
    <div class="andon-board">`;
    const andon = ci.andon||[];
    if (!andon.length) html += '<div class="empty-state" style="grid-column:1/-1;">Brak stanowisk Andon – dodaj linię/stanowisko</div>';
    andon.forEach(a => {
      const st = a.status || 'green';
      const label = { green: 'OK / PRODUKCJA', yellow: 'UWAGA / POMOC', red: 'STOP / PROBLEM' }[st] || st;
      html += `<div class="andon-light ${st}">
        <div style="font-size:1.1rem;">${esc(a.station||a.name||'?')}</div>
        <div class="andon-label">${label}</div>
        ${a.message?`<div class="andon-label">${esc(a.message)}</div>`:''}
        ${can?`<div style="margin-top:0.5rem;display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-sm btn-secondary" data-andon-st="${a.id}|green" style="padding:2px 8px;">●</button>
          <button class="btn btn-sm btn-secondary" data-andon-st="${a.id}|yellow" style="padding:2px 8px;">●</button>
          <button class="btn btn-sm btn-secondary" data-andon-st="${a.id}|red" style="padding:2px 8px;">●</button>
          ${full?`<button class="btn btn-sm btn-danger" data-del-andon="${a.id}" style="padding:2px 6px;">×</button>`:''}
        </div>`:''}
      </div>`;
    });
    html += `</div>`;
  }

  // LOSSES / TPM / GEMBA
  if (ciTab === 'losses') {
    html += `<div class="ci-grid">
      <div class="card ci-method-card"><h3>Muda / Mura / Muri (3M)</h3>
        <p>Marnotrawstwo, nieregularność, przeciążenie – rejestr strat procesowych.</p>
        ${can?'<button class="btn btn-primary btn-sm" id="ci-add-muda">+ Strata 3M</button>':''}
      </div>
      <div class="card ci-method-card"><h3>TPM</h3>
        <p>Total Productive Maintenance – maksymalizacja efektywności maszyn (powiązane z OEE).</p>
        ${can?'<button class="btn btn-primary btn-sm" id="ci-add-tpm">+ Działanie TPM</button>':''}
      </div>
      <div class="card ci-method-card"><h3>Gemba Walk</h3>
        <p>Obserwacja procesów w miejscu pracy – fakty, nie raporty.</p>
        ${can?'<button class="btn btn-primary btn-sm" id="ci-add-gemba">+ Gemba Walk</button>':''}
      </div>
    </div>`;
    const muda = ci.muda||[];
    if (muda.length) {
      html += `<div class="card"><div class="card-title">Rejestr 3M</div><table class="data-table"><thead><tr><th>Typ</th><th>Opis</th><th>Obszar</th><th>Data</th>${full?'<th></th>':''}</tr></thead><tbody>`;
      muda.forEach(m => {
        html += `<tr><td><strong>${esc(m.type)}</strong></td><td>${esc(m.description)}</td><td>${esc(m.area||'')}</td><td>${m.date||''}</td>
          ${full?`<td><button class="btn btn-danger btn-sm" data-del-muda="${m.id}">×</button></td>`:''}</tr>`;
      });
      html += `</tbody></table></div>`;
    }
    (ci.tpm||[]).forEach(t => {
      html += `<div class="card"><div class="card-title">TPM: ${esc(t.title)}</div>
        <div style="font-size:0.85rem;">${esc(t.description||'')} · Maszyna: ${esc(t.machine||'—')}</div>
        <div class="card-meta">${t.date||''} · ${esc(t.author||'')} ${full?`<button class="btn btn-danger btn-sm" data-del-tpm="${t.id}">Usuń</button>`:''}</div></div>`;
    });
    (ci.gemba||[]).forEach(g => {
      html += `<div class="card"><div class="card-title">Gemba: ${esc(g.area||'Hala')}</div>
        <div style="font-size:0.85rem;">${esc(g.findings||'')}</div>
        <div style="font-size:0.85rem;color:var(--primary);">Działania: ${esc(g.actions||'—')}</div>
        <div class="card-meta">${g.date||''} · ${esc(g.author||'')} ${full?`<button class="btn btn-danger btn-sm" data-del-gemba="${g.id}">Usuń</button>`:''}</div></div>`;
    });
  }

  // KPI
  if (ciTab === 'kpi') {
    html += `<div class="page-header" style="margin-top:0;">
      <span style="font-size:0.85rem;color:var(--text-muted);">OTIF · FTT / RTY · Cycle Time · Lead Time</span>
      ${can?'<button class="btn btn-primary btn-sm" id="ci-add-kpi">+ Pomiar KPI</button>':''}
    </div>`;
    const kpis = [...(ci.kpis||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
    // summary cards for latest of each type
    const types = ['OTIF', 'FTT', 'RTY', 'Cycle Time', 'Lead Time'];
    html += `<div class="kpi-grid">`;
    types.forEach(t => {
      const last = kpis.find(k => k.metric === t);
      html += `<div class="kpi-card"><div class="kpi-value">${last ? esc(String(last.value)) + (last.unit||'') : '—'}</div>
        <div class="kpi-label">${t}</div>
        ${last?`<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">${last.date||''}</div>`:''}
      </div>`;
    });
    html += `</div>
      <div class="card" style="overflow-x:auto;"><table class="data-table">
      <thead><tr><th>Metryka</th><th>Wartość</th><th>Cel</th><th>Okres</th><th>Data</th>${full?'<th></th>':''}</tr></thead><tbody>`;
    if (!kpis.length) html += '<tr><td colspan="6" class="empty-state">Brak pomiarów</td></tr>';
    kpis.forEach(k => {
      html += `<tr><td><strong>${esc(k.metric)}</strong></td><td>${esc(k.value)}${esc(k.unit||'')}</td>
        <td>${esc(k.target||'—')}</td><td>${esc(k.period||'')}</td><td>${k.date||''}</td>
        ${full?`<td><button class="btn btn-danger btn-sm" data-del-kpi="${k.id}">×</button></td>`:''}</tr>`;
    });
    html += `</tbody></table></div>
      <div class="card" style="margin-top:0.8rem;font-size:0.82rem;color:var(--text-muted);">
        <strong style="color:var(--primary);">Definicje:</strong>
        OTIF – dostawa na czas i w pełnej ilości · FTT – przejście procesu bez poprawek · RTY – łączna wydajność przejścia ·
        Cycle Time – czas wykonania 1 szt. · Lead Time – od zamówienia do dostawy.
      </div>`;
  }

  return html;
}


function renderNews() {
  const can = canEdit('aktualnosci');
  const items = [...state.data.news].sort((a,b) => (b.ts||0) - (a.ts||0));
  let html = `<div class="page-header"><h2 class="page-title">Aktualności</h2>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      ${can ? '<button class="btn btn-primary btn-sm" id="add-news-btn">+ Dodaj wpis</button>' : ''}
      ${canDownloadReport() ? '<button class="btn btn-secondary btn-sm" onclick="downloadReport(\'aktualnosci\')">Pobierz raport</button>' : ''}
    </div></div>`;
  if (!items.length) html += '<div class="empty-state">Brak wpisów</div>';
  items.forEach(n => {
    html += `<div class="card"><div class="card-title">${esc(n.title)}</div>
      <div class="card-body">${n.img ? `<img class="card-img" src="${n.img}" alt="">` : ''}
      <div class="card-text">${esc(n.text||'').replace(/\n/g,'<br>')}</div></div>
      <div class="card-meta"><span>${n.date||''}</span><span>${esc(n.author||'')}</span>
      ${can ? `<button class="btn btn-danger btn-sm" data-del-news="${n.id}">Usuń</button>` : ''}</div></div>`;
  });
  return html;
}

let calYear, calMonth;
function renderCalendar() {
  const now = new Date();
  if (calYear === undefined) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
  const can = canEdit('kalendarz');
  const first = new Date(calYear, calMonth, 1);
  const startDay = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  let html = `<div class="page-header"><h2 class="page-title">Kalendarz</h2>
    ${canDownloadReport() ? '<button class="btn btn-secondary btn-sm" onclick="downloadReport(\'kalendarz\')">Pobierz raport</button>' : ''}</div>
    <div class="cal-nav">
      <button class="btn btn-secondary btn-sm" id="cal-prev">‹</button>
      <strong>${monthNames[calMonth]} ${calYear}</strong>
      <button class="btn btn-secondary btn-sm" id="cal-next">›</button>
    </div>
    <div class="cal-grid">${['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => `<div class="cal-day-name">${d}</div>`).join('')}`;
  for (let i = 0; i < startDay; i++) html += `<div class="cal-cell other"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const has = state.data.events[key]?.length > 0;
    const isToday = key === todayKey();
    html += `<div class="cal-cell${has?' has-event':''}${isToday?' today':''}" data-day="${key}">${d}</div>`;
  }
  html += `</div><div id="cal-detail" style="margin-top:1rem;"></div>`;
  return html;
}

function renderContacts() {
  const can = state.user?.role === 'admin' || state.user?.role === 'biuro';
  let html = `<div class="page-header"><h2 class="page-title">Lista Kontaktów</h2>
    ${can ? '<button class="btn btn-primary btn-sm" id="add-contact-btn">+ Dodaj</button>' : ''}</div>
    <div class="card" style="overflow-x:auto;"><table class="data-table">
    <thead><tr><th>Imię</th><th>Nazwisko</th><th>Stanowisko</th><th>Kontakt</th>${can?'<th></th>':''}</tr></thead><tbody>`;
  state.data.contacts.forEach(c => {
    html += `<tr><td>${esc(c.first)}</td><td>${esc(c.last)}</td><td>${esc(c.pos)}</td><td>${esc(c.contact)}</td>
      ${can?`<td><button class="btn btn-danger btn-sm" data-del-contact="${c.id}">×</button></td>`:''}</tr>`;
  });
  if (!state.data.contacts.length) html += '<tr><td colspan="5" class="empty-state">Brak kontaktów</td></tr>';
  html += `</tbody></table></div>`;
  return html;
}

function renderWarehouse() {
  const can = canEdit('magazyn');
  let html = `<div class="page-header"><h2 class="page-title">Magazyn</h2>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      ${can ? '<button class="btn btn-primary btn-sm" id="add-wh-btn">+ Dodaj produkt</button>' : ''}
      ${canDownloadReport() ? '<button class="btn btn-secondary btn-sm" onclick="downloadReport(\'magazyn\')">Pobierz raport</button>' : ''}
    </div></div>
    <div class="card" style="overflow-x:auto;"><table class="data-table">
    <thead><tr><th>Nazwa</th><th>Ilość</th><th>Jednostka</th>${can?'<th></th>':''}</tr></thead><tbody>`;
  state.data.warehouse.forEach(p => {
    html += `<tr><td>${esc(p.name)}</td><td>${esc(p.qty)}</td><td>${esc(p.unit)}</td>
      ${can?`<td><button class="btn btn-danger btn-sm" data-del-wh="${p.id}">×</button></td>`:''}</tr>`;
  });
  if (!state.data.warehouse.length) html += '<tr><td colspan="4" class="empty-state">Magazyn pusty</td></tr>';
  html += `</tbody></table></div>`;
  return html;
}

function renderPark() {
  const can = canEdit('park');
  const machines = [...state.data.machines].sort((a,b) => {
    const order = { fail: 0, check: 1, ok: 2 };
    return (order[a.status]||2) - (order[b.status]||2);
  });
  const cnt = { ok: 0, check: 0, fail: 0 };
  machines.forEach(m => cnt[m.status] = (cnt[m.status]||0)+1);
  let html = `<div class="page-header"><h2 class="page-title">Park Maszyn</h2>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      ${can ? '<button class="btn btn-primary btn-sm" id="add-machine-btn">+ Dodaj maszynę</button>' : ''}
      ${canDownloadReport() ? '<button class="btn btn-secondary btn-sm" onclick="downloadReport(\'park\')">Pobierz raport</button>' : ''}
    </div></div>
    <div class="stats-bar">
      <span class="stat-pill">Razem: ${machines.length}</span>
      <span class="stat-pill ok">OK: ${cnt.ok||0}</span>
      <span class="stat-pill warn">Do kontroli: ${cnt.check||0}</span>
      <span class="stat-pill danger">Awaria: ${cnt.fail||0}</span>
    </div>`;
  if (!machines.length) html += '<div class="empty-state">Brak maszyn</div>';
  machines.forEach(m => {
    const stLabel = { ok: 'OK', check: 'DO KONTROLI', fail: 'AWARIA' }[m.status] || m.status;
    html += `<div class="card machine-card status-${m.status}">
      ${m.img ? `<img class="machine-img" src="${m.img}" alt="">` : ''}
      <div class="machine-info">
        <div class="machine-name">${esc(m.name)}</div>
        <div class="machine-model">${esc(m.model)}</div>
        <div class="machine-service">Serwis: ${esc(m.service)}</div>
        <span class="status-badge ${m.status}">${stLabel}</span>
      </div>
      ${can ? `<div style="display:flex;flex-direction:column;gap:4px;">
        <select class="machine-status-sel" data-id="${m.id}" style="padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);">
          <option value="ok" ${m.status==='ok'?'selected':''}>OK</option>
          <option value="check" ${m.status==='check'?'selected':''}>Do kontroli</option>
          <option value="fail" ${m.status==='fail'?'selected':''}>Awaria</option>
        </select>
        <button class="btn btn-danger btn-sm" data-del-machine="${m.id}">Usuń</button>
      </div>` : ''}
    </div>`;
  });
  return html;
}

function renderUrWarehouse() {
  const can = canEdit('magazyn-ur');
  let html = `<div class="page-header"><h2 class="page-title">Magazyn Utrzymania Ruchu</h2>
    ${can ? '<button class="btn btn-primary btn-sm" id="add-ur-btn">+ Dodaj pozycję</button>' : ''}</div>`;
  Object.keys(state.data.urWarehouse).forEach(cat => {
    html += `<div class="category-block"><div class="category-title">${cat}</div>`;
    const items = state.data.urWarehouse[cat];
    if (!items.length) html += '<div style="font-size:0.85rem;color:var(--text-muted);padding:4px 0;">Brak pozycji</div>';
    else {
      html += `<div class="card" style="overflow-x:auto;"><table class="data-table"><thead><tr><th>Nazwa</th><th>Ilość</th>${can?'<th></th>':''}</tr></thead><tbody>`;
      items.forEach(i => {
        html += `<tr><td>${esc(i.name)}</td><td>${esc(i.qty)}</td>
          ${can?`<td><button class="btn btn-danger btn-sm" data-del-ur="${i.id}">×</button></td>`:''}</tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;
  });
  return html;
}

function renderEmployees() {
  const can = canEdit('pracownicy');
  let html = `<div class="page-header"><h2 class="page-title">Lista Pracowników</h2>
    ${can ? '<button class="btn btn-primary btn-sm" id="add-emp-btn">+ Dodaj pracownika</button>' : ''}</div>`;
  Object.keys(state.data.employees).forEach(cat => {
    html += `<div class="category-block"><div class="category-title">${cat}</div>`;
    const items = state.data.employees[cat];
    if (!items.length) html += '<div style="font-size:0.85rem;color:var(--text-muted);padding:4px 0;">Brak</div>';
    else {
      html += `<div class="card" style="overflow-x:auto;"><table class="data-table"><thead><tr><th>Imię i nazwisko</th><th>Stanowisko</th>${can?'<th></th>':''}</tr></thead><tbody>`;
      items.forEach(e => {
        html += `<tr><td>${esc(e.name)}</td><td>${esc(e.pos)}</td>
          ${can?`<td><button class="btn btn-danger btn-sm" data-del-emp="${e.id}">×</button></td>`:''}</tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;
  });
  return html;
}

function getAwariaQrUrl() {
  const base = window.location.origin + window.location.pathname.replace(/index\.html$/i, '');
  const clean = base.endsWith('/') ? base : base + '/';
  return clean + '?open=awaria';
}

function renderFailure() {
  const qrUrl = getAwariaQrUrl();
  const qrImg = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=' + encodeURIComponent(qrUrl);
  let html = `<div class="page-header"><h2 class="page-title" style="color:var(--danger);">⚠ Zgłoś Awarię</h2>
      <button class="btn btn-secondary btn-sm" id="print-qr-btn">🖨 Drukuj kod QR</button>
    </div>
    <div class="card" style="border:2px solid var(--danger);">
      <div class="form-row"><div class="form-group" style="flex:2;">
        <label>Tytuł awarii</label><input type="text" id="fail-title" placeholder="np. Awaria prasy hydraulicznej" autofocus>
      </div></div>
      <div class="form-row"><div class="form-group">
        <label>Opis</label><textarea id="fail-desc" placeholder="Krótki opis problemu..."></textarea>
      </div></div>
      <div class="form-row"><div class="form-group">
        <label>Zgłaszający (opcjonalnie)</label><input type="text" id="fail-author" placeholder="${state.user ? esc(state.user.label) : 'np. Operator Linia 2'}" value="${state.user ? esc(state.user.label) : ''}">
      </div></div>
      <button class="btn btn-danger" id="submit-fail">⚠ Zgłoś awarię</button>
    </div>

    <div class="card qr-print-card" id="qr-print-section" style="text-align:center;margin-top:1rem;">
      <div class="card-title">Kod QR – szybkie zgłoszenie awarii</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin:0.5rem 0 1rem;">Zeskanuj telefonem → otwiera formularz zgłoszenia awarii</p>
      <img src="${qrImg}" alt="QR Zgłoś awarię" width="280" height="280" style="border-radius:12px;background:#fff;padding:12px;max-width:100%;height:auto;" id="awaria-qr-img">
      <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.75rem;word-break:break-all;">${esc(qrUrl)}</p>
      <p style="font-size:0.8rem;margin-top:0.5rem;"><strong>Wydrukuj i umieść przy maszynach / na hali</strong></p>
    </div>

    <h3 style="margin:1.2rem 0 0.6rem;font-size:1rem;color:var(--primary);">Historia zgłoszeń</h3>`;
  const fails = [...state.data.failures].sort((a,b)=>(b.ts||0)-(a.ts||0));
  if (!fails.length) html += '<div class="empty-state">Brak zgłoszeń</div>';
  fails.forEach(f => {
    html += `<div class="card" style="border-left:4px solid var(--danger);">
      <div class="card-title">${esc(f.title)}</div>
      <div class="card-text">${esc(f.desc||'')}</div>
      <div class="card-meta"><span>${f.date||''}</span><span>${esc(f.author||'')}</span>
      ${canClearAlert() && state.alertActive ? `<button class="btn btn-secondary btn-sm" id="clear-alert-btn">Wyłącz alarm</button>` : ''}
      </div></div>`;
  });
  return html;
}

function renderChat() {
  const can = !!state.user;
  let html = `<div class="page-header"><h2 class="page-title">Czat Firmowy</h2>
    ${state.cloud ? '<span style="font-size:0.75rem;color:var(--success);">☁ na żywo</span>' : ''}</div>
    <div class="chat-container"><div class="chat-messages" id="chat-messages">`;
  const msgs = [...state.data.chat].sort((a,b)=>(b.ts||0)-(a.ts||0));
  if (!msgs.length) html += '<div class="empty-state">Brak wiadomości – napisz pierwszą!</div>';
  msgs.forEach(m => {
    const own = state.user && m.author === state.user.label;
    html += `<div class="chat-msg${own?' own':''}">
      <div class="msg-author">${esc(m.author)}</div><div>${esc(m.text)}</div>
      <div class="msg-time">${m.date||''}</div></div>`;
  });
  html += `</div><div class="chat-input-row">
    <input type="text" id="chat-input" placeholder="${can?'Napisz wiadomość...':'Zaloguj się, aby pisać'}" ${can?'':'disabled'}>
    <button class="btn btn-primary" id="chat-send" ${can?'':'disabled'}>Wyślij</button>
  </div></div>`;
  return html;
}

function renderDept(id) {
  const labels = {
    'dzial-mech': 'Dział Mechaniczny', 'dzial-jakosc': 'Dział Jakości',
    'dzial-admin': 'Dział Administracji', 'dzial-magazyn': 'Dział Magazyn',
    'dzial-produkcja': 'Dział Produkcji'
  };
  const can = canEdit(id);
  const items = [...(state.data.depts[id]||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
  let html = `<div class="page-header"><h2 class="page-title">${labels[id]}</h2>
    ${can ? '<button class="btn btn-primary btn-sm" id="add-dept-btn">+ Dodaj wpis</button>' : ''}</div>`;
  if (!items.length) html += '<div class="empty-state">Brak wpisów</div>';
  items.forEach(n => {
    html += `<div class="card"><div class="card-title">${esc(n.title)}</div>
      <div class="card-text">${esc(n.text||'').replace(/\n/g,'<br>')}</div>
      ${n.fileName ? `<div class="file-item"><a href="${n.fileData}" download="${esc(n.fileName)}">📎 ${esc(n.fileName)}</a></div>` : ''}
      <div class="card-meta"><span>${n.date||''}</span><span>${esc(n.author||'')}</span>
      ${can ? `<button class="btn btn-danger btn-sm" data-del-dept="${n.id}">Usuń</button>` : ''}</div></div>`;
  });
  return html;
}

function renderSettings() {
  if (state.user?.role !== 'admin') return '<div class="empty-state">Brak dostępu</div>';
  let html = `<div class="page-header"><h2 class="page-title">Ustawienia Administratora</h2></div>
    <div class="card settings-section">
      <h3>Status chmury</h3>
      <p style="font-size:0.9rem;margin-bottom:0.5rem;">
        ${state.cloud
          ? '<span style="color:var(--success);">☁ Firebase Firestore – synchronizacja włączona</span>'
          : '<span style="color:var(--warning);">○ Tryb lokalny – uzupełnij js/firebase-config.js</span>'}
      </p>
    </div>
    <div class="card settings-section">
      <h3>Motyw kolorystyczny</h3>
      <div class="theme-btns">
        <button class="theme-btn${state.theme==='light'?' active':''}" data-theme="light">Jasny</button>
        <button class="theme-btn${state.theme==='dark'?' active':''}" data-theme="dark">Ciemny</button>
        <button class="theme-btn${state.theme==='tech'?' active':''}" data-theme="tech">Techniczny</button>
      </div>
    </div>
    <div class="card settings-section">
      <h3>Widoczność podstron</h3>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">`;
  PAGES.filter(p => p.id !== 'ustawienia' && p.id !== 'dashboard').forEach(p => {
    const hid = state.hiddenPages.includes(p.id);
    html += `<label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
      <input type="checkbox" data-toggle-page="${p.id}" ${hid?'':'checked'}> ${p.label}</label>`;
  });
  html += `</div></div>
    <div class="card settings-section">
      <h3>Dane systemowe</h3>
      <button class="btn btn-secondary btn-sm" id="seed-data-btn">Załaduj dane przykładowe</button>
    </div>
    <div class="card settings-section" style="text-align:center;">
      <h3>Kod QR – Zgłoś awarię</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem;">Po zeskanowaniu otwiera formularz zgłoszenia awarii. Wydrukuj i powieś przy stanowiskach.</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(getAwariaQrUrl())}" width="240" height="240" alt="QR" style="border-radius:12px;background:#fff;padding:10px;">
      <p style="font-size:0.75rem;margin-top:0.5rem;word-break:break-all;color:var(--text-muted);">${esc(getAwariaQrUrl())}</p>
      <button class="btn btn-primary btn-sm" id="print-qr-btn" style="margin-top:0.75rem;">🖨 Drukuj kod QR</button>
    </div>`;
  return html;
}

/* ========== BIND EVENTS ========== */
function bindPageEvents(id) {
  if (id === 'mes') {
    $$('[data-mes-tab]').forEach(btn => {
      btn.onclick = () => { mesTab = btn.dataset.mesTab; renderPage(); };
    });

    // New order
    $('#mes-add-order')?.addEventListener('click', () => {
      const lineOpts = (state.data.mes.lines || []).map(l => `<option value="${esc(l.name)}">${esc(l.name)}</option>`).join('');
      openModal(`<div class="modal-header"><span class="modal-title">Nowe zlecenie produkcyjne</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Numer zlecenia</label><input id="m-onum" placeholder="ZP-2026-001"></div>
        <div class="form-group"><label>Produkt</label><input id="m-oprod"></div>
        <div class="form-group"><label>Ilość planowana</label><input id="m-oqty" type="number" min="1" value="100"></div>
        <div class="form-group"><label>Linia</label>
          <select id="m-oline"><option value="">—</option>${lineOpts}<option value="Linia 1">Linia 1</option><option value="Linia 2">Linia 2</option></select>
        </div>
        <div class="form-group"><label>Priorytet</label>
          <select id="m-oprio"><option value="normal">Normalny</option><option value="high">Wysoki</option><option value="low">Niski</option></select>
        </div>
        <div class="form-group"><label>Termin</label><input id="m-odue" type="date"></div>
        <div class="form-group"><label>Uwagi</label><textarea id="m-onotes"></textarea></div>
        <button class="btn btn-primary" id="m-save-order">Zapisz zlecenie</button>`);
      $('#m-save-order').onclick = async () => {
        const number = $('#m-onum').value.trim();
        const product = $('#m-oprod').value.trim();
        if (!number || !product) return toast('Numer i produkt są wymagane', 'danger');
        const item = {
          number, product,
          qtyPlan: Number($('#m-oqty').value) || 0,
          qtyDone: 0,
          line: $('#m-oline').value,
          priority: $('#m-oprio').value,
          dueDate: $('#m-odue').value,
          notes: $('#m-onotes').value.trim(),
          status: 'planned',
          author: state.user.label,
          date: nowStr(),
          ts: Date.now()
        };
        if (state.cloud) await cloudAdd('mesOrders', item);
        else { item.id = uid(); state.data.mes.orders.push(item); persist(); }
        closeModal(); renderPage(); toast('Zlecenie dodane');
      };
    });

    $$('.mes-order-status').forEach(sel => {
      sel.onchange = async () => {
        const patch = { status: sel.value };
        if (sel.value === 'completed') patch.completedDateKey = todayKey();
        if (state.cloud) await cloudSet('mesOrders', sel.dataset.id, patch);
        else {
          const o = state.data.mes.orders.find(x => x.id === sel.dataset.id);
          if (o) { Object.assign(o, patch); persist(); }
        }
        renderPage(); toast('Status zlecenia zaktualizowany');
      };
    });
    $$('[data-del-order]').forEach(b => b.onclick = async () => {
      if (!confirm('Usunąć zlecenie?')) return;
      if (state.cloud) await cloudDelete('mesOrders', b.dataset.delOrder);
      else { state.data.mes.orders = state.data.mes.orders.filter(o => o.id !== b.dataset.delOrder); persist(); }
      renderPage();
    });

    // Report
    $('#mes-add-report')?.addEventListener('click', () => {
      const activeOrders = (state.data.mes.orders || []).filter(o => o.status === 'in_progress' || o.status === 'planned');
      const orderOpts = activeOrders.map(o => `<option value="${o.id}" data-num="${esc(o.number)}">${esc(o.number)} – ${esc(o.product)}</option>`).join('');
      const scrapOpts = (state.data.mes.scrapReasons || []).map(s => `<option>${esc(s)}</option>`).join('');
      openModal(`<div class="modal-header"><span class="modal-title">Meldunek produkcyjny</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Zlecenie</label>
          <select id="m-rorder"><option value="">— wybierz —</option>${orderOpts}</select>
        </div>
        <div class="form-group"><label>Ilość OK</label><input id="m-rgood" type="number" min="0" value="0"></div>
        <div class="form-group"><label>Ilość braków</label><input id="m-rscrap" type="number" min="0" value="0"></div>
        <div class="form-group"><label>Powód braków</label><select id="m-rreason"><option value="">—</option>${scrapOpts}</select></div>
        <div class="form-group"><label>Uwagi</label><textarea id="m-rnotes"></textarea></div>
        <button class="btn btn-primary" id="m-save-report">Zapisz meldunek</button>`);
      $('#m-save-report').onclick = async () => {
        const sel = $('#m-rorder');
        const orderId = sel.value;
        if (!orderId) return toast('Wybierz zlecenie', 'danger');
        const opt = sel.options[sel.selectedIndex];
        const orderNumber = opt.dataset.num || opt.text;
        const qtyGood = Number($('#m-rgood').value) || 0;
        const qtyScrap = Number($('#m-rscrap').value) || 0;
        if (qtyGood + qtyScrap <= 0) return toast('Podaj ilość', 'danger');
        const item = {
          orderId, orderNumber, qtyGood, qtyScrap,
          scrapReason: $('#m-rreason').value,
          notes: $('#m-rnotes').value.trim(),
          author: state.user.label,
          date: nowStr(),
          dateKey: todayKey(),
          ts: Date.now()
        };
        if (state.cloud) {
          await cloudAdd('mesReports', item);
          // bump order qtyDone
          const order = state.data.mes.orders.find(o => o.id === orderId);
          const newDone = Number(order?.qtyDone || 0) + qtyGood;
          await cloudSet('mesOrders', orderId, { qtyDone: newDone });
        } else {
          item.id = uid();
          state.data.mes.reports.push(item);
          const order = state.data.mes.orders.find(o => o.id === orderId);
          if (order) order.qtyDone = Number(order.qtyDone || 0) + qtyGood;
          persist();
        }
        closeModal(); renderPage(); toast('Meldunek zapisany');
      };
    });
    $$('[data-del-report]').forEach(b => b.onclick = async () => {
      if (!confirm('Usunąć meldunek?')) return;
      if (state.cloud) await cloudDelete('mesReports', b.dataset.delReport);
      else { state.data.mes.reports = state.data.mes.reports.filter(r => r.id !== b.dataset.delReport); persist(); }
      renderPage();
    });

    // Downtime
    $('#mes-add-down')?.addEventListener('click', () => {
      const machOpts = (state.data.machines || []).map(m => `<option>${esc(m.name)}</option>`).join('');
      const lineOpts = (state.data.mes.lines || []).map(l => `<option>${esc(l.name)}</option>`).join('');
      openModal(`<div class="modal-header"><span class="modal-title">Zgłoś przestój</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Powód</label>
          <select id="m-dreason">
            <option>Awaria maszyny</option><option>Przezbrojenie</option><option>Brak materiału</option>
            <option>Brak operatora</option><option>Kontrola jakości</option><option>Planowany przegląd</option><option>Inne</option>
          </select>
        </div>
        <div class="form-group"><label>Maszyna</label><select id="m-dmach"><option value="">—</option>${machOpts}</select></div>
        <div class="form-group"><label>Linia</label><select id="m-dline"><option value="">—</option>${lineOpts}</select></div>
        <div class="form-group"><label>Uwagi</label><textarea id="m-dnotes"></textarea></div>
        <button class="btn btn-primary" id="m-save-down">Rozpocznij przestój</button>`);
      $('#m-save-down').onclick = async () => {
        const item = {
          reason: $('#m-dreason').value,
          machine: $('#m-dmach').value,
          line: $('#m-dline').value,
          notes: $('#m-dnotes').value.trim(),
          open: true,
          startedAt: Date.now(),
          durationMin: null,
          author: state.user.label,
          date: nowStr(),
          dateKey: todayKey(),
          ts: Date.now()
        };
        if (state.cloud) await cloudAdd('mesDowntimes', item);
        else { item.id = uid(); state.data.mes.downtimes.push(item); persist(); }
        closeModal(); renderPage(); toast('Przestój otwarty', 'danger');
      };
    });
    $$('[data-close-down]').forEach(b => b.onclick = async () => {
      const d = state.data.mes.downtimes.find(x => x.id === b.dataset.closeDown);
      if (!d) return;
      const durationMin = d.startedAt ? Math.max(1, Math.round((Date.now() - d.startedAt) / 60000)) : 0;
      if (state.cloud) await cloudSet('mesDowntimes', d.id, { open: false, durationMin, endedAt: Date.now() });
      else { d.open = false; d.durationMin = durationMin; persist(); }
      renderPage(); toast('Przestój zamknięty (' + durationMin + ' min)');
    });
    $$('[data-del-down]').forEach(b => b.onclick = async () => {
      if (!confirm('Usunąć?')) return;
      if (state.cloud) await cloudDelete('mesDowntimes', b.dataset.delDown);
      else { state.data.mes.downtimes = state.data.mes.downtimes.filter(d => d.id !== b.dataset.delDown); persist(); }
      renderPage();
    });

    // Queue
    $('#mes-add-queue')?.addEventListener('click', () => {
      const orders = (state.data.mes.orders || []).filter(o => o.status === 'planned' || o.status === 'in_progress');
      const opts = orders.map(o => `<option value="${o.id}" data-num="${esc(o.number)}" data-prod="${esc(o.product)}" data-line="${esc(o.line||'')}">${esc(o.number)} – ${esc(o.product)}</option>`).join('');
      const lineOpts = (state.data.mes.lines || []).map(l => `<option>${esc(l.name)}</option>`).join('');
      const nextSeq = (state.data.mes.queue || []).reduce((m, q) => Math.max(m, Number(q.seq)||0), 0) + 1;
      openModal(`<div class="modal-header"><span class="modal-title">Dodaj do kolejki</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Zlecenie</label><select id="m-qord"><option value="">—</option>${opts}</select></div>
        <div class="form-group"><label>Linia</label><select id="m-qline"><option value="">—</option>${lineOpts}</select></div>
        <div class="form-group"><label>Kolejność (seq)</label><input id="m-qseq" type="number" value="${nextSeq}"></div>
        <div class="form-group"><label>Priorytet</label><select id="m-qprio"><option>normal</option><option>high</option><option>low</option></select></div>
        <div class="form-group"><label>Planowany start</label><input id="m-qstart" type="datetime-local"></div>
        <button class="btn btn-primary" id="m-save-q">Dodaj</button>`);
      $('#m-save-q').onclick = async () => {
        const sel = $('#m-qord');
        if (!sel.value) return toast('Wybierz zlecenie', 'danger');
        const opt = sel.options[sel.selectedIndex];
        const item = {
          orderId: sel.value,
          orderNumber: opt.dataset.num,
          product: opt.dataset.prod,
          line: $('#m-qline').value || opt.dataset.line || '',
          seq: Number($('#m-qseq').value) || nextSeq,
          priority: $('#m-qprio').value,
          plannedStart: $('#m-qstart').value,
          status: 'waiting',
          author: state.user.label,
          ts: Date.now()
        };
        if (state.cloud) await cloudAdd('mesQueue', item);
        else { item.id = uid(); state.data.mes.queue.push(item); persist(); }
        closeModal(); renderPage(); toast('Dodano do kolejki');
      };
    });

    async function reorderQueue(id, dir) {
      const list = [...(state.data.mes.queue || [])].sort((a,b)=>(a.seq||0)-(b.seq||0));
      const idx = list.findIndex(q => q.id === id);
      if (idx < 0) return;
      const swap = dir < 0 ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return;
      const a = list[idx], b = list[swap];
      const seqA = a.seq != null ? a.seq : idx+1, seqB = b.seq != null ? b.seq : swap+1;
      if (state.cloud) {
        await cloudSet('mesQueue', a.id, { seq: seqB });
        await cloudSet('mesQueue', b.id, { seq: seqA });
      } else {
        a.seq = seqB; b.seq = seqA; persist(); renderPage();
      }
      toast('Kolejność zmieniona');
    }
    $$('[data-q-up]').forEach(b => b.onclick = () => reorderQueue(b.dataset.qUp, -1));
    $$('[data-q-down]').forEach(b => b.onclick = () => reorderQueue(b.dataset.qDown, 1));
    $$('[data-q-start]').forEach(b => b.onclick = async () => {
      const q = state.data.mes.queue.find(x => x.id === b.dataset.qStart);
      if (!q) return;
      if (state.cloud) {
        await cloudSet('mesQueue', q.id, { status: 'running' });
        if (q.orderId) await cloudSet('mesOrders', q.orderId, { status: 'in_progress' });
      } else {
        q.status = 'running';
        const o = state.data.mes.orders.find(x => x.id === q.orderId);
        if (o) o.status = 'in_progress';
        persist();
      }
      renderPage(); toast('Uruchomiono z kolejki');
    });
    $$('[data-del-queue]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('mesQueue', b.dataset.delQueue);
      else { state.data.mes.queue = state.data.mes.queue.filter(q => q.id !== b.dataset.delQueue); persist(); }
      renderPage();
    });

    // Changeover
    $('#mes-add-co')?.addEventListener('click', () => {
      const lineOpts = (state.data.mes.lines || []).map(l => `<option>${esc(l.name)}</option>`).join('');
      openModal(`<div class="modal-header"><span class="modal-title">Przezbrojenie</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Linia</label><select id="m-coline">${lineOpts}<option>Linia 1</option></select></div>
        <div class="form-group"><label>Z produktu</label><input id="m-cofrom"></div>
        <div class="form-group"><label>Na produkt</label><input id="m-coto"></div>
        <div class="form-group"><label>Czas planowany (min)</label><input id="m-coplan" type="number" value="30"></div>
        <div class="form-group"><label>Czas rzeczywisty (min)</label><input id="m-coact" type="number"></div>
        <div class="form-group"><label>Uwagi</label><textarea id="m-conotes"></textarea></div>
        <button class="btn btn-primary" id="m-save-co">Zapisz</button>`);
      $('#m-save-co').onclick = async () => {
        const item = {
          line: $('#m-coline').value, fromProduct: $('#m-cofrom').value, toProduct: $('#m-coto').value,
          plannedMin: Number($('#m-coplan').value)||0, actualMin: $('#m-coact').value ? Number($('#m-coact').value) : null,
          notes: $('#m-conotes').value, status: 'done', author: state.user.label, date: nowStr(), ts: Date.now()
        };
        if (state.cloud) await cloudAdd('mesChangeovers', item);
        else { item.id = uid(); state.data.mes.changeovers.push(item); persist(); }
        closeModal(); renderPage(); toast('Przezbrojenie zapisane');
      };
    });
    $$('[data-del-co]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('mesChangeovers', b.dataset.delCo);
      else { state.data.mes.changeovers = state.data.mes.changeovers.filter(c => c.id !== b.dataset.delCo); persist(); }
      renderPage();
    });

    // Lines
    $('#mes-add-line')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Nowa linia</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Nazwa</label><input id="m-lname"></div>
        <div class="form-group"><label>Opis</label><input id="m-ldesc"></div>
        <div class="form-group"><label>Cel szt/h</label><input id="m-lrate" type="number" value="60"></div>
        <div class="form-group"><label>Status</label><select id="m-lstat"><option>aktywna</option><option>wyłączona</option><option>serwis</option></select></div>
        <button class="btn btn-primary" id="m-save-line">Zapisz</button>`);
      $('#m-save-line').onclick = async () => {
        const item = { name: $('#m-lname').value.trim(), description: $('#m-ldesc').value, targetRate: Number($('#m-lrate').value)||0, status: $('#m-lstat').value };
        if (!item.name) return toast('Podaj nazwę', 'danger');
        if (state.cloud) await cloudAdd('mesLines', item);
        else { item.id = uid(); state.data.mes.lines.push(item); persist(); }
        closeModal(); renderPage(); toast('Linia dodana');
      };
    });
    $$('[data-del-line]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('mesLines', b.dataset.delLine);
      else { state.data.mes.lines = state.data.mes.lines.filter(l => l.id !== b.dataset.delLine); persist(); }
      renderPage();
    });

    // Shifts
    $('#mes-add-shift')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Nowa zmiana</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Nazwa</label><input id="m-sname" placeholder="Zmiana I"></div>
        <div class="form-group"><label>Od</label><input id="m-sstart" type="time" value="06:00"></div>
        <div class="form-group"><label>Do</label><input id="m-send" type="time" value="14:00"></div>
        <div class="form-group"><label>Uwagi</label><input id="m-snotes"></div>
        <button class="btn btn-primary" id="m-save-shift">Zapisz</button>`);
      $('#m-save-shift').onclick = async () => {
        const item = { name: $('#m-sname').value.trim(), start: $('#m-sstart').value, end: $('#m-send').value, notes: $('#m-snotes').value };
        if (!item.name) return toast('Podaj nazwę', 'danger');
        if (state.cloud) await cloudAdd('mesShifts', item);
        else { item.id = uid(); state.data.mes.shifts.push(item); persist(); }
        closeModal(); renderPage(); toast('Zmiana dodana');
      };
    });
    $$('[data-del-shift]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('mesShifts', b.dataset.delShift);
      else { state.data.mes.shifts = state.data.mes.shifts.filter(s => s.id !== b.dataset.delShift); persist(); }
      renderPage();
    });
  }

  if (id === 'ci') {
    $$('[data-ci-tab]').forEach(btn => { btn.onclick = () => { ciTab = btn.dataset.ciTab; renderPage(); }; });
    const full = state.user?.role === 'admin' || state.user?.role === 'kierownik';

    $$('[data-ci-init]').forEach(b => b.onclick = () => {
      const sys = b.dataset.ciInit;
      openModal(`<div class="modal-header"><span class="modal-title">Inicjatywa ${esc(sys)}</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="ci-t"></div>
        <div class="form-group"><label>Opis</label><textarea id="ci-d"></textarea></div>
        <div class="form-group"><label>Status</label><select id="ci-s"><option>planowana</option><option>w toku</option><option>zakończona</option></select></div>
        <button class="btn btn-primary" id="ci-save-init">Zapisz</button>`);
      $('#ci-save-init').onclick = async () => {
        const item = { system: sys, title: $('#ci-t').value.trim(), description: $('#ci-d').value, status: $('#ci-s').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.title) return toast('Podaj tytuł', 'danger');
        await ciAdd('initiatives', item); closeModal(); renderPage(); toast('Inicjatywa dodana');
      };
    });
    $$('[data-del-init]').forEach(b => b.onclick = async () => { await ciDel('initiatives', b.dataset.delInit); renderPage(); });

    const methodMap = { poka: ['pokaYoke','Poka-Yoke'], jidoka: ['jidoka','Jidoka'], heijunka: ['heijunka','Heijunka'], hoshin: ['hoshin','Hoshin'] };
    $$('[data-ci-method]').forEach(b => b.onclick = () => {
      const [key, label] = methodMap[b.dataset.ciMethod] || ['pokaYoke','Pozycja'];
      openModal(`<div class="modal-header"><span class="modal-title">${label}</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="ci-mt"></div>
        <div class="form-group"><label>Opis</label><textarea id="ci-md"></textarea></div>
        <button class="btn btn-primary" id="ci-save-m">Zapisz</button>`);
      $('#ci-save-m').onclick = async () => {
        const item = { title: $('#ci-mt').value.trim(), description: $('#ci-md').value, name: $('#ci-mt').value.trim(), notes: $('#ci-md').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.title) return toast('Podaj tytuł', 'danger');
        await ciAdd(key, item); closeModal(); renderPage(); toast('Zapisano');
      };
    });
    [['del-poka','pokaYoke'],['del-jidoka','jidoka'],['del-heijunka','heijunka'],['del-hoshin','hoshin']].forEach(([attr, key]) => {
      $$(`[data-${attr}]`).forEach(b => b.onclick = async () => { await ciDel(key, b.getAttribute('data-'+attr)); renderPage(); });
    });

    $('#ci-add-kanban')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Karta Kanban</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="ci-kt"></div>
        <div class="form-group"><label>Kolumna</label><select id="ci-kc"><option>Backlog</option><option>Do zrobienia</option><option>W toku</option><option>Blokada</option><option>Gotowe</option></select></div>
        <div class="form-group"><label>Priorytet</label><select id="ci-kp"><option>normal</option><option>high</option><option>low</option></select></div>
        <div class="form-group"><label>Osoba</label><input id="ci-ka"></div>
        <button class="btn btn-primary" id="ci-save-k">Dodaj</button>`);
      $('#ci-save-k').onclick = async () => {
        const item = { title: $('#ci-kt').value.trim(), column: $('#ci-kc').value, priority: $('#ci-kp').value, assignee: $('#ci-ka').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.title) return toast('Podaj tytuł', 'danger');
        await ciAdd('kanban', item); closeModal(); renderPage(); toast('Karta dodana');
      };
    });
    $$('[data-kanban-move]').forEach(b => b.onclick = async () => {
      const [id, col] = b.dataset.kanbanMove.split('|');
      await ciSet('kanban', id, { column: col }); renderPage();
    });
    $$('[data-del-kanban]').forEach(b => b.onclick = async () => { await ciDel('kanban', b.dataset.delKanban); renderPage(); });

    $('#ci-add-andon')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Stanowisko Andon</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Nazwa stanowiska / linii</label><input id="ci-as"></div>
        <div class="form-group"><label>Status</label><select id="ci-ast"><option value="green">Zielony – OK</option><option value="yellow">Żółty – Uwaga</option><option value="red">Czerwony – Stop</option></select></div>
        <div class="form-group"><label>Komunikat</label><input id="ci-am"></div>
        <button class="btn btn-primary" id="ci-save-a">Dodaj</button>`);
      $('#ci-save-a').onclick = async () => {
        const item = { station: $('#ci-as').value.trim(), name: $('#ci-as').value.trim(), status: $('#ci-ast').value, message: $('#ci-am').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.station) return toast('Podaj nazwę', 'danger');
        await ciAdd('andon', item); closeModal(); renderPage(); toast('Andon dodany');
      };
    });
    $$('[data-andon-st]').forEach(b => b.onclick = async () => {
      const [id, st] = b.dataset.andonSt.split('|');
      await ciSet('andon', id, { status: st, date: nowStr() }); renderPage(); toast('Status Andon: ' + st);
    });
    $$('[data-del-andon]').forEach(b => b.onclick = async () => { await ciDel('andon', b.dataset.delAndon); renderPage(); });

    $('#ci-add-muda')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Strata 3M</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Typ</label><select id="ci-mtype"><option>Muda</option><option>Mura</option><option>Muri</option></select></div>
        <div class="form-group"><label>Opis</label><textarea id="ci-mdesc"></textarea></div>
        <div class="form-group"><label>Obszar</label><input id="ci-marea"></div>
        <button class="btn btn-primary" id="ci-save-muda">Zapisz</button>`);
      $('#ci-save-muda').onclick = async () => {
        const item = { type: $('#ci-mtype').value, description: $('#ci-mdesc').value.trim(), area: $('#ci-marea').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.description) return toast('Podaj opis', 'danger');
        await ciAdd('muda', item); closeModal(); renderPage(); toast('Zapisano 3M');
      };
    });
    $$('[data-del-muda]').forEach(b => b.onclick = async () => { await ciDel('muda', b.dataset.delMuda); renderPage(); });

    $('#ci-add-tpm')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Działanie TPM</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="ci-tt"></div>
        <div class="form-group"><label>Maszyna</label><input id="ci-tm"></div>
        <div class="form-group"><label>Opis</label><textarea id="ci-td"></textarea></div>
        <button class="btn btn-primary" id="ci-save-tpm">Zapisz</button>`);
      $('#ci-save-tpm').onclick = async () => {
        const item = { title: $('#ci-tt').value.trim(), machine: $('#ci-tm').value, description: $('#ci-td').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.title) return toast('Podaj tytuł', 'danger');
        await ciAdd('tpm', item); closeModal(); renderPage(); toast('TPM zapisane');
      };
    });
    $$('[data-del-tpm]').forEach(b => b.onclick = async () => { await ciDel('tpm', b.dataset.delTpm); renderPage(); });

    $('#ci-add-gemba')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Gemba Walk</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Obszar</label><input id="ci-ga"></div>
        <div class="form-group"><label>Obserwacje</label><textarea id="ci-gf"></textarea></div>
        <div class="form-group"><label>Działania</label><textarea id="ci-gact"></textarea></div>
        <button class="btn btn-primary" id="ci-save-g">Zapisz</button>`);
      $('#ci-save-g').onclick = async () => {
        const item = { area: $('#ci-ga').value.trim(), findings: $('#ci-gf').value, actions: $('#ci-gact').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        await ciAdd('gemba', item); closeModal(); renderPage(); toast('Gemba zapisany');
      };
    });
    $$('[data-del-gemba]').forEach(b => b.onclick = async () => { await ciDel('gemba', b.dataset.delGemba); renderPage(); });

    $('#ci-add-kpi')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Pomiar KPI</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Metryka</label>
          <select id="ci-km"><option>OTIF</option><option>FTT</option><option>RTY</option><option>Cycle Time</option><option>Lead Time</option></select>
        </div>
        <div class="form-group"><label>Wartość</label><input id="ci-kv" placeholder="np. 96.5"></div>
        <div class="form-group"><label>Jednostka</label><input id="ci-ku" placeholder="% lub min"></div>
        <div class="form-group"><label>Cel</label><input id="ci-kt"></div>
        <div class="form-group"><label>Okres</label><input id="ci-kp" placeholder="tydzień / miesiąc"></div>
        <button class="btn btn-primary" id="ci-save-kpi">Zapisz</button>`);
      $('#ci-save-kpi').onclick = async () => {
        const item = { metric: $('#ci-km').value, value: $('#ci-kv').value.trim(), unit: $('#ci-ku').value, target: $('#ci-kt').value, period: $('#ci-kp').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.value) return toast('Podaj wartość', 'danger');
        await ciAdd('kpis', item); closeModal(); renderPage(); toast('KPI zapisane');
      };
    });
    $$('[data-del-kpi]').forEach(b => b.onclick = async () => { await ciDel('kpis', b.dataset.delKpi); renderPage(); });
  }

  if (id === 'qhse') {
    $$('[data-qhse-tab]').forEach(btn => {
      btn.onclick = () => { qhseTab = btn.dataset.qhseTab; renderPage(); };
    });
    const full = state.user?.role === 'admin' || state.user?.role === 'kierownik';

    $('#qhse-add-inc')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Nowy incydent</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="q-title"></div>
        <div class="form-group"><label>Opis</label><textarea id="q-desc"></textarea></div>
        <div class="form-group"><label>Lokalizacja</label><input id="q-loc"></div>
        <div class="form-group"><label>Waga</label><select id="q-sev"><option value="low">Niska</option><option value="medium">Średnia</option><option value="high">Wysoka</option></select></div>
        <div class="form-group"><label>Status</label><select id="q-st"><option>otwarty</option><option>w analizie</option><option>zamknięty</option></select></div>
        <button class="btn btn-primary" id="q-save-inc">Zapisz</button>`);
      $('#q-save-inc').onclick = async () => {
        const item = { title: $('#q-title').value.trim(), description: $('#q-desc').value, location: $('#q-loc').value,
          severity: $('#q-sev').value, status: $('#q-st').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.title) return toast('Podaj tytuł', 'danger');
        if (state.cloud) await cloudAdd('qhseIncidents', item);
        else { item.id = uid(); state.data.qhse.incidents.push(item); persist(); }
        closeModal(); renderPage(); toast('Incydent zgłoszony', 'danger');
      };
    });
    $$('[data-del-inc]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('qhseIncidents', b.dataset.delInc);
      else { state.data.qhse.incidents = state.data.qhse.incidents.filter(i => i.id !== b.dataset.delInc); persist(); }
      renderPage();
    });

    $('#qhse-add-nm')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Near miss</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="q-nt"></div>
        <div class="form-group"><label>Opis</label><textarea id="q-nd"></textarea></div>
        <div class="form-group"><label>Lokalizacja</label><input id="q-nl"></div>
        <button class="btn btn-primary" id="q-save-nm">Zapisz</button>`);
      $('#q-save-nm').onclick = async () => {
        const item = { title: $('#q-nt').value.trim(), description: $('#q-nd').value, location: $('#q-nl').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.title) return toast('Podaj tytuł', 'danger');
        if (state.cloud) await cloudAdd('qhseNearMisses', item);
        else { item.id = uid(); state.data.qhse.nearMisses.push(item); persist(); }
        closeModal(); renderPage(); toast('Near miss zapisany');
      };
    });
    $$('[data-del-nm]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('qhseNearMisses', b.dataset.delNm);
      else { state.data.qhse.nearMisses = state.data.qhse.nearMisses.filter(i => i.id !== b.dataset.delNm); persist(); }
      renderPage();
    });

    $('#qhse-add-insp')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Inspekcja / audyt</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="q-it"></div>
        <div class="form-group"><label>Obszar</label><input id="q-ia"></div>
        <div class="form-group"><label>Wynik</label><select id="q-ir"><option>pozytywny</option><option>z uwagami</option><option>negatywny</option></select></div>
        <div class="form-group"><label>Ustalenia</label><textarea id="q-if"></textarea></div>
        <button class="btn btn-primary" id="q-save-insp">Zapisz</button>`);
      $('#q-save-insp').onclick = async () => {
        const item = { title: $('#q-it').value.trim(), area: $('#q-ia').value, result: $('#q-ir').value, findings: $('#q-if').value, author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.title) return toast('Podaj tytuł', 'danger');
        if (state.cloud) await cloudAdd('qhseInspections', item);
        else { item.id = uid(); state.data.qhse.inspections.push(item); persist(); }
        closeModal(); renderPage(); toast('Inspekcja zapisana');
      };
    });
    $$('[data-del-insp]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('qhseInspections', b.dataset.delInsp);
      else { state.data.qhse.inspections = state.data.qhse.inspections.filter(i => i.id !== b.dataset.delInsp); persist(); }
      renderPage();
    });

    $('#qhse-add-tr')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Szkolenie BHP</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Temat</label><input id="q-tt"></div>
        <div class="form-group"><label>Data</label><input id="q-td" type="date"></div>
        <div class="form-group"><label>Uczestnicy</label><input id="q-tp" placeholder="liczba lub nazwiska"></div>
        <div class="form-group"><label>Prowadzący</label><input id="q-tr"></div>
        <button class="btn btn-primary" id="q-save-tr">Zapisz</button>`);
      $('#q-save-tr').onclick = async () => {
        const item = { topic: $('#q-tt').value.trim(), date: $('#q-td').value || nowStr(), participants: $('#q-tp').value, trainer: $('#q-tr').value, author: state.user.label, ts: Date.now() };
        if (!item.topic) return toast('Podaj temat', 'danger');
        if (state.cloud) await cloudAdd('qhseTrainings', item);
        else { item.id = uid(); state.data.qhse.trainings.push(item); persist(); }
        closeModal(); renderPage(); toast('Szkolenie zapisane');
      };
    });
    $$('[data-del-tr]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('qhseTrainings', b.dataset.delTr);
      else { state.data.qhse.trainings = state.data.qhse.trainings.filter(i => i.id !== b.dataset.delTr); persist(); }
      renderPage();
    });

    $('#qhse-add-ptw')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Pozwolenie na pracę (PTW)</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Rodzaj prac</label><input id="q-pw" placeholder="np. prace wysokościowe"></div>
        <div class="form-group"><label>Lokalizacja</label><input id="q-pl"></div>
        <div class="form-group"><label>Ważne od</label><input id="q-pf" type="date"></div>
        <div class="form-group"><label>Ważne do</label><input id="q-pt" type="date"></div>
        <div class="form-group"><label>Wystawca</label><input id="q-pi"></div>
        <button class="btn btn-primary" id="q-save-ptw">Wystaw</button>`);
      $('#q-save-ptw').onclick = async () => {
        const item = { workType: $('#q-pw').value.trim(), location: $('#q-pl').value, validFrom: $('#q-pf').value, validTo: $('#q-pt').value,
          issuer: $('#q-pi').value || state.user.label, status: 'active', author: state.user.label, date: nowStr(), ts: Date.now() };
        if (!item.workType) return toast('Podaj rodzaj prac', 'danger');
        if (state.cloud) await cloudAdd('qhsePermits', item);
        else { item.id = uid(); state.data.qhse.permits.push(item); persist(); }
        closeModal(); renderPage(); toast('Pozwolenie wystawione');
      };
    });
    $$('[data-close-ptw]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudSet('qhsePermits', b.dataset.closePtw, { status: 'closed' });
      else { const x = state.data.qhse.permits.find(i => i.id === b.dataset.closePtw); if (x) x.status = 'closed'; persist(); }
      renderPage(); toast('Pozwolenie zamknięte');
    });
    $$('[data-del-ptw]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('qhsePermits', b.dataset.delPtw);
      else { state.data.qhse.permits = state.data.qhse.permits.filter(i => i.id !== b.dataset.delPtw); persist(); }
      renderPage();
    });
  }

  if (id === 'dashboard') {
    $('#dash-clear-alert')?.addEventListener('click', async () => {
      state.alertActive = false;
      await cloudUpdateMeta({ alertActive: false });
      persist(); updateHeader(); renderPage();
      toast('Alarm wyłączony');
    });
  }

  if (id === 'aktualnosci') {
    $('#add-news-btn')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Nowy wpis</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="m-title"></div>
        <div class="form-group"><label>Treść</label><textarea id="m-text"></textarea></div>
        <div class="form-group"><label>Zdjęcie</label><input type="file" id="m-img" accept="image/*"></div>
        <button class="btn btn-primary" id="m-save-news">Zapisz</button>`);
      $('#m-save-news').onclick = async () => {
        const title = $('#m-title').value.trim();
        if (!title) return toast('Podaj tytuł', 'danger');
        let img = null;
        const f = $('#m-img').files[0];
        if (f) img = await fileToBase64(f);
        const item = { title, text: $('#m-text').value.trim(), img, date: nowStr(), author: state.user.label, ts: Date.now() };
        if (state.cloud) await cloudAdd('news', item);
        else { item.id = uid(); state.data.news.push(item); persist(); }
        closeModal(); renderPage(); toast('Wpis dodany');
      };
    });
    $$('[data-del-news]').forEach(b => b.onclick = async () => {
      if (!confirm('Usunąć?')) return;
      if (state.cloud) await cloudDelete('news', b.dataset.delNews);
      else { state.data.news = state.data.news.filter(n => n.id !== b.dataset.delNews); persist(); }
      renderPage(); toast('Usunięto');
    });
  }

  if (id === 'kalendarz') {
    $('#cal-prev').onclick = () => { calMonth--; if (calMonth<0){calMonth=11;calYear--;} renderPage(); };
    $('#cal-next').onclick = () => { calMonth++; if (calMonth>11){calMonth=0;calYear++;} renderPage(); };
    $$('[data-day]').forEach(cell => {
      cell.onclick = () => {
        const key = cell.dataset.day;
        const events = state.data.events[key] || [];
        let detail = `<div class="card"><strong>${key}</strong>`;
        if (events.length) {
          events.forEach(e => {
            detail += `<div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--border);">
              <strong>${esc(e.title)}</strong><br>${esc(e.desc||'')}
              ${canEdit('kalendarz')?`<br><button class="btn btn-danger btn-sm" data-del-event="${key}|${e.id}">Usuń</button>`:''}
            </div>`;
          });
        } else detail += '<p style="color:var(--text-muted);margin-top:0.5rem;">Brak wydarzeń</p>';
        if (canEdit('kalendarz')) detail += `<button class="btn btn-primary btn-sm" style="margin-top:0.8rem;" id="add-event-btn">+ Dodaj wydarzenie</button>`;
        detail += `</div>`;
        $('#cal-detail').innerHTML = detail;

        $('#add-event-btn')?.addEventListener('click', () => {
          openModal(`<div class="modal-header"><span class="modal-title">Wydarzenie – ${key}</span><button class="modal-close" onclick="closeModal()">×</button></div>
            <div class="form-group"><label>Tytuł</label><input id="m-etitle"></div>
            <div class="form-group"><label>Opis</label><textarea id="m-edesc"></textarea></div>
            <button class="btn btn-primary" id="m-save-event">Zapisz</button>`);
          $('#m-save-event').onclick = async () => {
            const title = $('#m-etitle').value.trim();
            if (!title) return toast('Podaj tytuł', 'danger');
            const ev = { id: uid(), title, desc: $('#m-edesc').value.trim() };
            const list = [...(state.data.events[key] || []), ev];
            if (state.cloud) await cloudSet('events', key, { items: list });
            else { state.data.events[key] = list; persist(); }
            closeModal(); renderPage(); toast('Wydarzenie dodane');
          };
        });
        $$('[data-del-event]').forEach(b => b.onclick = async () => {
          const [k, eid] = b.dataset.delEvent.split('|');
          const list = (state.data.events[k] || []).filter(e => e.id !== eid);
          if (state.cloud) {
            if (list.length) await cloudSet('events', k, { items: list });
            else await cloudDelete('events', k);
          } else {
            if (list.length) state.data.events[k] = list;
            else delete state.data.events[k];
            persist();
          }
          renderPage();
        });
      };
    });
  }

  if (id === 'kontakty') {
    $('#add-contact-btn')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Nowy kontakt</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Imię</label><input id="m-cf"></div>
        <div class="form-group"><label>Nazwisko</label><input id="m-cl"></div>
        <div class="form-group"><label>Stanowisko</label><input id="m-cp"></div>
        <div class="form-group"><label>Kontakt</label><input id="m-cc"></div>
        <button class="btn btn-primary" id="m-save-c">Zapisz</button>`);
      $('#m-save-c').onclick = async () => {
        const item = { first: $('#m-cf').value, last: $('#m-cl').value, pos: $('#m-cp').value, contact: $('#m-cc').value };
        if (state.cloud) await cloudAdd('contacts', item);
        else { item.id = uid(); state.data.contacts.push(item); persist(); }
        closeModal(); renderPage(); toast('Kontakt dodany');
      };
    });
    $$('[data-del-contact]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('contacts', b.dataset.delContact);
      else { state.data.contacts = state.data.contacts.filter(c => c.id !== b.dataset.delContact); persist(); }
      renderPage();
    });
  }

  if (id === 'magazyn') {
    $('#add-wh-btn')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Produkt</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Nazwa</label><input id="m-wn"></div>
        <div class="form-group"><label>Ilość</label><input id="m-wq" type="text"></div>
        <div class="form-group"><label>Jednostka</label>
          <select id="m-wu"><option>szt.</option><option>kg</option><option>l</option><option>m</option><option>opak.</option></select>
        </div>
        <button class="btn btn-primary" id="m-save-w">Zapisz</button>`);
      $('#m-save-w').onclick = async () => {
        const item = { name: $('#m-wn').value, qty: $('#m-wq').value, unit: $('#m-wu').value };
        if (state.cloud) await cloudAdd('warehouse', item);
        else { item.id = uid(); state.data.warehouse.push(item); persist(); }
        closeModal(); renderPage(); toast('Produkt dodany');
      };
    });
    $$('[data-del-wh]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('warehouse', b.dataset.delWh);
      else { state.data.warehouse = state.data.warehouse.filter(p => p.id !== b.dataset.delWh); persist(); }
      renderPage();
    });
  }

  if (id === 'park') {
    $('#add-machine-btn')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Nowa maszyna</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Nazwa</label><input id="m-mn"></div>
        <div class="form-group"><label>Model</label><input id="m-mm"></div>
        <div class="form-group"><label>Nr serwisu</label><input id="m-ms"></div>
        <div class="form-group"><label>Status</label>
          <select id="m-mst"><option value="ok">OK</option><option value="check">Do kontroli</option><option value="fail">Awaria</option></select>
        </div>
        <div class="form-group"><label>Zdjęcie</label><input type="file" id="m-mi" accept="image/*"></div>
        <button class="btn btn-primary" id="m-save-m">Zapisz</button>`);
      $('#m-save-m').onclick = async () => {
        let img = null;
        const f = $('#m-mi').files[0];
        if (f) img = await fileToBase64(f);
        const item = { name: $('#m-mn').value, model: $('#m-mm').value, service: $('#m-ms').value, status: $('#m-mst').value, img };
        if (state.cloud) await cloudAdd('machines', item);
        else { item.id = uid(); state.data.machines.push(item); persist(); }
        closeModal(); renderPage(); toast('Maszyna dodana');
      };
    });
    $$('[data-del-machine]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('machines', b.dataset.delMachine);
      else { state.data.machines = state.data.machines.filter(m => m.id !== b.dataset.delMachine); persist(); }
      renderPage();
    });
    $$('.machine-status-sel').forEach(sel => {
      sel.onchange = async () => {
        if (state.cloud) await cloudSet('machines', sel.dataset.id, { status: sel.value });
        else {
          const m = state.data.machines.find(x => x.id === sel.dataset.id);
          if (m) { m.status = sel.value; persist(); }
        }
        renderPage(); toast('Status zaktualizowany');
      };
    });
  }

  if (id === 'magazyn-ur') {
    $('#add-ur-btn')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Pozycja UR</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Kategoria</label>
          <select id="m-urc">${Object.keys(state.data.urWarehouse).map(c=>`<option>${c}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Nazwa</label><input id="m-urn"></div>
        <div class="form-group"><label>Ilość</label><input id="m-urq"></div>
        <button class="btn btn-primary" id="m-save-ur">Zapisz</button>`);
      $('#m-save-ur').onclick = async () => {
        const item = { category: $('#m-urc').value, name: $('#m-urn').value, qty: $('#m-urq').value };
        if (state.cloud) await cloudAdd('urItems', item);
        else {
          item.id = uid();
          state.data.urWarehouse[item.category].push(item);
          persist();
        }
        closeModal(); renderPage(); toast('Dodano');
      };
    });
    $$('[data-del-ur]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('urItems', b.dataset.delUr);
      else {
        Object.keys(state.data.urWarehouse).forEach(cat => {
          state.data.urWarehouse[cat] = state.data.urWarehouse[cat].filter(i => i.id !== b.dataset.delUr);
        });
        persist();
      }
      renderPage();
    });
  }

  if (id === 'pracownicy') {
    $('#add-emp-btn')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Pracownik</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Kategoria</label>
          <select id="m-ec">${Object.keys(state.data.employees).map(c=>`<option>${c}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Imię i nazwisko</label><input id="m-en"></div>
        <div class="form-group"><label>Stanowisko</label><input id="m-ep"></div>
        <button class="btn btn-primary" id="m-save-e">Zapisz</button>`);
      $('#m-save-e').onclick = async () => {
        const item = { category: $('#m-ec').value, name: $('#m-en').value, pos: $('#m-ep').value };
        if (state.cloud) await cloudAdd('employees', item);
        else { item.id = uid(); state.data.employees[item.category].push(item); persist(); }
        closeModal(); renderPage(); toast('Pracownik dodany');
      };
    });
    $$('[data-del-emp]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('employees', b.dataset.delEmp);
      else {
        Object.keys(state.data.employees).forEach(cat => {
          state.data.employees[cat] = state.data.employees[cat].filter(e => e.id !== b.dataset.delEmp);
        });
        persist();
      }
      renderPage();
    });
  }

  if (id === 'awaria') {
    $('#print-qr-btn')?.addEventListener('click', () => printAwariaQr());
    $('#submit-fail')?.addEventListener('click', async () => {
      const title = $('#fail-title').value.trim();
      if (!title) return toast('Podaj tytuł', 'danger');
      const author = ($('#fail-author')?.value || '').trim() || (state.user?.label) || 'Operator (QR)';
      const item = { title, desc: $('#fail-desc').value.trim(), date: nowStr(), author, ts: Date.now() };
      if (state.cloud) {
        await cloudAdd('failures', item);
        await cloudUpdateMeta({ alertActive: true });
      } else {
        item.id = uid();
        state.data.failures.push(item);
        state.alertActive = true;
        persist();
      }
      state.alertActive = true;
      updateHeader(); renderPage();
      toast('Awaria zgłoszona! Alarm aktywny', 'danger');
    });
    $('#clear-alert-btn')?.addEventListener('click', async () => {
      state.alertActive = false;
      await cloudUpdateMeta({ alertActive: false });
      persist(); updateHeader(); renderPage();
      toast('Alarm wyłączony');
    });
  }

  if (id === 'czat') {
    const send = async () => {
      const inp = $('#chat-input');
      const text = inp.value.trim();
      if (!text) return;
      const item = { text, author: state.user.label, date: nowStr(), ts: Date.now() };
      if (state.cloud) await cloudAdd('chat', item);
      else { item.id = uid(); state.data.chat.push(item); persist(); }
      inp.value = '';
      if (!state.cloud) renderPage();
    };
    $('#chat-send')?.addEventListener('click', send);
    $('#chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  }

  if (id.startsWith('dzial-')) {
    $('#add-dept-btn')?.addEventListener('click', () => {
      openModal(`<div class="modal-header"><span class="modal-title">Nowy wpis</span><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="form-group"><label>Tytuł</label><input id="m-dt"></div>
        <div class="form-group"><label>Opis</label><textarea id="m-dd"></textarea></div>
        <div class="form-group"><label>Plik (opcjonalnie)</label><input type="file" id="m-df"></div>
        <button class="btn btn-primary" id="m-save-d">Zapisz</button>`);
      $('#m-save-d').onclick = async () => {
        let fileData = null, fileName = null;
        const f = $('#m-df').files[0];
        if (f) { fileData = await fileToBase64(f); fileName = f.name; }
        const item = { dept: id, title: $('#m-dt').value, text: $('#m-dd').value, fileData, fileName, date: nowStr(), author: state.user.label, ts: Date.now() };
        if (state.cloud) await cloudAdd('deptPosts', item);
        else {
          item.id = uid();
          if (!state.data.depts[id]) state.data.depts[id] = [];
          state.data.depts[id].push(item);
          persist();
        }
        closeModal(); renderPage(); toast('Wpis dodany');
      };
    });
    $$('[data-del-dept]').forEach(b => b.onclick = async () => {
      if (state.cloud) await cloudDelete('deptPosts', b.dataset.delDept);
      else {
        state.data.depts[id] = (state.data.depts[id]||[]).filter(n => n.id !== b.dataset.delDept);
        persist();
      }
      renderPage();
    });
  }

  if (id === 'ustawienia') {
    $('#print-qr-btn')?.addEventListener('click', () => printAwariaQr());
    $$('.theme-btn').forEach(b => b.onclick = () => { applyTheme(b.dataset.theme); renderPage(); });
    $$('[data-toggle-page]').forEach(cb => {
      cb.onchange = async () => {
        const pid = cb.dataset.togglePage;
        if (cb.checked) state.hiddenPages = state.hiddenPages.filter(x => x !== pid);
        else if (!state.hiddenPages.includes(pid)) state.hiddenPages.push(pid);
        await cloudUpdateMeta({ hiddenPages: state.hiddenPages });
        persist(); renderNav();
      };
    });
    $('#seed-data-btn')?.addEventListener('click', async () => {
      await seedDemo();
      toast('Dane przykładowe załadowane');
      renderPage();
    });
  }
}

window.downloadReport = function(pageId) {
  let content = `RAPORT DAVERION SYSTEM – ${pageId.toUpperCase()}\nData: ${nowStr()}\nUżytkownik: ${state.user?.label||'-'}\n\n`;
  if (pageId === 'aktualnosci') state.data.news.forEach(n => content += `[${n.date}] ${n.title}\n${n.text}\nAutor: ${n.author}\n\n`);
  else if (pageId === 'park') state.data.machines.forEach(m => content += `${m.name} | ${m.model} | ${m.service} | Status: ${m.status}\n`);
  else if (pageId === 'magazyn') state.data.warehouse.forEach(p => content += `${p.name}: ${p.qty} ${p.unit}\n`);
  else if (pageId === 'kalendarz') Object.entries(state.data.events).forEach(([k, evs]) => {
    content += `\n${k}:\n`; evs.forEach(e => content += `  - ${e.title}: ${e.desc}\n`);
  });
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `raport_${pageId}_${todayKey()}.txt`;
  a.click();
};

async function seedDemo() {
  const samples = {
    news: [
      { title: 'Uruchomienie nowej linii produkcyjnej', text: 'Z dniem dzisiejszym oficjalnie uruchomiono linię nr 3. Wydajność wzrosła o 18%.', date: nowStr(), author: 'Administrator', ts: Date.now()-100000 },
      { title: 'Szkolenie BHP – przypomnienie', text: 'Wszystkich pracowników prosimy o potwierdzenie udziału w szkoleniu do piątku.', date: nowStr(), author: 'Biuro', ts: Date.now()-200000 }
    ],
    machines: [
      { name: 'Prasa hydrauliczna PH-200', model: 'HydroTech X200', service: '500-111-222', status: 'ok' },
      { name: 'Tokarka CNC T-450', model: 'CNC Master 450', service: '500-333-444', status: 'check' },
      { name: 'Spawarka laserowa SL-10', model: 'LaserPro 10', service: '500-555-666', status: 'fail' }
    ],
    warehouse: [
      { name: 'Śruby M8x20', qty: '2500', unit: 'szt.' },
      { name: 'Oleje hydrauliczne HLP 46', qty: '120', unit: 'l' },
      { name: 'Blacha stalowa 2mm', qty: '45', unit: 'kg' }
    ],
    contacts: [
      { first: 'Jan', last: 'Kowalski', pos: 'Kierownik produkcji', contact: '500-100-200' },
      { first: 'Anna', last: 'Nowak', pos: 'Specjalista ds. jakości', contact: 'anna.nowak@firma.pl' }
    ],
    chat: [{ text: 'Witajcie w systemie Daverion!', author: 'Administrator', date: nowStr(), ts: Date.now()-50000 }]
  };

  if (state.cloud) {
    for (const n of samples.news) await cloudAdd('news', n);
    for (const m of samples.machines) await cloudAdd('machines', m);
    for (const w of samples.warehouse) await cloudAdd('warehouse', w);
    for (const c of samples.contacts) await cloudAdd('contacts', c);
    for (const ch of samples.chat) await cloudAdd('chat', ch);
    await cloudAdd('employees', { category: 'Produkcja', name: 'Piotr Wiśniewski', pos: 'Operator CNC' });
    await cloudAdd('employees', { category: 'Utrzymanie Ruchu', name: 'Andrzej Kamiński', pos: 'Mechanik' });
    await cloudAdd('urItems', { category: 'Elektronarzędzia', name: 'Wiertarka udarowa Bosch', qty: '3' });
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    const tk = tomorrow.toISOString().slice(0,10);
    await cloudSet('events', tk, { items: [{ id: uid(), title: 'Przegląd maszyn linii 2', desc: 'Planowany przegląd serwisowy' }] });
  } else {
    samples.news.forEach(n => { n.id = uid(); state.data.news.push(n); });
    samples.machines.forEach(m => { m.id = uid(); state.data.machines.push(m); });
    samples.warehouse.forEach(w => { w.id = uid(); state.data.warehouse.push(w); });
    samples.contacts.forEach(c => { c.id = uid(); state.data.contacts.push(c); });
    samples.chat.forEach(c => { c.id = uid(); state.data.chat.push(c); });
    persist();
  }
}

/* ========== LOGIN ========== */
function showUserLogin() {
  openModal(`<div class="modal-header"><span class="modal-title">Logowanie użytkownika</span><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="user-login-form">
      <div class="form-group"><label>Login</label><input id="ulogin" autocomplete="username"></div>
      <div class="form-group"><label>Hasło</label><input id="upass" type="password" autocomplete="current-password"></div>
      <button class="btn btn-primary" id="ulogin-btn">Zaloguj</button>
      ${state.user ? '<button class="btn btn-secondary" id="ulogout-btn" style="margin-top:0.5rem;">Wyloguj</button>' : ''}
      <div id="ulogin-err" style="color:var(--danger);font-size:0.85rem;margin-top:0.4rem;"></div>
    </div>`);
  $('#ulogin-btn').onclick = () => {
    const login = $('#ulogin').value.trim();
    const pass = $('#upass').value;
    if (USERS[login] && USERS[login].pass === pass) {
      state.user = { login, role: USERS[login].role, label: USERS[login].label };
      saveSession(); closeModal(); updateHeader(); renderNav(); renderPage();
      toast('Zalogowano: ' + state.user.label);
      return;
    }
    $('#ulogin-err').textContent = 'Nieprawidłowy login lub hasło';
  };
  $('#ulogout-btn')?.addEventListener('click', () => {
    state.user = null; saveSession(); closeModal(); updateHeader(); renderNav(); navigate('dashboard');
    toast('Wylogowano');
  });
}

/* ========== INIT ========== */
function printAwariaQr() {
  const url = getAwariaQrUrl();
  const qrImg = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=12&data=' + encodeURIComponent(url);
  const w = window.open('', '_blank', 'width=480,height=640');
  if (!w) { toast('Zezwól na okna popup, aby drukować', 'danger'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>QR – Zgłoś awarię · Daverion</title>
    <style>
      body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#0f172a}
      h1{font-size:1.4rem;margin:0 0 8px}
      p{color:#64748b;font-size:0.9rem}
      img{margin:16px auto;display:block;border:1px solid #e2e8f0;border-radius:12px}
      .url{font-size:0.7rem;word-break:break-all;margin-top:12px;color:#94a3b8}
      .hint{margin-top:20px;font-weight:700;font-size:1rem;color:#dc2626}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>DAVERION SYSTEM</h1>
    <p>Zeskanuj, aby zgłosić awarię</p>
    <img src="${qrImg}" width="400" height="400" alt="QR">
    <p class="hint">⚠ ZGŁOŚ AWARIĘ</p>
    <p class="url">${url.replace(/</g,'')}</p>
    <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
    </body></html>`);
  w.document.close();
}

function consumeDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const open = (params.get('open') || params.get('page') || '').toLowerCase();
    const hash = (window.location.hash || '').replace('#','').toLowerCase();
    if (open === 'awaria' || open === 'awarie' || hash === 'awaria') {
      state.currentPage = 'awaria';
      // clean URL without reload
      if (window.history && window.history.replaceState) {
        const clean = window.location.pathname + window.location.hash.replace(/#awaria/i,'');
        window.history.replaceState({}, '', clean || window.location.pathname);
      }
      return true;
    }
  } catch (e) {}
  return false;
}

function updateOnlineUi() {
  const offline = !navigator.onLine;
  const b = document.getElementById('offline-banner');
  if (b) b.classList.toggle('show', offline);
  if (offline) {
    setSyncBadge(false);
    const badge = $('#sync-badge');
    if (badge) { badge.textContent = '○ offline'; badge.style.background = '#7c2d12'; badge.style.color = '#fed7aa'; }
  } else if (state.cloud) setSyncBadge(true);
}
function init() {
  loadLocalSession();
  applyTheme(state.theme || 'dark');
  initFirebase();
  updateOnlineUi();
  window.addEventListener('online', () => {
    updateOnlineUi();
    toast('Sieć dostępna – synchronizacja');
    if (!state.cloud) initFirebase();
  });
  window.addEventListener('offline', () => {
    updateOnlineUi();
    toast('Brak sieci – tryb lokalny', 'danger');
  });

  if (state.gateOk) {
    $('#gate-screen').classList.add('hidden');
    $('#app').style.display = 'block';
    consumeDeepLink();
    updateHeader(); renderNav(); renderPage();
  }

  $('#gate-form').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#gate-pass').value === GATE_PASS) {
      setGate();
      $('#gate-screen').classList.add('hidden');
      $('#app').style.display = 'block';
      consumeDeepLink();
      updateHeader(); renderNav(); renderPage();
    } else {
      $('#gate-error').textContent = 'Nieprawidłowe hasło';
      $('#gate-pass').value = '';
    }
  });

  $('#logo-btn').addEventListener('click', showUserLogin);
  $('#menu-toggle')?.addEventListener('click', openSidebarMobile);
  $('#sidebar-overlay')?.addEventListener('click', closeSidebarMobile);
  $('#modal-overlay')?.addEventListener('click', e => {
    if (e.target === $('#modal-overlay')) closeModal();
  });

  $('#alert-dot')?.addEventListener('click', async () => {
    if (canClearAlert()) {
      state.alertActive = false;
      await cloudUpdateMeta({ alertActive: false });
      persist(); updateHeader();
      toast('Alarm wyłączony');
    } else navigate('awaria');
  });

  const themes = ['dark', 'light', 'tech'];
  $('#theme-quick')?.addEventListener('click', () => {
    const idx = themes.indexOf(state.theme);
    applyTheme(themes[(idx + 1) % themes.length]);
    toast('Motyw: ' + state.theme);
  });

  $('#footer-link')?.addEventListener('click', e => {
    e.preventDefault();
    openModal(`<div class="modal-header"><span class="modal-title">Black Baron System</span><button class="modal-close" onclick="closeModal()">×</button></div>
      <p style="text-align:center;font-size:1.3rem;margin:1.5rem 0;">
        <a href="tel:519357574" style="color:var(--primary);text-decoration:none;font-weight:700;">519 - 357 - 574</a>
      </p>
      <p style="text-align:center;color:var(--text-muted);font-size:0.85rem;">Kontakt do twórcy systemu</p>`);
  });

  setInterval(() => {
    const gate = localStorage.getItem('ds_gate');
    if (gate) {
      const g = JSON.parse(gate);
      if (Date.now() >= g.expires) { localStorage.removeItem('ds_gate'); location.reload(); }
    }
  }, 60000);
}

init();
