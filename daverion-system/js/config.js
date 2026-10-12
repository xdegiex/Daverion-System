/* ============================================================
   DAVERION SYSTEM – Konfiguracja
   ============================================================ */

const GATE_PASS = 'dav';
const GATE_DURATION = 60 * 60 * 1000; // 60 min

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
  { id: 'dashboard',       label: 'Panel główny',       icon: '▣', section: 'main' },
  { id: 'aktualnosci',     label: 'Aktualności',        icon: '📰', section: 'main' },
  { id: 'kalendarz',       label: 'Kalendarz',          icon: '📅', section: 'main' },
  { id: 'park',            label: 'Park Maszyn',        icon: '⚙', section: 'prod' },
  { id: 'magazyn',         label: 'Magazyn',            icon: '📦', section: 'prod' },
  { id: 'magazyn-ur',      label: 'Magazyn UR',         icon: '🔧', section: 'prod' },
  { id: 'pracownicy',      label: 'Pracownicy',         icon: '👥', section: 'hr' },
  { id: 'kontakty',        label: 'Kontakty',           icon: '📞', section: 'hr' },
  { id: 'awaria',          label: '! Zgłoś Awarię !',   icon: '⚠', section: 'alert', special: true },
  { id: 'czat',            label: 'Czat Firmowy',       icon: '💬', section: 'comm' },
  { id: 'dzial-mech',      label: 'Dział Mechaniczny',  icon: '🔩', section: 'depts' },
  { id: 'dzial-jakosc',    label: 'Dział Jakości',      icon: '✓', section: 'depts' },
  { id: 'dzial-admin',     label: 'Dział Administracji',icon: '📋', section: 'depts' },
  { id: 'dzial-magazyn',   label: 'Dział Magazyn',      icon: '🏷', section: 'depts' },
  { id: 'dzial-produkcja', label: 'Dział Produkcji',    icon: '🏭', section: 'depts' },
  { id: 'ustawienia',      label: 'Ustawienia',         icon: '⚙', section: 'admin', roles: ['admin'] }
];

const SECTION_LABELS = {
  main: 'Główne',
  prod: 'Produkcja',
  hr: 'Kadry',
  alert: '',
  comm: 'Komunikacja',
  depts: 'Działy',
  admin: 'System'
};
