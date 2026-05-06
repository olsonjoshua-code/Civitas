// Civitas Dash gameplay engine and UI logic.
// Depends on data/unit1.js and js/progress.js.

// ════════════════════════════════════════════════════════════════
// UI — Mario-3 world map, unit entry, navigation
// ════════════════════════════════════════════════════════════════
const screens = {
  worldMap:    document.getElementById('screen-worldMap'),
  unitEntry:   document.getElementById('screen-unitEntry'),
  game:        document.getElementById('screen-game'),
  leaderboard: document.getElementById('screen-leaderboard'),
  profile:     document.getElementById('screen-profile'),
};
const appEl = document.querySelector('.app');
const navBtns = document.querySelectorAll('.nav-btn');
function showScreen(name){
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
  // Game screen takes over: hide topbar + footer.
  appEl.classList.toggle('game-active', name === 'game');
  // Top-nav buttons only highlight for top-level screens.
  navBtns.forEach(b => {
    const isActive = b.dataset.screen === name || (name === 'unitEntry' && b.dataset.screen === 'worldMap');
    b.classList.toggle('active', isActive);
  });
}
navBtns.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.screen)));

// Back from unit entry → world map
document.getElementById('ueBack').addEventListener('click', () => showScreen('worldMap'));

function renderIdentity(){
  document.getElementById('identName').textContent = IDENTITY.name || '—';
  document.getElementById('identPeriod').textContent = IDENTITY.period ? ('Period ' + IDENTITY.period) : '';
  const pct = PROGRESS.completion_pct || 0;
  const tier = (PROGRESS.trophy_tier && PROGRESS.trophy_tier !== 'none')
    ? PROGRESS.trophy_tier.charAt(0).toUpperCase() + PROGRESS.trophy_tier.slice(1)
    : 'No tier yet';
  document.getElementById('identProgress').textContent = pct + '% · ' + tier;
}

function renderProfile(){
  document.getElementById('profileName').textContent = IDENTITY.name || '—';
  document.getElementById('profileMeta').textContent =
    (IDENTITY.period ? ('Period ' + IDENTITY.period + ' · ') : '') +
    'Identity from: ' + IDENTITY.source;
  const list = document.getElementById('profileStats');
  list.innerHTML = '';
  const rows = [
    ['Rounds completed', PROGRESS.rounds_completed + ' / ' + PROGRESS.rounds_total],
    ['Units completed',  PROGRESS.units_completed + ' / 17'],
    ['Cumulative score', PROGRESS.completion_pct + '%'],
    ['Trophy tier',      PROGRESS.trophy_tier],
    ['Total runs',       PROGRESS.total_runs],
    ['Total coins',      PROGRESS.total_coins],
    ['Last played',      PROGRESS.last_played_at || '—'],
  ];
  rows.forEach(([k,v]) => {
    const row = document.createElement('div');
    row.innerHTML = '<span class="k">' + k + ':</span><span class="v">' + v + '</span>';
    list.appendChild(row);
  });
}

// ── World-map layout (Mario-3 winding path) ───────────────────────
// 17 worlds laid out in 3 horizontal rows that snake.
// Row 1 (left → right):  worlds 1-6
// Row 2 (right → left):  worlds 7-12
// Row 3 (left → right):  worlds 13-17
// Coordinates expressed as percentages of the .wm-map container so it scales.
function getWorldMapLayout(){
  const r1y = 18, r2y = 50, r3y = 82;
  const positions = [];
  // Row 1: 6 nodes, x from 8% → 92%
  const row1xs = [8, 24.8, 41.6, 58.4, 75.2, 92];
  row1xs.forEach((x, i) => positions.push({ idx:i,    x, y:r1y }));
  // Row 2: 6 nodes, x from 92% → 8% (right-to-left)
  const row2xs = [92, 75.2, 58.4, 41.6, 24.8, 8];
  row2xs.forEach((x, i) => positions.push({ idx:6+i,  x, y:r2y }));
  // Row 3: 5 nodes, x from 8% → 92%
  const row3xs = [8, 29, 50, 71, 92];
  row3xs.forEach((x, i) => positions.push({ idx:12+i, x, y:r3y }));
  return positions;
}

function buildWmPath(positions){
  // Build a smooth SVG path that connects the 17 nodes in order.
  // Use simple line segments for now; small curves where rows turn back.
  if(!positions.length) return '';
  let d = `M ${positions[0].x} ${positions[0].y}`;
  for(let i=1; i<positions.length; i++){
    const prev = positions[i-1];
    const cur = positions[i];
    // Same row → straight line
    if(prev.y === cur.y){
      d += ` L ${cur.x} ${cur.y}`;
    } else {
      // Row transition → soft curve
      const midX = (prev.x + cur.x) / 2;
      d += ` Q ${prev.x} ${cur.y}, ${midX} ${cur.y} L ${cur.x} ${cur.y}`;
    }
  }
  return d;
}

let SELECTED_UNIT = null; // tracks which world the user picked

function renderWorldMap(){
  const map = document.getElementById('wmMap');
  // Wipe everything except the SVG
  Array.from(map.querySelectorAll('.wm-node')).forEach(n => n.remove());

  const positions = getWorldMapLayout();

  // Update the SVG path
  const svg = document.getElementById('wmSvg');
  // viewBox sized to map container at runtime; use 0-100 percentages
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.innerHTML = `
    <path d="${buildWmPath(positions)}"
          fill="none"
          stroke="#7a5018"
          stroke-width="0.6"
          stroke-dasharray="1.4,1.0"
          stroke-linecap="round"
          opacity="0.55"/>
  `;

  // Place nodes
  WORLDS.forEach((w, i) => {
    const pos = positions[i];
    if(!pos) return;

    const node = document.createElement('div');
    node.className = 'wm-node ' + (w.unlocked ? 'unlocked' : 'locked');
    node.style.left = `calc(${pos.x}% - 44px)`;
    node.style.top  = `calc(${pos.y}% - 44px)`;
    node.style.setProperty('--era-color', w.eraColor || '#5a4030');
    node.dataset.unitId = w.id;

    const unitProg = PROGRESS.units && PROGRESS.units[w.id];
    const completed = unitProg && unitProg.roundsCompleted === unitProg.roundsTotal && unitProg.roundsTotal > 0;

    const tooltipMeta = w.unlocked
      ? `${w.years || ''}${w.rounds?.length ? ' · ' + w.rounds.length + ' rounds' : ''}`
      : (w.comingSoon ? 'Coming soon · author in progress' : 'Reserved');

    const tooltipBody = w.unlocked
      ? (w.intro || 'Tap to enter this world.')
      : 'Future units will unlock as they are added.';

    const iconSvg = WORLD_ICONS[w.iconKey] || '';

    node.innerHTML = `
      <div class="wm-circle">
        <div class="wm-icon">${iconSvg}</div>
        <div class="wm-num-badge">${w.num}</div>
        ${completed ? '<div class="wm-completed-mark">✓</div>' : ''}
      </div>
      <div class="wm-name">${w.title}</div>
      <div class="wm-years">${w.years || '—'}</div>
      <div class="wm-tip">
        <span class="tip-title">${w.title}</span>
        <span class="tip-meta">${tooltipMeta}</span>
        <div style="margin-top:6px;font-style:italic;">${tooltipBody}</div>
      </div>
    `;

    if(w.unlocked){
      node.addEventListener('click', () => openUnitEntry(w.id));
    }
    map.appendChild(node);
  });

  // Update progress banner numbers
  document.getElementById('wmRounds').textContent = PROGRESS.rounds_completed || 0;
  document.getElementById('wmUnits').textContent = PROGRESS.units_completed || 0;
  document.getElementById('wmComposite').textContent = (PROGRESS.composite_score || 0) + '%';
  const tier = (PROGRESS.trophy_tier && PROGRESS.trophy_tier !== 'none')
    ? PROGRESS.trophy_tier.charAt(0).toUpperCase() + PROGRESS.trophy_tier.slice(1)
    : '—';
  document.getElementById('wmTier').innerHTML = '<b>' + tier + '</b> tier';
}

// ── Unit entry: 4 round cards for a selected world ───────────────
function openUnitEntry(unitId){
  const world = WORLDS.find(w => w.id === unitId);
  if(!world || !world.unlocked) return;
  SELECTED_UNIT = world;
  renderUnitEntry();
  showScreen('unitEntry');
}

function renderUnitEntry(){
  const w = SELECTED_UNIT;
  if(!w) return;

  document.getElementById('ueEyebrow').textContent = 'UNIT ' + w.num;
  document.getElementById('ueTitle').textContent = w.title;
  document.getElementById('ueYears').textContent = w.years || '';
  document.getElementById('ueBlurb').textContent = w.intro || '';

  const host = document.getElementById('ueRounds');
  host.innerHTML = '';

  // Round-unlock logic: 1-1 always unlocked. Each round unlocked once
  // the previous one has been completed at least once.
  w.rounds.forEach((rd, i) => {
    const prevId = i === 0 ? null : w.rounds[i-1].id;
    const prevDone = !prevId || (PROGRESS.rounds && PROGRESS.rounds[prevId]);
    const isUnlocked = i === 0 || prevDone;

    const myProg = PROGRESS.rounds && PROGRESS.rounds[rd.id];
    const stars = myProg ? (myProg.stars || 0) : 0;

    const card = document.createElement('div');
    card.className = 'ue-round'
      + (rd.isCastle ? ' castle' : '')
      + (!isUnlocked ? ' locked' : '');

    const platformsLabel = rd.isCastle ? '10 platforms' : '8 platforms';
    const starHtml =
      '<span class="stars earned">' + '★'.repeat(stars) + '</span>' +
      '<span class="stars empty">' + '☆'.repeat(3 - stars) + '</span>';

    card.innerHTML = `
      ${!isUnlocked ? '<div class="lock-badge">LOCKED</div>' : ''}
      <div class="round-num">ROUND ${rd.num}${rd.isCastle ? ' 🏰' : ''}</div>
      <div class="round-title">${rd.title}</div>
      <div class="round-sub">${rd.sub || ''}</div>
      <div class="round-meta">
        <span>${platformsLabel}</span>
        <span>${starHtml}</span>
      </div>
    `;

    if(isUnlocked){
      card.addEventListener('click', () => launchRound(w, rd));
    }
    host.appendChild(card);
  });
}

// ════════════════════════════════════════════════════════════════
// CHUNK 3 — Game Engine
// Round 1-1 playable: kid courier, sentry, platforms, pits, coins,
// question modal, lives, round-end save to Supabase.
// ════════════════════════════════════════════════════════════════

// ── Sprites (inline SVG) ─────────────────────────────────────────
// The Civil War kid courier — same vector design from the locked mockup.
// Built as a layered group so legs can animate independently.
const KID_SVG = `<svg viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="24" cy="56" rx="14" ry="3" fill="rgba(0,0,0,.18)"/>
  <!-- Boots -->
  <g class="leg-back"><rect x="18" y="44" width="5" height="11" rx="1" fill="#2a2010"/><rect x="16" y="52" width="9" height="3" fill="#1a0e08"/></g>
  <g class="leg-front"><rect x="25" y="44" width="5" height="11" rx="1" fill="#3a3020"/><rect x="23" y="52" width="9" height="3" fill="#1a0e08"/></g>
  <!-- Pants/jacket body (Union blue) -->
  <path d="M 14 22 Q 14 14 24 14 Q 34 14 34 22 L 34 44 Q 34 46 32 46 L 16 46 Q 14 46 14 44 Z" fill="#1f3656"/>
  <!-- Belt -->
  <ellipse cx="24" cy="46" rx="11" ry="2.2" fill="#5a3a18"/>
  <!-- Buttons -->
  <circle cx="20" cy="24" r="0.9" fill="#d4a850"/>
  <circle cx="20" cy="29" r="0.9" fill="#d4a850"/>
  <circle cx="28" cy="24" r="0.9" fill="#d4a850"/>
  <circle cx="28" cy="29" r="0.9" fill="#d4a850"/>
  <!-- Arms -->
  <path d="M 8 22 Q 8 28 12 30 L 14 30 L 14 24 L 12 24 Q 8 22 8 22 Z" fill="#1f3656"/>
  <ellipse cx="10" cy="26" rx="2.5" ry="1.8" fill="#f4c890"/>
  <path d="M 34 22 L 36 22 Q 40 22 40 27 Q 40 30 36 30 L 34 30 Z" fill="#1f3656"/>
  <ellipse cx="38" cy="26" rx="2.5" ry="1.8" fill="#f4c890"/>
  <!-- Head -->
  <ellipse cx="24" cy="11" rx="9" ry="7" fill="#f4c890"/>
  <ellipse cx="21" cy="10.5" rx="0.8" ry="1.1" fill="#1a0e08"/>
  <ellipse cx="27" cy="10.5" rx="0.8" ry="1.1" fill="#1a0e08"/>
  <path d="M 21 14 Q 24 15 27 14" stroke="#a85020" stroke-width="0.6" fill="none" stroke-linecap="round"/>
  <!-- Hair -->
  <path d="M 17 7 Q 22 4 30 6 Q 33 8 32 11 L 16 11 Q 16 8 17 7 Z" fill="#3a2510"/>
  <!-- Kepi cap -->
  <path d="M 14 3 Q 17 0 24 1 Q 33 1 36 4 Q 38 6 38 7 L 36 9 L 14 9 L 12 7 Q 12 5 14 3 Z" fill="#1f3656" stroke="#0a1a30" stroke-width="0.5"/>
  <path d="M 14 7 L 36 7 L 36 9 L 14 9 Z" fill="#0a1a30"/>
  <path d="M 32 8 Q 38 9 41 10 L 41 11 Q 38 10.5 32 10 Z" fill="#0a1a30"/>
  <circle cx="24" cy="5" r="1.4" fill="#d4a850" stroke="#7a5818" stroke-width="0.3"/>
</svg>`;

// Confederate sentry — non-graphic patrol enemy.
const SENTRY_SVG = `<svg viewBox="0 0 34 50" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="17" cy="48" rx="12" ry="2" fill="rgba(0,0,0,.25)"/>
  <!-- Boots -->
  <rect x="13" y="40" width="4" height="8" fill="#3a3020"/>
  <rect x="11" y="46" width="8" height="2" fill="#1a0e08"/>
  <rect x="17" y="40" width="4" height="8" fill="#3a3020"/>
  <rect x="15" y="46" width="8" height="2" fill="#1a0e08"/>
  <!-- Body (gray-green Confederate uniform) -->
  <path d="M 7 18 Q 7 10 17 10 Q 27 10 27 18 L 27 38 Q 27 40 25 40 L 9 40 Q 7 40 7 38 Z" fill="#7a8070" stroke="#3a3020" stroke-width="0.6"/>
  <!-- Belt -->
  <ellipse cx="17" cy="40" rx="11" ry="1.8" fill="#3a2510"/>
  <!-- Buttons -->
  <circle cx="13" cy="20" r="0.8" fill="#a89870"/>
  <circle cx="13" cy="25" r="0.8" fill="#a89870"/>
  <circle cx="13" cy="30" r="0.8" fill="#a89870"/>
  <!-- Belt strap -->
  <rect x="0" y="22" width="20" height="2" fill="#3a2510" stroke="#1a0e08" stroke-width="0.4"/>
  <rect x="16" y="20" width="6" height="3" fill="#1a0e08"/>
  <!-- Arms -->
  <rect x="3" y="20" width="4" height="10" fill="#7a8070"/>
  <ellipse cx="5" cy="30" rx="2" ry="1.4" fill="#d8b890"/>
  <rect x="27" y="20" width="4" height="10" fill="#7a8070"/>
  <ellipse cx="29" cy="30" rx="2" ry="1.4" fill="#d8b890"/>
  <!-- Head -->
  <ellipse cx="17" cy="8" rx="6" ry="5" fill="#d8b890" stroke="#5a3820" stroke-width="0.4"/>
  <path d="M 12 8 Q 14 11 17 12 Q 20 11 22 9" stroke="#3a2510" stroke-width="0.8" fill="none"/>
  <ellipse cx="14.5" cy="7" rx="0.6" ry="0.9" fill="#1a0e08"/>
  <!-- Slouch hat (gray) -->
  <ellipse cx="17" cy="4" rx="9" ry="1.2" fill="#5a4030" stroke="#2a1810" stroke-width="0.4"/>
  <path d="M 11 1 Q 11 -1 17 -1 Q 23 -1 23 1 L 23 4 L 11 4 Z" fill="#5a4030" stroke="#2a1810" stroke-width="0.4"/>
</svg>`;

// Civil War cannon — small wheeled artillery piece pointing left.
// Stationary; fires cannonballs on a cooldown.
const CANNON_SVG = `<svg viewBox="0 0 60 46" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="30" cy="44" rx="26" ry="2" fill="rgba(0,0,0,.35)"/>
  <!-- Wooden carriage trail (stretches back to the right) -->
  <path d="M 30 30 L 56 38 L 56 42 L 30 38 Z" fill="#7a4818" stroke="#3a2008" stroke-width="0.6"/>
  <!-- Wheel (back) -->
  <circle cx="44" cy="36" r="9" fill="#5a3010" stroke="#2a1408" stroke-width="0.8"/>
  <circle cx="44" cy="36" r="6" fill="none" stroke="#a07840" stroke-width="0.5"/>
  <line x1="35" y1="36" x2="53" y2="36" stroke="#3a2010" stroke-width="0.8"/>
  <line x1="44" y1="27" x2="44" y2="45" stroke="#3a2010" stroke-width="0.8"/>
  <line x1="38" y1="30" x2="50" y2="42" stroke="#3a2010" stroke-width="0.7"/>
  <line x1="50" y1="30" x2="38" y2="42" stroke="#3a2010" stroke-width="0.7"/>
  <circle cx="44" cy="36" r="1.5" fill="#1a0e08"/>
  <!-- Barrel (the gun) -->
  <rect x="3" y="20" width="36" height="14" rx="2" fill="#3a3a3a" stroke="#0a0a0a" stroke-width="0.7"/>
  <!-- Barrel highlights -->
  <rect x="3" y="20" width="36" height="3" fill="#5a5a5a"/>
  <rect x="3" y="32" width="36" height="2" fill="#1a1a1a"/>
  <!-- Reinforcement bands -->
  <rect x="11" y="19" width="3" height="16" fill="#2a2a2a" stroke="#0a0a0a" stroke-width="0.4"/>
  <rect x="22" y="19" width="3" height="16" fill="#2a2a2a" stroke="#0a0a0a" stroke-width="0.4"/>
  <rect x="33" y="19" width="3" height="16" fill="#2a2a2a" stroke="#0a0a0a" stroke-width="0.4"/>
  <!-- Muzzle (left tip) -->
  <ellipse cx="3" cy="27" rx="2" ry="7" fill="#1a1a1a" stroke="#000" stroke-width="0.5"/>
  <ellipse cx="3" cy="27" rx="0.8" ry="3.5" fill="#000"/>
  <!-- Wheel (front, partially behind the barrel) -->
  <circle cx="22" cy="36" r="9" fill="#5a3010" stroke="#2a1408" stroke-width="0.8"/>
  <circle cx="22" cy="36" r="6" fill="none" stroke="#a07840" stroke-width="0.5"/>
  <line x1="13" y1="36" x2="31" y2="36" stroke="#3a2010" stroke-width="0.8"/>
  <line x1="22" y1="27" x2="22" y2="45" stroke="#3a2010" stroke-width="0.8"/>
  <line x1="16" y1="30" x2="28" y2="42" stroke="#3a2010" stroke-width="0.7"/>
  <line x1="28" y1="30" x2="16" y2="42" stroke="#3a2010" stroke-width="0.7"/>
  <circle cx="22" cy="36" r="1.5" fill="#1a0e08"/>
</svg>`;

// Redeemer politician — Reconstruction-era political backlash figure.
// Suit-and-hat patrol enemy. Stompable but respawns after 3 seconds.
const REDEEMER_SVG = `<svg viewBox="0 0 36 54" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="18" cy="52" rx="14" ry="1.5" fill="rgba(0,0,0,.35)"/>
  <!-- Legs (black trousers) -->
  <rect x="11" y="36" width="5" height="16" fill="#1a1a1a" stroke="#000" stroke-width="0.4"/>
  <rect x="20" y="36" width="5" height="16" fill="#1a1a1a" stroke="#000" stroke-width="0.4"/>
  <!-- Shoes -->
  <ellipse cx="13" cy="52" rx="3" ry="1.4" fill="#0a0a0a"/>
  <ellipse cx="22" cy="52" rx="3" ry="1.4" fill="#0a0a0a"/>
  <!-- Frock coat (dark gray with subtle highlights) -->
  <path d="M 8 18 L 28 18 L 30 38 L 6 38 Z" fill="#2a2a30" stroke="#0a0a0e" stroke-width="0.5"/>
  <!-- Coat lapels -->
  <path d="M 14 18 L 18 28 L 14 22 Z" fill="#1a1a20" stroke="#0a0a0e" stroke-width="0.3"/>
  <path d="M 22 18 L 18 28 L 22 22 Z" fill="#1a1a20" stroke="#0a0a0e" stroke-width="0.3"/>
  <!-- White shirt collar / vest -->
  <path d="M 16 18 L 20 18 L 19 28 L 17 28 Z" fill="#e8e0d0" stroke="#a89880" stroke-width="0.3"/>
  <!-- Watch chain (gold) -->
  <path d="M 17 26 Q 18 28 19 26" stroke="#d4a850" stroke-width="0.5" fill="none"/>
  <!-- Coat buttons -->
  <circle cx="14" cy="26" r="0.5" fill="#a08868"/>
  <circle cx="22" cy="26" r="0.5" fill="#a08868"/>
  <circle cx="14" cy="32" r="0.5" fill="#a08868"/>
  <circle cx="22" cy="32" r="0.5" fill="#a08868"/>
  <!-- Head -->
  <ellipse cx="18" cy="14" rx="6" ry="5.5" fill="#e8c8a8" stroke="#5a3820" stroke-width="0.4"/>
  <!-- White beard -->
  <path d="M 13 16 Q 14 22 18 22 Q 22 22 23 16 L 22 18 L 18 20 L 14 18 Z" fill="#d8d0c0" stroke="#888070" stroke-width="0.3"/>
  <!-- Eyes (stern) -->
  <ellipse cx="15.5" cy="13" rx="0.6" ry="0.8" fill="#1a0e08"/>
  <ellipse cx="20.5" cy="13" rx="0.6" ry="0.8" fill="#1a0e08"/>
  <!-- Mouth -->
  <path d="M 16 16 Q 18 17 20 16" stroke="#5a3820" stroke-width="0.5" fill="none"/>
  <!-- Top hat -->
  <ellipse cx="18" cy="9" rx="9" ry="1.2" fill="#0a0a0a"/>
  <rect x="11" y="-1" width="14" height="10" fill="#0a0a0a" stroke="#000" stroke-width="0.4"/>
  <rect x="11" y="6" width="14" height="1.5" fill="#1a1a1a"/>
  <!-- Hat band -->
  <rect x="11" y="6" width="14" height="0.8" fill="#3a2010"/>
</svg>`;

// Civil War general boss — mini-boss with health bar.
// Decorated officer: long blue Union coat, gold epaulettes, kepi with insignia,
// white beard. Holds a saber. Larger than sentries.
// (Note: deliberately ambiguous Union/Confederate — represents military
// authority broadly; the threat is the centralized power, not the side.)
const GENERAL_SVG = `<svg viewBox="0 0 60 78" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="30" cy="76" rx="22" ry="2" fill="rgba(0,0,0,.4)"/>
  <!-- Boots -->
  <rect x="16" y="58" width="9" height="18" fill="#1a0e04" stroke="#000" stroke-width="0.4"/>
  <rect x="35" y="58" width="9" height="18" fill="#1a0e04" stroke="#000" stroke-width="0.4"/>
  <ellipse cx="20" cy="76" rx="5" ry="1.5" fill="#000"/>
  <ellipse cx="40" cy="76" rx="5" ry="1.5" fill="#000"/>
  <!-- Trousers (sky blue with red stripe) -->
  <rect x="16" y="44" width="9" height="16" fill="#5a78a0" stroke="#1a2840" stroke-width="0.4"/>
  <rect x="35" y="44" width="9" height="16" fill="#5a78a0" stroke="#1a2840" stroke-width="0.4"/>
  <rect x="24" y="44" width="1.2" height="16" fill="#a0202a"/>
  <rect x="35" y="44" width="1.2" height="16" fill="#a0202a"/>
  <!-- Long coat (dark blue Union officer style) -->
  <path d="M 12 20 L 48 20 L 50 50 L 10 50 Z" fill="#2a3a5a" stroke="#0a1428" stroke-width="0.6"/>
  <!-- Coat tail -->
  <path d="M 14 48 L 14 56 L 22 50 Z" fill="#1a2848" stroke="#0a1428" stroke-width="0.4"/>
  <path d="M 46 48 L 46 56 L 38 50 Z" fill="#1a2848" stroke="#0a1428" stroke-width="0.4"/>
  <!-- Gold buttons (double row) -->
  <circle cx="22" cy="26" r="1" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <circle cx="38" cy="26" r="1" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <circle cx="22" cy="32" r="1" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <circle cx="38" cy="32" r="1" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <circle cx="22" cy="38" r="1" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <circle cx="38" cy="38" r="1" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <circle cx="22" cy="44" r="1" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <circle cx="38" cy="44" r="1" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <!-- Gold sash -->
  <rect x="24" y="30" width="12" height="2" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <!-- Epaulettes (gold shoulder boards) -->
  <ellipse cx="14" cy="22" rx="4" ry="2" fill="#d4a850" stroke="#5a4010" stroke-width="0.4"/>
  <ellipse cx="46" cy="22" rx="4" ry="2" fill="#d4a850" stroke="#5a4010" stroke-width="0.4"/>
  <!-- Saber (held at right side) -->
  <line x1="50" y1="40" x2="56" y2="62" stroke="#c0c0c0" stroke-width="1.2"/>
  <rect x="48" y="38" width="3" height="4" fill="#d4a850" stroke="#5a4010" stroke-width="0.3"/>
  <!-- Head -->
  <ellipse cx="30" cy="14" rx="7" ry="6" fill="#e8c8a8" stroke="#5a3820" stroke-width="0.4"/>
  <!-- White beard (large, full) -->
  <path d="M 23 16 Q 24 26 30 26 Q 36 26 37 16 L 35 19 L 30 22 L 25 19 Z"
    fill="#dcd4c4" stroke="#888070" stroke-width="0.3"/>
  <!-- Eyes (intense) -->
  <ellipse cx="27" cy="13" rx="0.7" ry="0.9" fill="#1a0e08"/>
  <ellipse cx="33" cy="13" rx="0.7" ry="0.9" fill="#1a0e08"/>
  <!-- Mustache -->
  <path d="M 25 16 Q 30 18 35 16" stroke="#888070" stroke-width="1.2" fill="none"/>
  <!-- Kepi (officer cap) -->
  <ellipse cx="30" cy="6" rx="9" ry="1.2" fill="#1a2848"/>
  <path d="M 22 0 L 38 0 Q 39 4 38 7 L 22 7 Q 21 4 22 0 Z"
    fill="#2a3a5a" stroke="#0a1428" stroke-width="0.5"/>
  <!-- Cap insignia (gold star) -->
  <polygon points="30,2 31,4.5 33.5,4.5 31.5,6 32.5,8.5 30,7 27.5,8.5 28.5,6 26.5,4.5 29,4.5"
    fill="#d4a850" stroke="#5a4010" stroke-width="0.2"/>
</svg>`;

// ── Game state ───────────────────────────────────────────────────
const FINISH = 12500;
const GROUND_HEIGHT = 130;
const PLAYER_LEFT = 120;       // normal player screen x; boss arena can lock camera and let player move on screen
const GRAVITY = 1.1;
const JUMP_VELOCITY = -20;
const STOMP_BOUNCE = -12;
const MAX_FALL = 22;
const RUN_SPEED = 5.5;

let G = null;
let activeRound = null;        // { world, round } reference
let activeRoundQuestions = []; // The 8 sampled questions for this run
const inputState = { left:false, right:false, down:false, downPressed:false, jump:false, jumpHeld:false };

function freshGameState(){
  return {
    running:false, paused:false, over:false, finished:false,
    questionInProgress:false,
    distance: 0, parallaxX: 0,
    cameraX: 0, bossArenaActive: false, bossArenaStartX: null, bossArenaCameraX: null,
    y: 0, velocity: 0, jumping: false, ducking: false,
    facing: 1,
    lives: 3, correctCount: 0, retryCount: 0, score: 0, coinsCollected: 0,
    invincibleUntil: 0,
    safetyUntil: 0,           // post-question grace window (cannons paused)
    questionPausedAt: 0,      // wall-clock when modal opened (used to shift cooldowns)
    streak: 0,                // consecutive correct answers this round
    coinMeter: 0,             // current 0..99 progress toward next coin-life
    livesEarnedThisRound: 0,  // diagnostic: count of bonus lives this run
    livesLost: 0,             // for perfect-round bonus check
    platforms: [], obstacles: [], pits: [], coins: [], decoPlatforms: [],
    enemies: [], cannons: [], cannonballs: [], debris: [],
    boss: null,                   // castle boss object (or null)
    bossDefeated: false,          // becomes true when boss health hits 0
    finishGated: false,           // true on castle until boss defeated
    finishPlatform: null,
    onPlatformIdx: -1,
    currentPlatform: null,
    startTime: 0,
    loopId: 0,
    standingOnDeco: null,
  };
}

const MAX_LIVES = 5;
const STREAK_THRESHOLD = 5;
const COIN_LIFE_THRESHOLD = 100;

// ── World refs (queried fresh on every round start) ──────────────
function getGameRefs(){
  return {
    area: document.getElementById('gameArea'),
    player: document.getElementById('player'),
    ground: document.getElementById('ground'),
    parallaxFar: document.getElementById('parallaxFar'),
    parallaxMid: document.getElementById('parallaxMid'),
    skyClouds: document.getElementById('skyClouds'),
    msg: document.getElementById('gameMessage'),
    qmodalBg: document.getElementById('qmodalBg'),
    qmodal: document.getElementById('qmodal'),
    qStem: document.getElementById('qmodalStem'),
    qChoices: document.getElementById('qmodalChoices'),
    qFeedback: document.getElementById('qmodalFeedback'),
    qActions: document.getElementById('qmodalActions'),
    qProgress: document.getElementById('qmodalProgress'),
    qEyebrow: document.getElementById('qmodalEyebrow'),
    qContinue: document.getElementById('qmodalContinue'),
    rcOverlay: document.getElementById('roundClear'),
    rcTitle: document.getElementById('rcTitle'),
    rcStats: document.getElementById('rcStats'),
    rcReplay: document.getElementById('rcReplay'),
    rcMap: document.getElementById('rcMap'),
    rcNext: document.getElementById('rcNext'),
    hudLives: document.getElementById('hudLives'),
    hudCorrect: document.getElementById('hudCorrect'),
    hudPlatform: document.getElementById('hudPlatform'),
    hudCoins: document.getElementById('hudCoins'),
    hudScore: document.getElementById('hudScore'),
    hudStreak: document.getElementById('hudStreak'),
    hudStreakItem: document.getElementById('hudStreakItem'),
    hudTitle: document.getElementById('hudTitle'),
    hudSubtitle: document.getElementById('hudSubtitle'),
    hudExit: document.getElementById('hudExit'),
  };
}

// ── Question pool sampling ───────────────────────────────────────
function sampleAndShufflePool(roundId, sampleSize){
  const pool = (QUESTION_BANK[roundId] || []).slice();
  if(!pool.length) return [];
  // Shuffle the pool
  for(let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Take the first sampleSize
  const sampled = pool.slice(0, sampleSize);
  // For each question, shuffle its answer choices but track new correctIdx.
  return sampled.map(q => {
    const indexed = q.choices.map((c, i) => ({ c, originalIdx: i }));
    for(let i = indexed.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }
    return {
      ...q,
      choices: indexed.map(x => x.c),
      correctIdx: indexed.findIndex(x => x.originalIdx === q.correctIdx),
    };
  });
}

// ── Patrol clamp helper ──────────────────────────────────────────
// Given a sentry spec { worldX, patrolMin, patrolMax, vx } and the
// current G.pits array, mutate the spec so the patrol range never
// includes any pit territory. Handles 4 cases:
//   1. Patrol straddles pit (extends past both sides) — pick whichever
//      side has more room and clamp to it.
//   2. Patrol starts inside pit, ends past right edge — push patrolMin
//      to right of pit.
//   3. Patrol starts before pit, ends inside pit — pull patrolMax to
//      left of pit.
//   4. Patrol entirely inside pit — flag as bad spec; collapse to a
//      single safe point on whichever side has solid ground.
// In every case, if worldX falls outside the new range, recenter it.
function clampPatrolToPits(s){
  for(const pit of G.pits){
    const pitL = pit.worldX, pitR = pit.worldX + pit.width;
    const minInPit = s.patrolMin >= pitL && s.patrolMin <= pitR;
    const maxInPit = s.patrolMax >= pitL && s.patrolMax <= pitR;
    const straddles = s.patrolMin < pitL && s.patrolMax > pitR;
    if(straddles){
      // Case 1: choose the side with more room
      const leftRoom  = pitL - s.patrolMin;
      const rightRoom = s.patrolMax - pitR;
      if(leftRoom >= rightRoom) s.patrolMax = pitL - 30;
      else                       s.patrolMin = pitR + 30;
    } else if(minInPit && !maxInPit && s.patrolMax > pitR){
      // Case 2: patrol begins inside pit, exits to the right
      s.patrolMin = pitR + 30;
    } else if(maxInPit && !minInPit && s.patrolMin < pitL){
      // Case 3: patrol begins before pit, ends inside pit
      s.patrolMax = pitL - 30;
    } else if(minInPit && maxInPit){
      // Case 4: entirely inside pit — collapse to a tiny range just
      // past the right side (sentry will essentially stand still)
      s.patrolMin = pitR + 30;
      s.patrolMax = pitR + 80;
    }
    // Recenter worldX if it drifted out of the new range
    if(s.worldX < s.patrolMin || s.worldX > s.patrolMax){
      s.worldX = (s.patrolMin + s.patrolMax) / 2;
    }
  }
  return s;
}

// ── Level builder for Round 1-1 ──────────────────────────────────
// Lays out 8 question platforms across 12,500px, with sentries in
// patrol zones, a couple of pits, deco stepping stones, and coins.
function buildRound1_1(refs){
  const area = refs.area;
  // Wipe any previous-round elements
  area.querySelectorAll('.platform, .deco-platform, .finish-platform, .pit, .coin, .enemy, .obstacle').forEach(el => el.remove());

  const SPACING = 1430;
  const FIRST_X = 1000;

  // Build 8 question platforms
  G.platforms = [];
  for(let i=0; i<8; i++){
    const worldX = FIRST_X + i * SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = 'SOURCE ' + (i+1);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({ el, lbl, worldX, idx:i, cleared:false, armed:true, width:80, height:120 });
  }

  // Finish: Civil War review-stand grandstand (red-white-blue bunting)
  const fEl = document.createElement('div');
  fEl.className = 'finish-platform';
  fEl.innerHTML = `
    <div class="fp-post-l"></div>
    <div class="fp-post-r"></div>
    <div class="fp-bar"></div>
    <div class="fp-banner">FINISH</div>
    <div class="fp-bunting">
      <div class="swag red"></div>
      <div class="swag white"></div>
      <div class="swag blue"></div>
      <div class="swag white"></div>
      <div class="swag red"></div>
    </div>
    <div class="fp-base"></div>
  `;
  area.appendChild(fEl);
  G.finishPlatform = { el:fEl, worldX: FINISH - 200, width:120, height:170 };

  // Pits — 2 between question platforms
  G.pits = [
    { worldX: FIRST_X + SPACING * 2 + 600, width: 90 },   // between platforms 3 and 4
    { worldX: FIRST_X + SPACING * 5 + 600, width: 110 },  // between platforms 6 and 7
  ];
  G.pits.forEach(pit => {
    const el = document.createElement('div');
    el.className = 'pit';
    el.style.width = pit.width + 'px';
    area.appendChild(el);
    pit.el = el;
  });

  // ── Deco platforms (NOT question platforms, just stepping stones) ──
  // These give vertical variety: high-route coin trails, jump challenges,
  // optional climbs that reward exploration.
  G.decoPlatforms = [];
  const decoSpec = [
    // Low stepping stone before first sentry
    { worldX: FIRST_X + SPACING * 0 + 700,  width: 80, height: 30, bottomOffset: 40 },
    // Mid-air pair (high-route option) over sentry zone 1
    { worldX: FIRST_X + SPACING * 1 + 280,  width: 80, height: 24, bottomOffset: 110 },
    { worldX: FIRST_X + SPACING * 1 + 480,  width: 80, height: 24, bottomOffset: 130 },
    { worldX: FIRST_X + SPACING * 1 + 680,  width: 80, height: 24, bottomOffset: 110 },
    // Stepping stones over the first pit
    { worldX: FIRST_X + SPACING * 2 + 580,  width: 50, height: 22, bottomOffset: 60 },
    { worldX: FIRST_X + SPACING * 2 + 660,  width: 50, height: 22, bottomOffset: 60 },
    // Tall block to vault over sentry zone 2
    { worldX: FIRST_X + SPACING * 3 + 600,  width: 70, height: 56, bottomOffset: 0 },
    // High-air bonus path (rooftop section)
    { worldX: FIRST_X + SPACING * 4 + 350,  width: 90, height: 24, bottomOffset: 130 },
    { worldX: FIRST_X + SPACING * 4 + 600,  width: 90, height: 24, bottomOffset: 170 },
    { worldX: FIRST_X + SPACING * 4 + 850,  width: 90, height: 24, bottomOffset: 130 },
    // Stepping stones over the second (wider) pit
    { worldX: FIRST_X + SPACING * 5 + 560,  width: 50, height: 22, bottomOffset: 70 },
    { worldX: FIRST_X + SPACING * 5 + 650,  width: 50, height: 22, bottomOffset: 90 },
    { worldX: FIRST_X + SPACING * 5 + 740,  width: 50, height: 22, bottomOffset: 70 },
    // Final approach: zigzag jump challenge
    { worldX: FIRST_X + SPACING * 6 + 400,  width: 70, height: 24, bottomOffset: 100 },
    { worldX: FIRST_X + SPACING * 6 + 620,  width: 70, height: 24, bottomOffset: 140 },
    { worldX: FIRST_X + SPACING * 6 + 840,  width: 70, height: 24, bottomOffset: 100 },
  ];
  decoSpec.forEach(d => {
    const el = document.createElement('div');
    el.className = 'deco-platform';
    el.style.width = d.width + 'px';
    el.style.height = d.height + 'px';
    el.style.bottom = (GROUND_HEIGHT + d.bottomOffset) + 'px';
    area.appendChild(el);
    G.decoPlatforms.push({ el, worldX: d.worldX, width: d.width, height: d.height, bottomOffset: d.bottomOffset });
  });

  // ── Sentries that RESPECT pit boundaries ──
  // Each patrol range is checked against pits; if a pit overlaps, the
  // patrol shrinks to stay on solid ground. This stops sentries from
  // walking impossibly across gaps.
  G.enemies = [];
  const rawSentries = [
    { worldX: FIRST_X + SPACING * 1 + 400, patrolMin: FIRST_X + SPACING * 1 + 250, patrolMax: FIRST_X + SPACING * 1 + 750, vx: -1.2 },
    { worldX: FIRST_X + SPACING * 3 + 500, patrolMin: FIRST_X + SPACING * 3 + 350, patrolMax: FIRST_X + SPACING * 3 + 850, vx: -1.4 },
    { worldX: FIRST_X + SPACING * 5 + 350, patrolMin: FIRST_X + SPACING * 5 + 200, patrolMax: FIRST_X + SPACING * 5 + 540, vx: -1.5 }, // shrunk: pit at +600
    { worldX: FIRST_X + SPACING * 6 + 400, patrolMin: FIRST_X + SPACING * 6 + 250, patrolMax: FIRST_X + SPACING * 6 + 700, vx: -1.6 }, // late-level
  ];
  // Snap any patrol range that would cross a pit (uses global clampPatrolToPits)
  rawSentries.forEach(sp => {
    const clamped = clampPatrolToPits(sp);
    const el = document.createElement('div');
    el.className = 'enemy sentry';
    el.innerHTML = SENTRY_SVG;
    area.appendChild(el);
    G.enemies.push({
      el, type:'sentry',
      worldX: clamped.worldX, vx: clamped.vx,
      patrolMin: clamped.patrolMin, patrolMax: clamped.patrolMax,
      dead:false,
    });
  });

  // ── Obstacles: spikes (lethal) and bigblocks (stand-on-able) ──
  // Spikes force jump timing. Bigblocks are alternate jump platforms
  // that also block sentries' patrol path (visual variety).
  G.obstacles = [];
  const obstacleSpec = [
    // Section 1: introduce spikes alone (no enemy)
    { type:'spike',    worldX: FIRST_X + SPACING * 0 + 950 },
    // Section 2: spike + sentry combo (jump or get caught both ways)
    { type:'spike',    worldX: FIRST_X + SPACING * 1 + 920 },
    // Section 3 approach: pair of spikes to clear before pit
    { type:'spike',    worldX: FIRST_X + SPACING * 2 + 350 },
    { type:'spike',    worldX: FIRST_X + SPACING * 2 + 410 },
    // Section 4: bigblock as a "vault" before sentry 2
    { type:'bigblock', worldX: FIRST_X + SPACING * 3 + 200 },
    // Section 4 follow-up: spike right after bigblock — must time the dismount
    { type:'spike',    worldX: FIRST_X + SPACING * 3 + 950 },
    // Section 5: 3-spike obstacle line in the rooftop section's ground path
    { type:'spike',    worldX: FIRST_X + SPACING * 4 + 700 },
    { type:'spike',    worldX: FIRST_X + SPACING * 4 + 760 },
    { type:'spike',    worldX: FIRST_X + SPACING * 4 + 820 },
    // Section 6: bigblock + spike combo
    { type:'bigblock', worldX: FIRST_X + SPACING * 5 + 250 },
    { type:'spike',    worldX: FIRST_X + SPACING * 5 + 380 },
    // Section 7: late-level spike pair after sentry 4
    { type:'spike',    worldX: FIRST_X + SPACING * 6 + 1000 },
    { type:'spike',    worldX: FIRST_X + SPACING * 6 + 1060 },
  ];
  // Clamp obstacles away from pits so they don't appear inside the gap
  obstacleSpec.forEach(o => {
    const conflictsPit = G.pits.some(p => o.worldX > p.worldX - 40 && o.worldX < p.worldX + p.width + 40);
    if(conflictsPit) return;
    const el = document.createElement('div');
    el.className = 'obstacle ' + o.type;
    area.appendChild(el);
    const w = o.type === 'spike' ? 34 : 54;
    const h = o.type === 'spike' ? 42 : 52;
    G.obstacles.push({ el, type: o.type, worldX: o.worldX, width: w, height: h });
  });

  // ── Coins: ground-level trails AND air-trail bonus paths ──
  G.coins = [];
  const coinSpots = [];

  // Ground-level coin trails between question platforms (existing)
  for(let i=0; i<7; i++){
    const baseX = FIRST_X + i * SPACING + 750;
    coinSpots.push({worldX: baseX,       y: 60});
    coinSpots.push({worldX: baseX + 28,  y: 60});
    coinSpots.push({worldX: baseX + 56,  y: 60});
  }

  // Air coins above sentry zone 1 — reward students who take the high jump path
  for(let i=0; i<3; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 1 + 320 + i * 200, y: 150});
  }

  // Rooftop bonus row — high air coins above section 4-5 (worth 30 if you grab them all)
  for(let i=0; i<5; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 4 + 380 + i * 130, y: 180});
  }

  // Coin trail along the zigzag deco at end of level
  coinSpots.push({worldX: FIRST_X + SPACING * 6 + 425, y: 130});
  coinSpots.push({worldX: FIRST_X + SPACING * 6 + 645, y: 170});
  coinSpots.push({worldX: FIRST_X + SPACING * 6 + 865, y: 130});

  coinSpots.forEach(c => {
    // Skip if a coin would overlap a pit (don't dangle coins over pits)
    if(G.pits.some(p => c.worldX > p.worldX - 30 && c.worldX < p.worldX + p.width + 30)) return;
    const el = document.createElement('div');
    el.className = 'coin gold-seal';
    area.appendChild(el);
    G.coins.push({ el, worldX: c.worldX, y: c.y, collected: false });
  });

  // Build clouds (visual only)
  refs.skyClouds.innerHTML = '';
  for(let i=0; i<5; i++){
    const c = document.createElement('div');
    c.className = 'cloud';
    const w = 40 + Math.random() * 60;
    c.style.width = w + 'px';
    c.style.height = (w * 0.45) + 'px';
    c.style.left = (10 + Math.random() * 80) + '%';
    c.style.top = (5 + Math.random() * 35) + '%';
    refs.skyClouds.appendChild(c);
  }
}

// ════════════════════════════════════════════════════════════════
// ROUND 1-2 — Brother Against Brother (battlefield + cannons)
// Adds cannons (stationary, fire slow projectiles) on top of sentries.
// Battlefield-themed visuals: gray sky, smoke clouds, torn ground.
// Slightly fewer sentries (4 → 2) since cannons provide the new pacing.
// ════════════════════════════════════════════════════════════════
function buildRound1_2(refs){
  const area = refs.area;
  // Wipe any previous-round elements (including cannons & cannonballs)
  area.querySelectorAll('.platform, .deco-platform, .finish-platform, .pit, .coin, .enemy, .obstacle, .cannon, .cannonball, .cannonball-trail, .cannon-flash').forEach(el => el.remove());

  // Switch to battlefield theme (CSS class on the game-area)
  area.classList.add('theme-battlefield');

  const SPACING = 1430;
  const FIRST_X = 1000;

  // Build 8 question platforms (same structure as 1-1)
  G.platforms = [];
  for(let i=0; i<8; i++){
    const worldX = FIRST_X + i * SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = 'SOURCE ' + (i+1);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({ el, lbl, worldX, idx:i, cleared:false, armed:true, width:80, height:120 });
  }

  // Finish: same grandstand
  const fEl = document.createElement('div');
  fEl.className = 'finish-platform';
  fEl.innerHTML = `
    <div class="fp-post-l"></div>
    <div class="fp-post-r"></div>
    <div class="fp-bar"></div>
    <div class="fp-banner">FINISH</div>
    <div class="fp-bunting">
      <div class="swag red"></div>
      <div class="swag white"></div>
      <div class="swag blue"></div>
      <div class="swag white"></div>
      <div class="swag red"></div>
    </div>
    <div class="fp-base"></div>
  `;
  area.appendChild(fEl);
  G.finishPlatform = { el:fEl, worldX: FINISH - 200, width:120, height:170 };

  // ONE pit (1-1 had 2). Cannons add their own pacing.
  G.pits = [
    { worldX: FIRST_X + SPACING * 4 + 600, width: 100 },
  ];
  G.pits.forEach(pit => {
    const el = document.createElement('div');
    el.className = 'pit';
    el.style.width = pit.width + 'px';
    area.appendChild(el);
    pit.el = el;
  });

  // Deco platforms (similar to 1-1 but fewer high paths since cannons fly horizontally)
  G.decoPlatforms = [];
  const decoSpec = [
    { worldX: FIRST_X + SPACING * 0 + 700,  width: 80, height: 30, bottomOffset: 40 },
    { worldX: FIRST_X + SPACING * 1 + 350,  width: 80, height: 24, bottomOffset: 110 },
    { worldX: FIRST_X + SPACING * 1 + 600,  width: 80, height: 24, bottomOffset: 110 },
    { worldX: FIRST_X + SPACING * 2 + 480,  width: 70, height: 24, bottomOffset: 90 },
    { worldX: FIRST_X + SPACING * 3 + 350,  width: 90, height: 24, bottomOffset: 100 },
    { worldX: FIRST_X + SPACING * 3 + 600,  width: 90, height: 24, bottomOffset: 100 },
    // Stepping stones over the pit
    { worldX: FIRST_X + SPACING * 4 + 550,  width: 50, height: 22, bottomOffset: 70 },
    { worldX: FIRST_X + SPACING * 4 + 640,  width: 50, height: 22, bottomOffset: 90 },
    { worldX: FIRST_X + SPACING * 4 + 730,  width: 50, height: 22, bottomOffset: 70 },
    // Late-level high path
    { worldX: FIRST_X + SPACING * 6 + 500,  width: 80, height: 24, bottomOffset: 130 },
    { worldX: FIRST_X + SPACING * 6 + 750,  width: 80, height: 24, bottomOffset: 130 },
  ];
  decoSpec.forEach(d => {
    const el = document.createElement('div');
    el.className = 'deco-platform';
    el.style.width = d.width + 'px';
    el.style.height = d.height + 'px';
    el.style.bottom = (GROUND_HEIGHT + d.bottomOffset) + 'px';
    area.appendChild(el);
    G.decoPlatforms.push({ el, worldX: d.worldX, width: d.width, height: d.height, bottomOffset: d.bottomOffset });
  });

  // ── Sentries: 2 (down from 4 in 1-1) ──
  G.enemies = [];
  const rawSentries = [
    { worldX: FIRST_X + SPACING * 1 + 850, patrolMin: FIRST_X + SPACING * 1 + 700, patrolMax: FIRST_X + SPACING * 1 + 1100, vx: -1.3 },
    // Mid-level (was empty between platforms 4 and 5)
    { worldX: FIRST_X + SPACING * 3 + 700, patrolMin: FIRST_X + SPACING * 3 + 550, patrolMax: FIRST_X + SPACING * 3 + 870, vx: -1.4 },
    { worldX: FIRST_X + SPACING * 5 + 400, patrolMin: FIRST_X + SPACING * 5 + 300, patrolMax: FIRST_X + SPACING * 5 + 700, vx: -1.5 },
    // Late-level (was empty between platforms 7 and 8)
    { worldX: FIRST_X + SPACING * 7 + 400, patrolMin: FIRST_X + SPACING * 7 + 300, patrolMax: FIRST_X + SPACING * 7 + 700, vx: -1.6 },
  ];
  rawSentries.forEach(sp => {
    const clamped = clampPatrolToPits(sp);
    const el = document.createElement('div');
    el.className = 'enemy sentry';
    el.innerHTML = SENTRY_SVG;
    area.appendChild(el);
    G.enemies.push({
      el, type:'sentry',
      worldX: clamped.worldX, vx: clamped.vx,
      patrolMin: clamped.patrolMin, patrolMax: clamped.patrolMax,
      dead:false,
    });
  });

  // ── CANNONS: stationary, fire slow projectiles toward the player ──
  // Two cannons spaced through the level. Each fires every 3.0s.
  // Player must time jumps over the cannonballs OR get past the firing
  // zone before the next shot. The first cannon is placed AFTER platform 2
  // so the player has time to learn the mechanic.
  G.cannons = [];
  const cannonSpec = [
    // Cannon 1 (after platform 3): always-low cannonballs. Players learn "jump over."
    { worldX: FIRST_X + SPACING * 2 + 950, cooldown: 3000, nextFire: 1500, pattern: 'low' },
    // Cannon 2 (after platform 7): alternates low/high. Introduces the duck mechanic.
    { worldX: FIRST_X + SPACING * 6 + 200, cooldown: 2700, nextFire: 1000, pattern: 'alternate' },
  ];
  cannonSpec.forEach(c => {
    const el = document.createElement('div');
    el.className = 'cannon';
    el.innerHTML = CANNON_SVG;
    area.appendChild(el);
    G.cannons.push({
      el,
      worldX: c.worldX,
      cooldown: c.cooldown,         // ms between shots
      pattern: c.pattern || 'low',
      shotIndex: 0,
      lastFireAt: Date.now() - c.cooldown + c.nextFire, // first shot delay
    });
  });

  // ── Obstacles: more spike clusters in the battlefield ──
  G.obstacles = [];
  const obstacleSpec = [
    { type:'spike',    worldX: FIRST_X + SPACING * 0 + 950 },
    { type:'spike',    worldX: FIRST_X + SPACING * 1 + 1100 },
    { type:'spike',    worldX: FIRST_X + SPACING * 2 + 350 },
    { type:'spike',    worldX: FIRST_X + SPACING * 2 + 410 },
    { type:'spike',    worldX: FIRST_X + SPACING * 2 + 470 },
    { type:'bigblock', worldX: FIRST_X + SPACING * 3 + 950 }, // Earthwork before pit
    { type:'spike',    worldX: FIRST_X + SPACING * 5 + 850 },
    { type:'spike',    worldX: FIRST_X + SPACING * 5 + 910 },
    { type:'bigblock', worldX: FIRST_X + SPACING * 6 + 350 }, // Cover from cannon 2
    { type:'spike',    worldX: FIRST_X + SPACING * 7 + 200 },
    { type:'spike',    worldX: FIRST_X + SPACING * 7 + 260 },
  ];
  obstacleSpec.forEach(o => {
    const conflictsPit = G.pits.some(p => o.worldX > p.worldX - 40 && o.worldX < p.worldX + p.width + 40);
    if(conflictsPit) return;
    const el = document.createElement('div');
    el.className = 'obstacle ' + o.type;
    area.appendChild(el);
    const w = o.type === 'spike' ? 34 : 54;
    const h = o.type === 'spike' ? 42 : 52;
    G.obstacles.push({ el, type: o.type, worldX: o.worldX, width: w, height: h });
  });

  // ── Coins ──
  G.coins = [];
  const coinSpots = [];
  // Ground-level coin trails
  for(let i=0; i<7; i++){
    const baseX = FIRST_X + i * SPACING + 750;
    coinSpots.push({worldX: baseX,       y: 60});
    coinSpots.push({worldX: baseX + 28,  y: 60});
    coinSpots.push({worldX: baseX + 56,  y: 60});
  }
  // Air coins above the deco platforms
  for(let i=0; i<3; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 1 + 380 + i * 110, y: 150});
  }
  // Late-level high path bonus coins (rewards taking the late deco platforms)
  for(let i=0; i<4; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 6 + 530 + i * 75, y: 165});
  }
  coinSpots.forEach(c => {
    if(G.pits.some(p => c.worldX > p.worldX - 30 && c.worldX < p.worldX + p.width + 30)) return;
    const el = document.createElement('div');
    el.className = 'coin gold-seal';
    area.appendChild(el);
    G.coins.push({ el, worldX: c.worldX, y: c.y, collected: false });
  });

  // Build smoke clouds (battlefield style — gray, more of them, lower in sky)
  refs.skyClouds.innerHTML = '';
  for(let i=0; i<7; i++){
    const c = document.createElement('div');
    c.className = 'cloud';
    const w = 50 + Math.random() * 80;
    c.style.width = w + 'px';
    c.style.height = (w * 0.55) + 'px';
    c.style.left = (5 + Math.random() * 90) + '%';
    c.style.top = (8 + Math.random() * 40) + '%';
    refs.skyClouds.appendChild(c);
  }
}

// ════════════════════════════════════════════════════════════════
// ROUND 1-3 — Rebuilding the Union (post-war town + falling debris)
// Adds falling debris from burned freedmen's schools — vertical hazard
// that drops from above when the player crosses a trigger zone.
// Carries forward sentries + cannons from previous rounds.
// ════════════════════════════════════════════════════════════════
function buildRound1_3(refs){
  const area = refs.area;
  area.querySelectorAll('.platform, .deco-platform, .finish-platform, .pit, .coin, .enemy, .obstacle, .cannon, .cannonball, .cannonball-trail, .cannon-flash, .debris, .debris-warning').forEach(el => el.remove());

  area.classList.add('theme-postwar');

  const SPACING = 1430;
  const FIRST_X = 1000;

  // 8 question platforms
  G.platforms = [];
  for(let i=0; i<8; i++){
    const worldX = FIRST_X + i * SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = 'SOURCE ' + (i+1);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({ el, lbl, worldX, idx:i, cleared:false, armed:true, width:80, height:120 });
  }

  // Finish: same grandstand
  const fEl = document.createElement('div');
  fEl.className = 'finish-platform';
  fEl.innerHTML = `
    <div class="fp-post-l"></div><div class="fp-post-r"></div><div class="fp-bar"></div>
    <div class="fp-banner">FINISH</div>
    <div class="fp-bunting">
      <div class="swag red"></div><div class="swag white"></div><div class="swag blue"></div>
      <div class="swag white"></div><div class="swag red"></div>
    </div>
    <div class="fp-base"></div>
  `;
  area.appendChild(fEl);
  G.finishPlatform = { el:fEl, worldX: FINISH - 200, width:120, height:170 };

  // ── Pits: 4 of them with varied character for real platforming texture ──
  // Pit 1: narrow (single-jump clear, intro)
  // Pit 2: medium with 2 stepping stones at varying heights (timing rhythm)
  // Pit 3: wide with 3 stones (multi-jump sequence)
  // Pit 4: moat (no stones, late-level commitment jump)
  G.pits = [
    { worldX: FIRST_X + SPACING * 2 + 1100, width: 70  },  // Narrow — just send it
    { worldX: FIRST_X + SPACING * 4 + 700,  width: 130 },  // Medium with stones
    { worldX: FIRST_X + SPACING * 5 + 1100, width: 170 },  // Wide rhythm pit
    { worldX: FIRST_X + SPACING * 7 + 200,  width: 180 },  // Moat — no help
  ];
  G.pits.forEach(pit => {
    const el = document.createElement('div');
    el.className = 'pit';
    el.style.width = pit.width + 'px';
    area.appendChild(el);
    pit.el = el;
  });

  // Deco platforms: stepping stones over pits + vertical bonus paths.
  // Pit 2 stones form a flat bridge (3 wide stones at the same height,
  // first/last near the pit edges so the player can step onto them).
  // Pit 3 stones zigzag in height (rhythm pit).
  // Pit 4 has none (commitment jump).
  G.decoPlatforms = [];
  const decoSpec = [
    // General-purpose decos for vertical exploration / debris dodging
    { worldX: FIRST_X + SPACING * 0 + 700,  width: 80, height: 30, bottomOffset: 40 },
    { worldX: FIRST_X + SPACING * 1 + 350,  width: 70, height: 24, bottomOffset: 100 },
    { worldX: FIRST_X + SPACING * 2 + 500,  width: 70, height: 24, bottomOffset: 100 },
    { worldX: FIRST_X + SPACING * 3 + 400,  width: 90, height: 24, bottomOffset: 130 },
    // Pit 2 stones (medium pit, 700..830). 3 wide flat stones forming
    // a bridge: first stone overlaps the left edge so player can step on,
    // last overlaps the right edge so they can step off.
    { worldX: FIRST_X + SPACING * 4 + 695,  width: 60, height: 30, bottomOffset: 30 },
    { worldX: FIRST_X + SPACING * 4 + 760,  width: 60, height: 30, bottomOffset: 30 },
    { worldX: FIRST_X + SPACING * 4 + 825,  width: 60, height: 30, bottomOffset: 30 },
    // Bonus high-air rest stop after pit 2
    { worldX: FIRST_X + SPACING * 5 + 350,  width: 80, height: 24, bottomOffset: 110 },
    // Pit 3 stones (wide 170px pit at 1100..1270). 3 wider stones with
    // zigzag heights — rhythm jumping. Same near-edge placement.
    { worldX: FIRST_X + SPACING * 5 + 1095, width: 60, height: 26, bottomOffset: 50  },
    { worldX: FIRST_X + SPACING * 5 + 1160, width: 60, height: 26, bottomOffset: 90  },
    { worldX: FIRST_X + SPACING * 5 + 1225, width: 60, height: 26, bottomOffset: 50  },
    // Late-level high path
    { worldX: FIRST_X + SPACING * 6 + 500,  width: 70, height: 24, bottomOffset: 100 },
    // Approach to pit 4 — a high diving board to launch from
    { worldX: FIRST_X + SPACING * 7 + 100,  width: 80, height: 24, bottomOffset: 50 },
  ];
  decoSpec.forEach(d => {
    const el = document.createElement('div');
    el.className = 'deco-platform';
    el.style.width = d.width + 'px';
    el.style.height = d.height + 'px';
    el.style.bottom = (GROUND_HEIGHT + d.bottomOffset) + 'px';
    area.appendChild(el);
    G.decoPlatforms.push({ el, worldX: d.worldX, width: d.width, height: d.height, bottomOffset: d.bottomOffset });
  });

  // Sentries (carried from previous rounds)
  G.enemies = [];
  const rawSentries = [
    { worldX: FIRST_X + SPACING * 1 + 850, patrolMin: FIRST_X + SPACING * 1 + 700, patrolMax: FIRST_X + SPACING * 1 + 1100, vx: -1.4 },
    { worldX: FIRST_X + SPACING * 5 + 800, patrolMin: FIRST_X + SPACING * 5 + 650, patrolMax: FIRST_X + SPACING * 5 + 1050, vx: -1.5 },
    { worldX: FIRST_X + SPACING * 7 + 350, patrolMin: FIRST_X + SPACING * 7 + 250, patrolMax: FIRST_X + SPACING * 7 + 600, vx: -1.6 },
  ];
  rawSentries.forEach(sp => {
    const clamped = clampPatrolToPits(sp);
    const el = document.createElement('div');
    el.className = 'enemy sentry';
    el.innerHTML = SENTRY_SVG;
    area.appendChild(el);
    G.enemies.push({
      el, type:'sentry',
      worldX: clamped.worldX, vx: clamped.vx,
      patrolMin: clamped.patrolMin, patrolMax: clamped.patrolMax,
      dead:false,
    });
  });

  // Cannons (1, alternating low/high — keeps pressure but doesn't dominate
  // since the new mechanic is debris)
  G.cannons = [];
  const cannonSpec = [
    { worldX: FIRST_X + SPACING * 2 + 1000, cooldown: 3200, nextFire: 1500, pattern: 'alternate' },
  ];
  cannonSpec.forEach(c => {
    const el = document.createElement('div');
    el.className = 'cannon';
    el.innerHTML = CANNON_SVG;
    area.appendChild(el);
    G.cannons.push({
      el, worldX: c.worldX, cooldown: c.cooldown,
      pattern: c.pattern || 'low', shotIndex: 0,
      lastFireAt: Date.now() - c.cooldown + c.nextFire,
    });
  });

  // ── DEBRIS DROP ZONES ──
  // Each zone has a triggerX (player x that arms the drop) and a landX
  // (where the debris falls). When the player crosses triggerX, the
  // debris spawns above landX, falls with gravity, and stays as
  // wreckage when it hits the ground.
  // landX should be ~120-180px past triggerX so the player has a
  // reaction window — they see the warning shadow & falling debris
  // and can choose to slow, stop, or jump-clear.
  // ── Falling debris zones ──
  // Each zone has a baseLandX (the nominal impact point) and a random
  // ±jitter applied at trigger time. So replays don't memorize "always
  // jump at platform 4" — the impact location varies by ±200px each run.
  // Trigger-to-land gap stays ~280px nominal, giving ~530ms of warning.
  G.debris = [];
  const debrisSpec = [
    { triggerX: FIRST_X + SPACING * 1 + 0,    baseLandX: FIRST_X + SPACING * 1 + 280  },
    { triggerX: FIRST_X + SPACING * 3 + 200,  baseLandX: FIRST_X + SPACING * 3 + 480  },
    { triggerX: FIRST_X + SPACING * 5 + 400,  baseLandX: FIRST_X + SPACING * 5 + 700  },
    { triggerX: FIRST_X + SPACING * 6 + 700,  baseLandX: FIRST_X + SPACING * 6 + 980  },
    { triggerX: FIRST_X + SPACING * 7 + 800,  baseLandX: FIRST_X + SPACING * 7 + 1080 },
  ];
  debrisSpec.forEach(d => {
    G.debris.push({
      triggerX: d.triggerX,
      baseLandX: d.baseLandX,    // nominal impact (jittered when armed)
      landX: d.baseLandX,         // actual impact this run (set on arm)
      armed: false,
      falling: false,
      landed: false,
      el: null,
      warningEl: null,
      y: 0,
      velocity: 0,
    });
  });

  // Obstacles
  G.obstacles = [];
  const obstacleSpec = [
    { type:'spike',    worldX: FIRST_X + SPACING * 0 + 950 },
    { type:'spike',    worldX: FIRST_X + SPACING * 1 + 1100 },
    { type:'bigblock', worldX: FIRST_X + SPACING * 2 + 200 },
    { type:'spike',    worldX: FIRST_X + SPACING * 4 + 200 },
    { type:'spike',    worldX: FIRST_X + SPACING * 4 + 260 },
    { type:'bigblock', worldX: FIRST_X + SPACING * 6 + 200 },
    { type:'spike',    worldX: FIRST_X + SPACING * 7 + 1000 },
  ];
  obstacleSpec.forEach(o => {
    const conflictsPit = G.pits.some(p => o.worldX > p.worldX - 40 && o.worldX < p.worldX + p.width + 40);
    if(conflictsPit) return;
    const el = document.createElement('div');
    el.className = 'obstacle ' + o.type;
    area.appendChild(el);
    const w = o.type === 'spike' ? 34 : 54;
    const h = o.type === 'spike' ? 42 : 52;
    G.obstacles.push({ el, type: o.type, worldX: o.worldX, width: w, height: h });
  });

  // Coins
  G.coins = [];
  const coinSpots = [];
  for(let i=0; i<7; i++){
    const baseX = FIRST_X + i * SPACING + 750;
    coinSpots.push({worldX: baseX,       y: 60});
    coinSpots.push({worldX: baseX + 28,  y: 60});
    coinSpots.push({worldX: baseX + 56,  y: 60});
  }
  // Air coins on the deco platforms
  for(let i=0; i<3; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 1 + 380 + i * 100, y: 140});
  }
  for(let i=0; i<3; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 3 + 400 + i * 100, y: 170});
  }
  for(let i=0; i<3; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 7 + 470 + i * 100, y: 170});
  }
  coinSpots.forEach(c => {
    if(G.pits.some(p => c.worldX > p.worldX - 30 && c.worldX < p.worldX + p.width + 30)) return;
    const el = document.createElement('div');
    el.className = 'coin gold-seal';
    area.appendChild(el);
    G.coins.push({ el, worldX: c.worldX, y: c.y, collected: false });
  });

  // Smoke clouds (post-war atmosphere)
  refs.skyClouds.innerHTML = '';
  for(let i=0; i<6; i++){
    const c = document.createElement('div');
    c.className = 'cloud';
    const w = 50 + Math.random() * 70;
    c.style.width = w + 'px';
    c.style.height = (w * 0.5) + 'px';
    c.style.left = (5 + Math.random() * 90) + '%';
    c.style.top = (8 + Math.random() * 35) + '%';
    refs.skyClouds.appendChild(c);
  }
}

// ════════════════════════════════════════════════════════════════
// ROUND 1-4 CASTLE — The Reckoning (Compromise of 1877)
// All previous mechanics + redeemer politicians (respawning patrol)
// + Civil War general boss (3-stomp health bar) gating the finish.
// 10 question platforms instead of 8. Streak rewards disabled.
// ════════════════════════════════════════════════════════════════
function buildRound1_4_castle(refs){
  const area = refs.area;
  area.querySelectorAll('.platform, .deco-platform, .finish-platform, .castle-finish, .pit, .coin, .enemy, .obstacle, .cannon, .cannonball, .cannonball-trail, .cannon-flash, .debris, .debris-warning, .boss-health, .boss-shadow').forEach(el => el.remove());

  area.classList.add('theme-castle');

  // Tighter spacing for 10 platforms within the same world length,
  // leaving ~1900px after platform 10 for boss + finish gate.
  const SPACING = 1080;
  const FIRST_X = 900;

  // 10 question platforms
  G.platforms = [];
  for(let i=0; i<10; i++){
    const worldX = FIRST_X + i * SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = 'SOURCE ' + (i+1);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({ el, lbl, worldX, idx:i, cleared:false, armed:true, width:80, height:120 });
  }

  // Castle finish gate (replaces grandstand). Visually gated until boss
  // is defeated — chain barrier visible across the arch.
  const fEl = document.createElement('div');
  fEl.className = 'castle-finish';
  fEl.innerHTML = `
    <div class="cf-pole"></div>
    <div class="cf-flag"></div>
    <div class="cf-arch"></div>
    <div class="cf-banner">CASTLE</div>
    <div class="cf-chains"></div>
  `;
  area.appendChild(fEl);
  G.finishPlatform = { el:fEl, worldX: FINISH - 200, width:140, height:200 };
  G.finishGated = true; // can't finish until boss defeated

  // Pits — same 4-pit character as 1-3 but at new platform positions.
  // Pit 1 narrow, Pit 2 medium with stones, Pit 3 wide rhythm, Pit 4 moat.
  G.pits = [
    { worldX: FIRST_X + SPACING * 2 + 750, width: 70  },
    { worldX: FIRST_X + SPACING * 5 + 500, width: 130 },
    { worldX: FIRST_X + SPACING * 7 + 400, width: 170 },
    { worldX: FIRST_X + SPACING * 9 + 200, width: 180 },
  ];
  G.pits.forEach(pit => {
    const el = document.createElement('div');
    el.className = 'pit';
    el.style.width = pit.width + 'px';
    area.appendChild(el);
    pit.el = el;
  });

  // Deco platforms with stepping-stone bridges over pits 2 & 3,
  // diving board before pit 4 (moat).
  G.decoPlatforms = [];
  const decoSpec = [
    { worldX: FIRST_X + SPACING * 0 + 500,  width: 70, height: 24, bottomOffset: 90  },
    { worldX: FIRST_X + SPACING * 1 + 350,  width: 70, height: 24, bottomOffset: 110 },
    { worldX: FIRST_X + SPACING * 3 + 400,  width: 80, height: 24, bottomOffset: 130 },
    { worldX: FIRST_X + SPACING * 4 + 350,  width: 70, height: 24, bottomOffset: 100 },
    // Pit 2 stones (medium pit, 500..630). Flat bridge.
    { worldX: FIRST_X + SPACING * 5 + 495,  width: 60, height: 30, bottomOffset: 30 },
    { worldX: FIRST_X + SPACING * 5 + 560,  width: 60, height: 30, bottomOffset: 30 },
    { worldX: FIRST_X + SPACING * 5 + 625,  width: 60, height: 30, bottomOffset: 30 },
    // Bonus rest stop
    { worldX: FIRST_X + SPACING * 6 + 350,  width: 80, height: 24, bottomOffset: 110 },
    // Pit 3 stones (wide 170px pit, 400..570). Zigzag rhythm.
    { worldX: FIRST_X + SPACING * 7 + 395, width: 60, height: 26, bottomOffset: 50 },
    { worldX: FIRST_X + SPACING * 7 + 460, width: 60, height: 26, bottomOffset: 90 },
    { worldX: FIRST_X + SPACING * 7 + 525, width: 60, height: 26, bottomOffset: 50 },
    // Approach to pit 4 — diving board
    { worldX: FIRST_X + SPACING * 9 + 100,  width: 80, height: 24, bottomOffset: 50  },
  ];
  decoSpec.forEach(d => {
    const el = document.createElement('div');
    el.className = 'deco-platform';
    el.style.width = d.width + 'px';
    el.style.height = d.height + 'px';
    el.style.bottom = (GROUND_HEIGHT + d.bottomOffset) + 'px';
    area.appendChild(el);
    G.decoPlatforms.push({ el, worldX: d.worldX, width: d.width, height: d.height, bottomOffset: d.bottomOffset });
  });

  // ── Sentries (carried from 1-1) — 2 of them ──
  G.enemies = [];
  const rawSentries = [
    { worldX: FIRST_X + SPACING * 1 + 800, patrolMin: FIRST_X + SPACING * 1 + 700, patrolMax: FIRST_X + SPACING * 1 + 1000, vx: -1.5 },
    { worldX: FIRST_X + SPACING * 6 + 700, patrolMin: FIRST_X + SPACING * 6 + 600, patrolMax: FIRST_X + SPACING * 6 + 900,  vx: -1.6 },
  ];
  rawSentries.forEach(sp => {
    const clamped = clampPatrolToPits(sp);
    const el = document.createElement('div');
    el.className = 'enemy sentry';
    el.innerHTML = SENTRY_SVG;
    area.appendChild(el);
    G.enemies.push({
      el, type:'sentry',
      worldX: clamped.worldX, vx: clamped.vx,
      patrolMin: clamped.patrolMin, patrolMax: clamped.patrolMax,
      dead:false,
    });
  });

  // ── REDEEMER POLITICIANS (NEW) — 2 of them ──
  // Stompable but respawn after 3 seconds. Symbolizes political backlash
  // that you can momentarily push back but cannot permanently defeat.
  // Faster than sentries; require precise stomp timing.
  const rawRedeemers = [
    { worldX: FIRST_X + SPACING * 3 + 800, patrolMin: FIRST_X + SPACING * 3 + 700, patrolMax: FIRST_X + SPACING * 3 + 950, vx: -1.9 },
    { worldX: FIRST_X + SPACING * 8 + 600, patrolMin: FIRST_X + SPACING * 8 + 500, patrolMax: FIRST_X + SPACING * 8 + 800, vx: -2.0 },
  ];
  rawRedeemers.forEach(sp => {
    const clamped = clampPatrolToPits(sp);
    const el = document.createElement('div');
    el.className = 'enemy redeemer';
    el.innerHTML = REDEEMER_SVG;
    area.appendChild(el);
    G.enemies.push({
      el, type:'redeemer',
      worldX: clamped.worldX, vx: clamped.vx,
      originX: clamped.worldX,  // remembers spawn point for respawn
      originVx: clamped.vx,
      patrolMin: clamped.patrolMin, patrolMax: clamped.patrolMax,
      dead: false,
      respawnAt: 0,             // wall-clock time when next respawn fires
    });
  });

  // ── BOSS (NEW) — Civil War general at the end of the level ──
  // Patrols a long range just before the finish gate. Health = 3.
  // Each stomp drops health by 1 + brief stunned animation.
  // When health hits 0, boss is defeated and the finish gate unlocks.
  const bossWorldX = FIRST_X + SPACING * 9 + 1040; // v3: moved farther back so the final approach is a clean boss arena
  const bossEl = document.createElement('div');
  bossEl.className = 'enemy boss';
  bossEl.innerHTML = GENERAL_SVG;
  area.appendChild(bossEl);

  const healthEl = document.createElement('div');
  healthEl.className = 'boss-health';
  healthEl.innerHTML = `
    <div class="boss-health-label">RESISTANCE</div>
    <div class="boss-health-fill" id="bossHealthFill"></div>
  `;
  area.appendChild(healthEl);

  const bossShadow = document.createElement('div');
  bossShadow.className = 'boss-shadow';
  area.appendChild(bossShadow);

  G.boss = {
    el: bossEl,
    shadowEl: bossShadow,
    healthEl: healthEl,
    healthFill: healthEl.querySelector('.boss-health-fill'),
    worldX: bossWorldX,
    vx: -1.25,                             // v4: slower, more readable patrol
    patrolMin: bossWorldX - 95,
    patrolMax: bossWorldX + 95,
    y: 0,
    vy: 0,
    onGround: true,
    nextJumpAt: Date.now() + 3200,
    nextShotAt: Date.now() + 5200,
    shotIndex: 0,
    health: 3,
    maxHealth: 3,
    dead: false,
    invulnerableUntil: 0,                  // brief I-frames after stomp
  };
  G.bossDefeated = false;
  // Lock the camera in the final room so the boss stays on screen.
  // Player enters at the left side of the arena; boss remains around 760px.
  G.bossArenaStartX = bossWorldX - 640;
  G.bossArenaCameraX = bossWorldX - 760;
  G.bossArenaActive = false;

  // ── Cannons (carried from 1-2) — 2 alternating ──
  G.cannons = [];
  const cannonSpec = [
    { worldX: FIRST_X + SPACING * 2 + 200, cooldown: 3000, nextFire: 1500, pattern: 'alternate' },
    { worldX: FIRST_X + SPACING * 6 + 200, cooldown: 2700, nextFire: 1000, pattern: 'alternate' },
  ];
  cannonSpec.forEach(c => {
    const el = document.createElement('div');
    el.className = 'cannon';
    el.innerHTML = CANNON_SVG;
    area.appendChild(el);
    G.cannons.push({
      el, worldX: c.worldX, cooldown: c.cooldown,
      pattern: c.pattern || 'low', shotIndex: 0,
      lastFireAt: Date.now() - c.cooldown + c.nextFire,
    });
  });

  // ── Falling debris (carried from 1-3) — 4 zones ──
  // Castle round uses a wider trigger-to-land gap (380px vs 280) and a
  // tighter jitter range (±120 vs ±180). Castle SPACING is 1080 (vs 1430
  // in earlier rounds), so without these adjustments the debris hit
  // too consistently and felt impossible to dodge.
  G.debris = [];
  const debrisSpec = [
    { triggerX: FIRST_X + SPACING * 1 + 0,    baseLandX: FIRST_X + SPACING * 1 + 380,  jitterRange: 240 },
    { triggerX: FIRST_X + SPACING * 4 + 0,    baseLandX: FIRST_X + SPACING * 4 + 380,  jitterRange: 240 },
    { triggerX: FIRST_X + SPACING * 6 + 600,  baseLandX: FIRST_X + SPACING * 6 + 980,  jitterRange: 240 },
    { triggerX: FIRST_X + SPACING * 8 + 700,  baseLandX: FIRST_X + SPACING * 8 + 1080, jitterRange: 240 },
  ];
  debrisSpec.forEach(d => {
    G.debris.push({
      triggerX: d.triggerX, baseLandX: d.baseLandX, landX: d.baseLandX,
      jitterRange: d.jitterRange,
      armed: false, falling: false, landed: false,
      el: null, warningEl: null, y: 0, velocity: 0,
    });
  });

  // ── Obstacles (spikes + bigblocks) ──
  G.obstacles = [];
  const obstacleSpec = [
    { type:'spike',    worldX: FIRST_X + SPACING * 0 + 850 },
    { type:'spike',    worldX: FIRST_X + SPACING * 2 + 350 },
    { type:'spike',    worldX: FIRST_X + SPACING * 2 + 410 },
    { type:'bigblock', worldX: FIRST_X + SPACING * 3 + 200 },
    { type:'spike',    worldX: FIRST_X + SPACING * 4 + 800 },
    { type:'spike',    worldX: FIRST_X + SPACING * 4 + 860 },
    { type:'bigblock', worldX: FIRST_X + SPACING * 6 + 400 },
    { type:'spike',    worldX: FIRST_X + SPACING * 8 + 200 },
    { type:'spike',    worldX: FIRST_X + SPACING * 8 + 260 },
  ];
  obstacleSpec.forEach(o => {
    const conflictsPit = G.pits.some(p => o.worldX > p.worldX - 40 && o.worldX < p.worldX + p.width + 40);
    if(conflictsPit) return;
    const el = document.createElement('div');
    el.className = 'obstacle ' + o.type;
    area.appendChild(el);
    const w = o.type === 'spike' ? 34 : 54;
    const h = o.type === 'spike' ? 42 : 52;
    G.obstacles.push({ el, type: o.type, worldX: o.worldX, width: w, height: h });
  });

  // ── Coins ──
  G.coins = [];
  const coinSpots = [];
  for(let i=0; i<9; i++){
    const baseX = FIRST_X + i * SPACING + 600;
    coinSpots.push({worldX: baseX,       y: 60});
    coinSpots.push({worldX: baseX + 28,  y: 60});
    coinSpots.push({worldX: baseX + 56,  y: 60});
  }
  // Bonus coin paths up high
  for(let i=0; i<3; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 1 + 380 + i * 100, y: 150});
  }
  for(let i=0; i<3; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 3 + 430 + i * 100, y: 170});
  }
  for(let i=0; i<3; i++){
    coinSpots.push({worldX: FIRST_X + SPACING * 6 + 380 + i * 100, y: 150});
  }
  coinSpots.forEach(c => {
    if(G.pits.some(p => c.worldX > p.worldX - 30 && c.worldX < p.worldX + p.width + 30)) return;
    const el = document.createElement('div');
    el.className = 'coin gold-seal';
    area.appendChild(el);
    G.coins.push({ el, worldX: c.worldX, y: c.y, collected: false });
  });

  // Sparse menacing clouds
  refs.skyClouds.innerHTML = '';
  for(let i=0; i<5; i++){
    const c = document.createElement('div');
    c.className = 'cloud';
    const w = 60 + Math.random() * 100;
    c.style.width = w + 'px';
    c.style.height = (w * 0.4) + 'px';
    c.style.left = (5 + Math.random() * 90) + '%';
    c.style.top = (3 + Math.random() * 30) + '%';
    refs.skyClouds.appendChild(c);
  }
}

// ── Camera helper ───────────────────────────────────────────────
// Normal rounds keep the player at PLAYER_LEFT and scroll the world.
// In the castle boss arena, the camera locks so the boss stays visible
// and the player can move around the final room without pushing the boss
// off-screen.
function getCameraX(){
  if(!G) return 0;
  const playerWX = G.distance + PLAYER_LEFT;
  if(G.boss && !G.boss.dead && G.bossArenaStartX != null && playerWX >= G.bossArenaStartX){
    G.bossArenaActive = true;
    return G.bossArenaCameraX;
  }
  G.bossArenaActive = false;
  return G.distance;
}

// ── Visual update — apply world coordinates to screen ────────────
function updateWorldVisuals(refs){
  const cam = getCameraX();
  G.cameraX = cam;
  // Scrolling backgrounds
  const isGildedTheme = refs.area && Array.from(refs.area.classList).some(c => c.indexOf('theme-gilded') === 0);
  if(isGildedTheme){
    // World 2 comfort mode:
    // The floor is kept visually plain/solid, while the far skyline moves only a little.
    // This avoids both the old treadmill effect and the later "floor locked to the player" feeling.
    refs.parallaxFar.style.backgroundPositionX = (-cam * 0.045) + 'px';
    refs.parallaxMid.style.backgroundPositionX = (-cam * 0.10) + 'px';
    refs.ground.style.setProperty('--scrollX', '0px');
  } else {
    refs.parallaxFar.style.backgroundPositionX  = (-cam * 0.15) + 'px';
    refs.parallaxMid.style.backgroundPositionX  = (-cam * 0.35) + 'px';
    refs.ground.style.setProperty('--scrollX', (-cam * 0.7) + 'px');
  }

  // Platforms
  G.platforms.forEach(p => {
    p.el.style.left = (p.worldX - cam) + 'px';
  });
  // Deco platforms (stepping stones, vertical bonus paths)
  G.decoPlatforms.forEach(d => {
    d.el.style.left = (d.worldX - cam) + 'px';
  });
  // Obstacles (spikes, bigblocks)
  (G.obstacles || []).forEach(o => {
    o.el.style.left = (o.worldX - cam) + 'px';
  });
  // Finish
  if(G.finishPlatform){
    G.finishPlatform.el.style.left = (G.finishPlatform.worldX - cam) + 'px';
  }
  // Pits — bottom of ground level
  G.pits.forEach(p => { p.el.style.left = (p.worldX - cam) + 'px'; });
  // Coins
  G.coins.forEach(c => {
    if(c.collected){ c.el.style.display = 'none'; return; }
    c.el.style.display = 'block';
    c.el.style.left = (c.worldX - cam) + 'px';
    c.el.style.bottom = (GROUND_HEIGHT + c.y) + 'px';
  });
  // Enemies (sentries + redeemers)
  G.enemies.forEach(e => {
    // Dead sentries: hide. Dead redeemers: keep visible during respawn animation.
    if(e.dead){
      if(e.type === 'redeemer' && e.respawnAt){
        // Position still updates so the respawn animation looks anchored
        e.el.style.left = (e.worldX - cam) + 'px';
      } else {
        e.el.style.display = 'none';
      }
      return;
    }
    e.el.style.display = 'block';
    e.el.style.left = (e.worldX - cam) + 'px';
    if(e.type === 'biasbat'){
      e.el.style.bottom = (GROUND_HEIGHT + (e.y || e.baseY || 150)) + 'px';
    }
  });
  // Cannons (Round 1-2+) — stationary, just update screen position
  (G.cannons || []).forEach(cn => {
    cn.el.style.left = (cn.worldX - cam) + 'px';
  });
  // Boss (castle) + health bar
  if(G.boss){
    G.boss.el.style.left = (G.boss.worldX - cam) + 'px';
    if(G.boss.healthEl){
      // Health bar floats above the boss head
      G.boss.healthEl.style.left = (G.boss.worldX - cam - 10) + 'px';
      G.boss.healthEl.style.display = G.boss.dead ? 'none' : 'block';
    }
    G.boss.el.style.bottom = (GROUND_HEIGHT + (G.boss.y || 0)) + 'px';
    if(G.boss.shadowEl){
      G.boss.shadowEl.style.left = (G.boss.worldX - cam - 5) + 'px';
      G.boss.shadowEl.style.display = G.boss.dead ? 'none' : 'block';
      G.boss.shadowEl.style.opacity = Math.max(.18, 1 - ((G.boss.y || 0) / 220));
    }
  }
  // Cannonballs are positioned in step() during their own physics loop
}

function updatePlayerVisual(refs){
  const cam = (G && G.cameraX != null) ? G.cameraX : G.distance;
  const playerScreenX = (G.distance + PLAYER_LEFT) - cam;
  refs.player.style.left = playerScreenX + 'px';
  refs.player.style.bottom = (GROUND_HEIGHT + G.y) + 'px';
  refs.player.classList.toggle('running', !G.jumping && !G.ducking && (inputState.right || inputState.left));
  refs.player.classList.toggle('jumping', G.jumping);
  refs.player.classList.toggle('ducking', !!G.ducking);
  refs.player.classList.toggle('flipped', G.facing === -1);
  const isInv = Date.now() < G.invincibleUntil;
  refs.player.classList.toggle('invincible', isInv);
}

function updateHud(refs){
  // Lives — render up to MAX_LIVES tokens; spent ones shown dim.
  refs.hudLives.innerHTML = '';
  const tokensToShow = Math.max(3, G.lives);
  for(let i=0; i<tokensToShow; i++){
    const t = document.createElement('span');
    t.className = 'life-token' + (i >= G.lives ? ' spent' : '');
    refs.hudLives.appendChild(t);
  }
  refs.hudCorrect.textContent = G.correctCount + '/' + activeRoundQuestions.length;
  // Coin meter: shows progress toward next bonus life (e.g., "23/100").
  refs.hudCoins.textContent = (G.coinMeter || 0) + '/' + COIN_LIFE_THRESHOLD;
  refs.hudScore.textContent = G.score;

  // Streak — shown as "3/5" with a glow when getting close.
  // Hidden entirely on castle rounds (no streak rewards there).
  if(refs.hudStreak && refs.hudStreakItem){
    const isCastle = activeRound && activeRound.round && activeRound.round.isCastle;
    if(isCastle){
      refs.hudStreakItem.style.display = 'none';
    } else {
      refs.hudStreakItem.style.display = '';
      refs.hudStreak.textContent = (G.streak || 0) + '/' + STREAK_THRESHOLD;
      refs.hudStreak.classList.toggle('hot', (G.streak || 0) >= STREAK_THRESHOLD - 1);
    }
  }
}

// ── Physics & step ───────────────────────────────────────────────
function step(refs){
  // v5 boss-arena fix: projectiles draw from camera coordinates, not player distance,
  // so shots no longer appear to drift backward/forward when the arena camera is locked.
  if(!G.running || G.questionInProgress || G.over || G.finished) return;

  // Horizontal motion (proposed — gate may clamp it below).
  // Player can't move horizontally while ducking (down held on ground).
  let dx = 0;
  const wantToDuck = inputState.down && !G.jumping && G.y === 0 && !(G.standingOnDeco);
  if(!wantToDuck){
    if(inputState.right){ dx = RUN_SPEED; G.facing = 1; }
    else if(inputState.left && G.distance > 0){ dx = -RUN_SPEED * 0.8; G.facing = -1; }
  }

  // ── Question-platform contact trigger ──
  // The next uncleared platform acts as a solid wall. Running into its
  // LEFT edge fires the question. Cleared platforms become passable.
  let blocker = null;
  for(const p of G.platforms){
    if(!p.cleared){ blocker = p; break; }
  }
  let proposedDistance = G.distance + dx;
  // In the locked boss arena, keep the player inside the visible room.
  // This prevents the player from walking so far right that the fight leaves the frame.
  if(G.boss && !G.boss.dead && G.bossArenaStartX != null){
    const playerWXNow = G.distance + PLAYER_LEFT;
    const wouldEnterArena = playerWXNow >= G.bossArenaStartX || (proposedDistance + PLAYER_LEFT) >= G.bossArenaStartX;
    if(wouldEnterArena){
      const arenaCam = G.bossArenaCameraX;
      const visibleW = refs.area.clientWidth || window.innerWidth || 1180;
      const minWX = G.bossArenaStartX - 5;
      const maxWX = arenaCam + visibleW - 92;
      const proposedWX = Math.max(minWX, Math.min(maxWX, proposedDistance + PLAYER_LEFT));
      proposedDistance = proposedWX - PLAYER_LEFT;
    }
  }
  const proposedCenter = proposedDistance + PLAYER_LEFT + 24;
  if(blocker && dx > 0 && proposedCenter > blocker.worldX){
    // Hit the platform's left edge — clamp position and trigger question.
    G.distance = blocker.worldX - PLAYER_LEFT - 24;
    G.currentPlatform = blocker;
    // Save current vertical state so we can resume mid-jump after the question.
    G.savedY = G.y;
    G.savedVelocity = G.velocity;
    G.savedJumping = G.jumping;
    showPlatformQuestion(refs);
    return;
  }
  G.distance = proposedDistance;

  const playerWX = G.distance + PLAYER_LEFT;
  const playerCenterX = playerWX + 24;

  // ── Standing on deco platforms or bigblocks ──
  // Combined list of "stand-on-able" surfaces with their top-Y and x-extent.
  const standables = [];
  G.decoPlatforms.forEach(d => standables.push({ worldX: d.worldX, width: d.width, topY: d.bottomOffset + d.height }));
  (G.obstacles || []).forEach(o => {
    if(o.type === 'bigblock'){
      standables.push({ worldX: o.worldX, width: o.width, topY: o.height });
    }
  });

  // ── Standing-on check FIRST so we know if drop-through is even valid ──
  // Use a footprint test (any part of the player's 36px-wide foot region
  // overlapping the platform top counts as standing). The previous test
  // required the player's CENTER to be over the platform, which made
  // narrow stepping stones feel like the player slid off prematurely.
  const dropGhosting = Date.now() < (G.dropGhostUntil || 0);
  const playerFootLeft = playerCenterX - 18;
  const playerFootRight = playerCenterX + 18;
  let standingOn = null;
  if(!G.jumping && !dropGhosting){
    for(const s of standables){
      const onTop = playerFootRight > s.worldX + 4 && playerFootLeft < s.worldX + s.width - 4;
      if(!onTop) continue;
      if(Math.abs(G.y - s.topY) < 6){
        standingOn = s;
        G.y = s.topY;
        break;
      }
    }
  }
  G.standingOnDeco = standingOn;

  // ── Down-arrow handling (context-sensitive) ──
  // Three behaviors depending on what the player is doing:
  //   1. On a stand-on-able + fresh press = DROP-THROUGH (one-shot)
  //   2. On the ground + held = DUCK (continuous)
  //   3. In the air = ignored (can't duck mid-jump)
  if(inputState.downPressed && standingOn && !G.jumping){
    // Drop-through: set ghost timer, clear standing snap
    G.dropGhostUntil = Date.now() + 400;
    G.standingOnDeco = standingOn = null;
  }
  inputState.downPressed = false; // always consume the one-shot

  // Ducking: held down + on ground + not jumping + not on a stand-on-able
  G.ducking = (inputState.down && !G.jumping && G.y === 0 && !standingOn);

  // If we just initiated a drop (ghosting and was on a platform last frame), kick into the fall
  if(dropGhosting && !G.jumping && G.y > 0){
    G.jumping = true;
    G.velocity = 1;
  }

  // ── Vertical motion ──
  if(G.jumping){
    G.y += -G.velocity;
    G.velocity += GRAVITY;
    if(G.velocity > MAX_FALL) G.velocity = MAX_FALL;

    // Check standables landings while falling — but not during drop ghost.
    // Same footprint test as the standing check.
    if(G.velocity > 0 && !dropGhosting){
      for(const s of standables){
        const onTop = playerFootRight > s.worldX + 4 && playerFootLeft < s.worldX + s.width - 4;
        if(!onTop) continue;
        if(G.y <= s.topY && G.y > s.topY - 22){
          G.y = s.topY; G.velocity = 0; G.jumping = false;
          break;
        }
      }
    }

    // Land on ground
    if(G.y <= 0){
      G.y = 0; G.velocity = 0; G.jumping = false;
    }
  } else if(!standingOn && G.y > 0){
    // Walked off a stand-on-able surface — start falling
    G.jumping = true;
    G.velocity = 0;
  }

  // ── Pit check (only at ground level) ──
  if(!G.jumping && G.y === 0 && !standingOn){
    for(const pit of G.pits){
      if(playerCenterX > pit.worldX && playerCenterX < pit.worldX + pit.width){
        loseLife(refs, 'fell into a pit');
        return;
      }
    }
  }

  // ── Ground hazard collision (spikes + active steam vents) ──
  if(Date.now() > G.invincibleUntil){
    for(const o of (G.obstacles || [])){
      const dxs = playerCenterX - (o.worldX + o.width / 2);
      if(o.type === 'spike'){
        // Spike hitbox is small — shrunk to make jumps fair
        if(Math.abs(dxs) < 16 && G.y < 36){
          loseLife(refs, 'hit a spike');
          return;
        }
      } else if(o.type === 'steam-vent'){
        // World 2 timing hazard: steam only hurts during the visible puff.
        const phase = ((Date.now() + (o.phase || 0)) % 1700);
        const active = phase > 650 && phase < 1260;
        if(active && Math.abs(dxs) < 25 && G.y < 116){
          loseLife(refs, 'caught in steam');
          return;
        }
      }
    }
  }

  // Enemy patrol
  G.enemies.forEach(e => {
    // Redeemer respawn: when respawn timer fires, restore them
    if(e.dead && e.type === 'redeemer' && e.respawnAt && Date.now() >= e.respawnAt){
      e.dead = false;
      e.worldX = e.originX;
      e.vx = e.originVx;
      e.respawnAt = 0;
      e.el.classList.remove('respawning');
    }
    if(e.dead) return;
    e.worldX += e.vx;
    if(e.worldX <= e.patrolMin){ e.worldX = e.patrolMin; e.vx = Math.abs(e.vx); }
    if(e.worldX >= e.patrolMax){ e.worldX = e.patrolMax; e.vx = -Math.abs(e.vx); }
    if(e.type === 'biasbat'){
      e.phase = (e.phase || 0) + 0.055;
      e.y = (e.baseY || 150) + Math.sin(e.phase) * (e.amp || 30);
    }
  });

  // Boss movement (castle round only): patrol + jump pattern + policy shots.
  if(G.boss && !G.boss.dead){
    const boss = G.boss;
    boss.worldX += boss.vx;
    if(boss.worldX <= boss.patrolMin){ boss.worldX = boss.patrolMin; boss.vx = Math.abs(boss.vx); }
    if(boss.worldX >= boss.patrolMax){ boss.worldX = boss.patrolMax; boss.vx = -Math.abs(boss.vx); }

    const bossNow = Date.now();
    boss.y = boss.y || 0;
    boss.vy = boss.vy || 0;
    boss.onGround = boss.y <= 0;
    if(boss.onGround && bossNow >= (boss.nextJumpAt || 0)){
      boss.vy = 16.5;
      boss.onGround = false;
      boss.nextJumpAt = bossNow + 7200;
      refs.msg.textContent = 'Boss jump — watch the landing!';
      refs.msg.classList.add('visible');
      setTimeout(() => refs.msg.classList.remove('visible'), 1100);
    }
    if(!boss.onGround){
      boss.y += boss.vy;
      boss.vy -= 0.95;
      if(boss.y <= 0){
        boss.y = 0; boss.vy = 0; boss.onGround = true;
        // Landing sends a low shockwave left. It uses cannonball collision rules.
        const waveEl = document.createElement('div');
        waveEl.className = 'cannonball boss-shot low';
        refs.area.appendChild(waveEl);
        G.cannonballs.push({
          el: waveEl, worldX: boss.worldX - 16, y: 8, height:'low', vx:-1.55,
          spawnedAt: bossNow, lastTrailAt: bossNow,
        });
      }
    }

    // Boss fires alternating high/low policy shots while the player is near the final room.
    const playerDist = boss.worldX - (G.distance + PLAYER_LEFT);
    const activeBossShots = (G.cannonballs || []).filter(b => b.el && b.el.classList && b.el.classList.contains('boss-shot')).length;
    if(playerDist > -180 && playerDist < 760 && activeBossShots < 1 && bossNow >= (boss.nextShotAt || 0)){
      boss.shotIndex = (boss.shotIndex || 0) + 1;
      boss.nextShotAt = bossNow + 9500;
      const high = boss.shotIndex % 2 === 0;
      const shotEl = document.createElement('div');
      shotEl.className = 'cannonball boss-shot ' + (high ? 'high' : 'low');
      refs.area.appendChild(shotEl);
      G.cannonballs.push({
        el: shotEl,
        worldX: boss.worldX - 10,
        y: high ? 50 : 22,
        height: high ? 'high' : 'low',
        vx: -1.55,
        spawnedAt: bossNow,
        lastTrailAt: bossNow,
      });
      if(high && !G._bossDuckHintShown){
        G._bossDuckHintShown = true;
        refs.msg.textContent = 'High boss shot — press DOWN to duck!';
        refs.msg.classList.add('visible');
        setTimeout(() => refs.msg.classList.remove('visible'), 1800);
      }
    }
  }

  // ── Cannon firing (Round 1-2+) ──
  // Each cannon fires a slow projectile leftward when its cooldown expires.
  // Cannons only fire when the player is within ~1800px (so off-screen cannons
  // don't waste cannonballs into the void). They also hold fire during the
  // brief safety window right after a question — gives the player a beat
  // to step off the cleared platform.
  const now = Date.now();
  const inSafety = now < (G.safetyUntil || 0);
  (G.cannons || []).forEach(cn => {
    if(inSafety) return;
    const distFromPlayer = cn.worldX - (G.distance + PLAYER_LEFT);
    // Only active if player is within firing range AND to the left of the cannon
    if(distFromPlayer < -200 || distFromPlayer > 1800) return;
    if(now - cn.lastFireAt >= cn.cooldown){
      // Fire!
      cn.lastFireAt = now;
      cn.shotIndex = (cn.shotIndex || 0) + 1;
      cn.el.classList.remove('firing');
      void cn.el.offsetWidth; // restart animation
      cn.el.classList.add('firing');

      // Resolve cannonball height from cannon's pattern.
      //   'low'       → always y=20 (jump over)
      //   'high'      → always y=64 (duck under)
      //   'alternate' → low/high/low/high...
      let height;
      const pattern = cn.pattern || 'low';
      if(pattern === 'high') height = 'high';
      else if(pattern === 'alternate') height = (cn.shotIndex % 2 === 0) ? 'high' : 'low';
      else height = 'low';
      // Heights tuned vs hitboxes:
      //   Standing player covers y=4..56. Ducked player covers y=4..32.
      //   Low ball (y=20, hitbox 22..42) hits both — must JUMP over.
      //   High ball (y=42, hitbox 44..64) hits standing only — must DUCK under.
      const ballY = (height === 'high') ? 42 : 20;

      // First-time duck hint — show once per round when first high ball spawns
      if(height === 'high' && !G._duckHintShown){
        G._duckHintShown = true;
        refs.msg.textContent = 'High cannonball — press DOWN to duck!';
        refs.msg.classList.add('visible');
        setTimeout(() => refs.msg.classList.remove('visible'), 2400);
      }

      // Spawn cannonball at the cannon's muzzle, height-appropriate
      const ballEl = document.createElement('div');
      ballEl.className = 'cannonball ' + height + (cn.projectileClass ? ' ' + cn.projectileClass : ''); // class for visual variant
      refs.area.appendChild(ballEl);
      G.cannonballs.push({
        el: ballEl,
        worldX: cn.worldX,
        y: ballY,
        height: height,
        vx: -3.0,         // slower than RUN_SPEED (5.5) so player can outrun briefly
        spawnedAt: now,
        lastTrailAt: now,
      });

      // Spawn a quick muzzle flash at the right height
      const flashEl = document.createElement('div');
      flashEl.className = 'cannon-flash';
      const flashCam = (G && G.cameraX != null) ? G.cameraX : getCameraX();
      flashEl.style.left = (cn.worldX - flashCam - 15) + 'px';
      flashEl.style.bottom = (GROUND_HEIGHT + (height === 'high' ? 38 : 18)) + 'px';
      refs.area.appendChild(flashEl);
      setTimeout(() => { if(flashEl.parentNode) flashEl.remove(); }, 350);
    }
  });

  // ── Cannonball physics ──
  // Move each ball, drop a fading trail every ~80ms, despawn if off-screen
  // or after 8s. Then check collision with player.
  for(let i = G.cannonballs.length - 1; i >= 0; i--){
    const b = G.cannonballs[i];
    b.worldX += b.vx;
    // Drop a short-lived trail puff occasionally
    if(now - b.lastTrailAt > 80){
      b.lastTrailAt = now;
      const t = document.createElement('div');
      t.className = 'cannonball-trail';
      const projectileCam = (G && G.cameraX != null) ? G.cameraX : getCameraX();
      t.style.left = (b.worldX - projectileCam + 6) + 'px';
      t.style.bottom = (GROUND_HEIGHT + b.y - 5) + 'px';
      refs.area.appendChild(t);
      setTimeout(() => { if(t.parentNode) t.remove(); }, 500);
    }
    // Despawn conditions
    const cannonCamForOffscreen = (G && G.cameraX != null) ? G.cameraX : getCameraX();
    const offScreen = (b.worldX - cannonCamForOffscreen) < -140 || (b.worldX - cannonCamForOffscreen) > 2000;
    const tooOld = now - b.spawnedAt > 8000;
    if(offScreen || tooOld){
      b.el.remove();
      G.cannonballs.splice(i, 1);
      continue;
    }
    // Position update
    const cannonCamForDraw = (G && G.cameraX != null) ? G.cameraX : getCameraX();
    b.el.style.left = (b.worldX - cannonCamForDraw) + 'px';
    b.el.style.bottom = (GROUND_HEIGHT + b.y) + 'px';
  }

  // ── Cannonball collision ──
  // Cannonball hitbox: 24×24 sphere centered at (b.worldX+12, b.y+12)
  // Player hitbox: 48×60 at (playerWX, G.y) bottom-left.
  // While ducking, player vertical hitbox shrinks to ~32 tall,
  // so high cannonballs (y=64) pass safely overhead.
  if(Date.now() > G.invincibleUntil){
    for(const b of G.cannonballs){
      const pLeft = playerWX + 6, pRight = playerWX + 42;
      const pBottom = G.y + 4;
      const pTop = G.y + (G.ducking ? 32 : 56);
      const bLeft = b.worldX + 4, bRight = b.worldX + 20;
      const bBottom = b.y + 2, bTop = b.y + 22;
      if(pRight > bLeft && pLeft < bRight && pTop > bBottom && pBottom < bTop){
        loseLife(refs, 'hit by cannonball');
        return;
      }
    }
  }

  // ── Falling debris (Round 1-3+) ──
  // Trigger zones arm when player crosses triggerX. Debris spawns above
  // the (jittered) landX with a warning shadow on the ground, then
  // falls under gravity. Hits ground = becomes inert "wreckage" pile.
  // landX is randomized on arm so students can't memorize impact spots
  // across replays — they have to actually read the warning shadow.
  (G.debris || []).forEach(d => {
    // Arm the trigger when player crosses past triggerX
    if(!d.armed && (G.distance + PLAYER_LEFT) > d.triggerX){
      d.armed = true;
      d.falling = true;
      // Randomize impact: ± half the zone's jitterRange (default 360 = ±180).
      // Castle round uses a smaller range so the variance is more readable
      // given its tighter spacing. Re-roll if it lands inside a pit.
      const jitterRange = d.jitterRange || 360;
      let jittered;
      let attempts = 0;
      do {
        const jitter = (Math.random() - 0.5) * jitterRange;
        jittered = d.baseLandX + jitter;
        attempts++;
      } while(
        attempts < 6 &&
        G.pits.some(p => jittered > p.worldX - 30 && jittered < p.worldX + p.width + 30)
      );
      d.landX = jittered;
      d.y = 430;       // spawn near the top of the sky for readability
      d.velocity = 0;
      d.el = document.createElement('div');
      d.el.className = 'debris falling';
      refs.area.appendChild(d.el);
      d.warningEl = document.createElement('div');
      d.warningEl.className = 'debris-warning';
      d.warningEl.style.width = '50px';
      refs.area.appendChild(d.warningEl);
    }

    if(d.falling){
      // Gravity tuned to 0.85 — total fall ~32 frames ≈ 530ms.
      // Visible enough to read, fast enough to feel weighty.
      d.velocity += 0.85;
      d.y -= d.velocity;

      if(d.el){
        d.el.style.left = (d.landX - G.distance - 10) + 'px';
        d.el.style.bottom = (GROUND_HEIGHT + d.y) + 'px';
      }
      if(d.warningEl){
        d.warningEl.style.left = (d.landX - G.distance - 25) + 'px';
        const alpha = Math.max(0.4, Math.min(1, 1 - (d.y / 430)));
        d.warningEl.style.opacity = alpha;
      }

      if(d.y <= 0){
        d.y = 0;
        d.falling = false;
        d.landed = true;
        if(d.el){
          d.el.classList.remove('falling');
          d.el.classList.add('landed');
          d.el.style.bottom = (GROUND_HEIGHT - 4) + 'px';
        }
        if(d.warningEl){ d.warningEl.remove(); d.warningEl = null; }
      }
    } else if(d.landed && d.el){
      d.el.style.left = (d.landX - G.distance - 10) + 'px';
    }
  });

  // Debris collision (only while falling — landed wreckage is just decoration)
  if(Date.now() > G.invincibleUntil){
    for(const d of (G.debris || [])){
      if(!d.falling || !d.el) continue;
      const pLeft = playerWX + 6, pRight = playerWX + 42;
      const pBottom = G.y + 4, pTop = G.y + (G.ducking ? 32 : 56);
      const dLeft = d.landX - 18, dRight = d.landX + 18;
      const dBottom = d.y, dTop = d.y + 18;
      if(pRight > dLeft && pLeft < dRight && pTop > dBottom && pBottom < dTop){
        loseLife(refs, 'crushed by debris');
        return;
      }
    }
  }

  // Coin collection — proper rectangle overlap so any part of the
  // player body touching the coin counts as a pickup.
  // Player: 48 wide × 60 tall, anchored at (playerWX, G.y) bottom-left.
  // Coin: 18 wide × 18 tall, anchored at (c.worldX, c.y) bottom-left.
  G.coins.forEach(c => {
    if(c.collected) return;
    const pLeft = playerWX, pRight = playerWX + 48;
    const pBottom = G.y, pTop = G.y + 60;
    const cLeft = c.worldX, cRight = c.worldX + 18;
    const cBottom = c.y, cTop = c.y + 18;
    if(pRight > cLeft && pLeft < cRight && pTop > cBottom && pBottom < cTop){
      c.collected = true;
      G.coinsCollected++;
      G.score += 10;
      // Bump cumulative coin meter (persists across rounds via PROGRESS).
      G.coinMeter = (G.coinMeter || 0) + 1;
      if(G.coinMeter >= COIN_LIFE_THRESHOLD){
        G.coinMeter -= COIN_LIFE_THRESHOLD;
        awardLife(refs, COIN_LIFE_THRESHOLD + ' COINS');
      }
    }
  });

  // ── Enemy collision (with stomp detection) ──
  // If player is coming DOWN onto enemy from above → stomp.
  // Otherwise → side hit, lose a life.
  // Sentry: stomp = permanent kill. Redeemer: stomp = temporary defeat,
  // respawns after 3s (politics keeps coming back).
  if(Date.now() > G.invincibleUntil){
    for(const e of G.enemies){
      if(e.dead) continue;
      const enemyCenterOffset = (e.type === 'redeemer') ? 18 : (e.type === 'biasbat' ? 21 : 17);
      const enemyWidthHalf = (e.type === 'biasbat') ? 25 : 22;
      const dxe = playerCenterX - (e.worldX + enemyCenterOffset);
      const horizontalHit = Math.abs(dxe) < enemyWidthHalf;
      if(!horizontalHit) continue;

      const enemyBottomY = (e.type === 'biasbat') ? (e.y || e.baseY || 150) : 0;
      const enemyHeight = (e.type === 'redeemer') ? 54 : (e.type === 'biasbat' ? 34 : 50);
      const enemyTopY = enemyBottomY + enemyHeight;
      const playerBottom = G.y + 4;
      const playerTop = G.y + (G.ducking ? 32 : 56);
      const verticalOverlap = playerTop > enemyBottomY + 4 && playerBottom < enemyTopY - 2;
      const isStomp = G.jumping && G.velocity > 0 && playerBottom >= enemyTopY - 24 && playerBottom <= enemyTopY + 10;
      if(isStomp){
        e.dead = true;
        e.el.classList.add('stomped');
        G.velocity = STOMP_BOUNCE;
        G.y = Math.max(G.y, enemyTopY);
        G.score += 50;
        if(e.type === 'redeemer'){
          // Respawn in 3s — political backlash returns
          e.respawnAt = Date.now() + 3000;
          e.el.classList.add('respawning');
          // Don't remove the element; the animation handles fade-out & fade-in
        } else {
          setTimeout(() => { if(e.el && e.el.parentNode) e.el.remove(); }, 400);
        }
      } else if(verticalOverlap){
        const reason = e.type === 'redeemer' ? 'blocked by Redeemer' : (e.type === 'biasbat' ? 'hit by Bias Bat' : 'caught by sentry');
        loseLife(refs, reason);
        return;
      }
    }
  }

  // ── Boss collision (castle only) ──
  // Boss is 60×78. Center offset 30. Top y ≈ 78. 3 stomps to defeat.
  // Brief invulnerability after each hit so the player can bounce off
  // without immediately registering another stomp.
  if(G.boss && !G.boss.dead && Date.now() > G.invincibleUntil){
    const boss = G.boss;
    const dxb = playerCenterX - (boss.worldX + 30);
    const horizontalHit = Math.abs(dxb) < 34;
    const bossBottomY = boss.y || 0;
    const bossTopY = bossBottomY + 78;
    const pBottom = G.y + 4;
    const pTop = G.y + (G.ducking ? 32 : 56);
    const verticalOverlap = pTop > bossBottomY + 4 && pBottom < bossTopY - 2;
    if(horizontalHit && verticalOverlap){
      const isStomp = G.jumping && G.velocity > 0 && pBottom >= bossTopY - 26 && pBottom <= bossTopY + 10;
      const bossInvuln = Date.now() < (boss.invulnerableUntil || 0);
      if(isStomp && !bossInvuln){
        boss.health--;
        boss.invulnerableUntil = Date.now() + 600;
        boss.el.classList.remove('stunned');
        void boss.el.offsetWidth;
        boss.el.classList.add('stunned');
        G.velocity = STOMP_BOUNCE;
        G.y = Math.max(G.y, bossTopY);
        G.score += 100;
        // Update health bar fill
        if(boss.healthFill){
          const pct = Math.max(0, boss.health / boss.maxHealth) * 100;
          boss.healthFill.style.width = pct + '%';
        }
        if(boss.health <= 0){
          // Defeated! Unlock the castle gate.
          boss.dead = true;
          G.bossDefeated = true;
          G.finishGated = false;
          boss.el.style.transition = 'opacity .6s ease-out, transform .8s ease-in';
          boss.el.style.opacity = '0';
          boss.el.style.transform = 'rotate(75deg) translateY(20px)';
          if(boss.healthEl) boss.healthEl.style.display = 'none';
          // Unlock the castle finish — chain barrier slides away
          if(G.finishPlatform && G.finishPlatform.el){
            G.finishPlatform.el.classList.add('unlocked');
          }
          G.score += 500; // Boss bonus
          refs.msg.textContent = 'GENERAL DEFEATED — castle unlocked!';
          refs.msg.classList.add('visible');
          setTimeout(() => refs.msg.classList.remove('visible'), 2400);
        }
      } else if(!bossInvuln){
        loseLife(refs, boss.y > 25 ? 'hit by the jumping Gilded Machine' : 'crushed by the Gilded Machine');
        return;
      }
    }
  }

  // Finish line — only reachable once all platforms cleared AND
  // (on castle) the boss is defeated.
  if(G.finishPlatform && playerCenterX > G.finishPlatform.worldX + 30){
    if(G.finishGated){
      // Bounce the player back gently — they hit the chain barrier
      G.distance = Math.max(0, G.distance - 4);
      if(!G._gateHintShown){
        G._gateHintShown = true;
        refs.msg.textContent = 'Defeat the Gilded Machine to unlock the gate!';
        refs.msg.classList.add('visible');
        setTimeout(() => refs.msg.classList.remove('visible'), 2400);
      }
    } else {
      finishRound(refs);
      return;
    }
  }

  updateWorldVisuals(refs);
  updatePlayerVisual(refs);
  updateHud(refs);
}

function loop(refs, myLoopId){
  if(myLoopId !== G.loopId) return;
  step(refs);
  if(G.running && !G.over && !G.finished){
    requestAnimationFrame(() => loop(refs, myLoopId));
  }
}

// ── Jump input ───────────────────────────────────────────────────
function jump(){
  if(!G.running || G.jumping || G.questionInProgress) return;
  G.jumping = true;
  G.velocity = JUMP_VELOCITY;
}

// ── Question modal ───────────────────────────────────────────────
// Keyboard navigation state for the question modal
let qmodalKbIndex = 0;       // which choice is keyboard-focused (0-3)
let qmodalKbPhase = 'choice'; // 'choice' = picking answer; 'continue' = after-answer phase

function applyKbFocus(refs){
  // Clear all kb-focus markers, then set the right one
  Array.from(refs.qChoices.children).forEach(c => c.classList.remove('kb-focus'));
  refs.qContinue.classList.remove('kb-focus');
  if(qmodalKbPhase === 'choice'){
    const target = refs.qChoices.children[qmodalKbIndex];
    if(target) target.classList.add('kb-focus');
  } else if(qmodalKbPhase === 'continue'){
    refs.qContinue.classList.add('kb-focus');
  }
}

function showPlatformQuestion(refs){
  if(G.questionInProgress) return;
  G.questionInProgress = true;
  G.running = false;
  // Record when the modal opened so we can shift cannon cooldowns when it closes
  G.questionPausedAt = Date.now();
  // Clear any stuck keys so the player isn't still running when the modal closes.
  inputState.left = false;
  inputState.right = false;
  inputState.down = false;
  const idx = G.currentPlatform.idx;
  const q = activeRoundQuestions[idx];

  refs.qEyebrow.textContent = 'SOURCE BLOCK ' + (idx+1) + ' OF ' + activeRoundQuestions.length;

  // Progress dots
  refs.qProgress.innerHTML = '';
  G.platforms.forEach((p, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if(p.cleared) dot.classList.add('cleared');
    else if(i === idx) dot.classList.add('current');
    refs.qProgress.appendChild(dot);
  });

  refs.qStem.textContent = q.stem;
  refs.qChoices.innerHTML = '';
  q.choices.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'qmodal-choice';
    btn.innerHTML = '<span class="letter">' + String.fromCharCode(65+i) + '.</span><span>' + escapeHtml(c) + '</span>';
    btn.addEventListener('click', () => handleAnswer(refs, i, btn));
    // Mouse hover updates keyboard focus too, so they stay synced
    btn.addEventListener('mouseenter', () => {
      if(qmodalKbPhase === 'choice'){
        qmodalKbIndex = i;
        applyKbFocus(refs);
      }
    });
    refs.qChoices.appendChild(btn);
  });
  refs.qFeedback.className = 'qmodal-feedback';
  refs.qFeedback.innerHTML = '';
  refs.qActions.classList.remove('visible');
  refs.qmodalBg.classList.add('visible');

  // Reset keyboard focus to first choice
  qmodalKbPhase = 'choice';
  qmodalKbIndex = 0;
  applyKbFocus(refs);
}

function handleAnswer(refs, choiceIdx, btn){
  const q = activeRoundQuestions[G.currentPlatform.idx];
  const isCorrect = (choiceIdx === q.correctIdx);

  // Disable all choices to prevent double-clicks
  Array.from(refs.qChoices.children).forEach(b => b.disabled = true);
  if(isCorrect) btn.classList.add('correct');
  else btn.classList.add('wrong');
  // Always reveal the correct answer
  if(!isCorrect){
    refs.qChoices.children[q.correctIdx].classList.add('correct');
  }

  if(isCorrect){
    G.correctCount++;
    G.score += 100;
    G.streak = (G.streak || 0) + 1;
    G.currentPlatform.cleared = true;
    G.currentPlatform.armed = false;
    G.currentPlatform.el.classList.remove('armed');
    G.currentPlatform.el.classList.add('cleared');
    refs.qFeedback.className = 'qmodal-feedback correct';
    let feedback = '<span class="label">CORRECT</span>' + escapeHtml(q.explain);
    // Streak bonus — only outside the castle round
    const isCastle = activeRound && activeRound.round && activeRound.round.isCastle;
    if(!isCastle && G.streak >= STREAK_THRESHOLD){
      G.streak = 0; // reset
      // Defer the awardLife call until after the modal closes so the
      // toast doesn't get hidden by the modal background
      G._pendingStreakBonus = true;
      feedback += '<br><br><b style="color:#5a4010;">★ Streak of ' + STREAK_THRESHOLD + '! Bonus life on Continue.</b>';
    } else if(!isCastle){
      const remaining = STREAK_THRESHOLD - G.streak;
      if(remaining > 0 && remaining <= 2){
        feedback += '<br><br><i style="color:#5a4010;font-size:.9em;">' + remaining + ' more in a row for a bonus life!</i>';
      }
    }
    refs.qFeedback.innerHTML = feedback;
  } else {
    // Wrong: dock a life and reset the streak. Student must answer correctly to advance.
    G.lives--;
    G.livesLost = (G.livesLost || 0) + 1;
    G.streak = 0;
    refs.qFeedback.className = 'qmodal-feedback wrong';
    refs.qFeedback.innerHTML = '<span class="label">NOT QUITE — TRY AGAIN</span>' + escapeHtml(q.explain);
    updateHud(refs);
    if(G.lives <= 0){
      refs.qContinue.textContent = 'Game Over';
    } else {
      refs.qContinue.textContent = 'Try this question again';
    }
  }

  refs.qActions.classList.add('visible');
  // Move keyboard focus to the Continue button
  qmodalKbPhase = 'continue';
  applyKbFocus(refs);
  refs.qContinue.onclick = () => {
    refs.qmodalBg.classList.remove('visible');
    refs.qContinue.textContent = 'Continue';
    if(isCorrect){
      // Resume play — restore the player's vertical state (mid-jump if
      // they triggered the question while jumping). Player remains on
      // the LEFT side of the (now cleared, passable) platform.
      G.questionInProgress = false;
      if(typeof G.savedY === 'number'){
        G.y = G.savedY;
        G.velocity = G.savedVelocity;
        G.jumping = G.savedJumping;
        G.savedY = G.savedVelocity = G.savedJumping = undefined;
      } else {
        G.y = 0; G.velocity = 0; G.jumping = false;
      }
      // Shift cannon cooldowns forward by the time spent in the question modal,
      // so cannons don't immediately fire when the player resumes (they were
      // paused while the player wasn't moving).
      const pauseElapsed = G.questionPausedAt ? (Date.now() - G.questionPausedAt) : 0;
      if(pauseElapsed > 0){
        (G.cannons || []).forEach(cn => { cn.lastFireAt += pauseElapsed; });
      }
      G.questionPausedAt = 0;
      // Despawn any in-flight cannonballs within the player's danger zone.
      // While the modal was up, cannonballs that were already mid-flight just
      // froze in place — when play resumes, the player has zero time to dodge
      // them. Anything from -30px (just behind player) to +250px ahead gets
      // cleared. Cannonballs further out still travel normally.
      const playerWXResume = G.distance + PLAYER_LEFT;
      for(let i = G.cannonballs.length - 1; i >= 0; i--){
        const b = G.cannonballs[i];
        const dx = b.worldX - playerWXResume;
        if(dx > -30 && dx < 250){
          if(b.el && b.el.parentNode) b.el.remove();
          G.cannonballs.splice(i, 1);
        }
      }
      // 800ms post-question grace period during which cannons hold fire,
      // giving the player a moment to gather themselves and step off.
      G.safetyUntil = Date.now() + 800;
      // Brief invincibility too — covers the edge case of a cannonball spawned
      // exactly at the platform's worldX (very rare but possible).
      G.invincibleUntil = Math.max(G.invincibleUntil, Date.now() + 600);
      G.currentPlatform = null;
      G.running = true;
      // Award the pending streak bonus AFTER closing the modal so the toast is visible
      if(G._pendingStreakBonus){
        G._pendingStreakBonus = false;
        awardLife(refs, 'STREAK OF ' + STREAK_THRESHOLD);
      }
      G.loopId++;
      const newId = G.loopId;
      requestAnimationFrame(() => loop(refs, newId));
    } else if(G.lives <= 0){
      // Game over
      G.questionInProgress = false;
      gameOver(refs, 'no lives left');
    } else {
      // Wrong answer, lives remain. Reset state so showPlatformQuestion runs cleanly.
      G.questionInProgress = false;
      showPlatformQuestion(refs);
    }
    updateHud(refs);
  };
}

// ── Lives / hits / game over ─────────────────────────────────────
function loseLife(refs, reason){
  if(G.over || Date.now() < G.invincibleUntil) return;
  G.lives--;
  G.livesLost = (G.livesLost || 0) + 1;
  G.invincibleUntil = Date.now() + 1500;
  updateHud(refs);
  if(G.lives <= 0){ gameOver(refs, reason); return; }
  // Respawn at last cleared platform (or start)
  const lastCleared = [...G.platforms].reverse().find(p => p.cleared);
  G.distance = lastCleared ? (lastCleared.worldX + lastCleared.width + 30 - PLAYER_LEFT) : 0;
  G.parallaxX = G.distance * 0.3;
  G.y = 0; G.velocity = 0; G.jumping = false; G.ducking = false;
  G.running = false;
  refs.msg.textContent = 'Lost a life — ' + reason + '. Lives left: ' + G.lives;
  refs.msg.classList.add('visible');
  setTimeout(() => {
    refs.msg.classList.remove('visible');
    if(G.over) return;
    G.running = true;
    G.invincibleUntil = Date.now() + 1200;
    G.loopId++;
    const newId = G.loopId;
    requestAnimationFrame(() => loop(refs, newId));
  }, 1200);
}

// Award a bonus life (capped at MAX_LIVES). Shows a brief celebration toast
// describing how it was earned. Called by streak/coin/perfect-round paths.
function awardLife(refs, reason){
  if(G.lives >= MAX_LIVES){
    // At cap — give 100 score points instead so the achievement still feels real
    G.score += 100;
    showLifeToast(refs, '+100 BONUS — ' + reason + ' (lives at max)');
    return;
  }
  G.lives++;
  G.livesEarnedThisRound = (G.livesEarnedThisRound || 0) + 1;
  showLifeToast(refs, '+1 LIFE — ' + reason);
  updateHud(refs);
}

// Brief amber-gold toast at the top of the screen
function showLifeToast(refs, text){
  let toast = document.getElementById('lifeToast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'lifeToast';
    toast.className = 'life-toast';
    refs.area.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.remove('visible');
  void toast.offsetWidth; // restart animation
  toast.classList.add('visible');
  setTimeout(() => { toast.classList.remove('visible'); }, 2200);
}

function gameOver(refs, reason){
  G.over = true;
  G.running = false;
  showRoundClear(refs, false, reason);
}

// ── Finish & save ────────────────────────────────────────────────
async function finishRound(refs){
  if(G.finished) return;
  G.finished = true;
  G.running = false;

  // Time bonus: faster finish = more points
  const elapsedMs = Date.now() - G.startTime;
  const timeBonus = Math.max(0, Math.floor((180000 - elapsedMs) / 100));
  G.score += timeBonus;
  // Lives bonus
  G.score += G.lives * 250;

  // Perfect-round bonus: 100% accuracy AND no lives lost = +1 life.
  // Awarded BEFORE the round-clear screen renders so the toast & life count
  // both show up. Castle rounds DO get the perfect-round bonus (only the
  // mid-round streak is castle-disabled).
  const total = activeRoundQuestions.length;
  const isPerfect = total > 0 && G.correctCount === total && (G.livesLost || 0) === 0;
  if(isPerfect){
    awardLife(refs, 'PERFECT ROUND');
  }

  showRoundClear(refs, true, null, { isPerfect });

  // Save to Supabase
  await saveRoundResult({ elapsedMs, isPerfect });
}

async function saveRoundResult({ elapsedMs, isPerfect }){
  const total = activeRoundQuestions.length;
  const accuracy = total > 0 ? Math.round((G.correctCount / total) * 100) : 0;
  const stars = calculateStars(G.correctCount, total, G.lives);

  const roundId = activeRound.round.id;
  const existing = PROGRESS.rounds[roundId] || {};
  // Keep best run if existing better
  const isBetter = !existing.accuracy || accuracy > existing.accuracy;

  const newResult = isBetter ? {
    accuracy, correct: G.correctCount, total,
    stars, livesLeft: G.lives, ms: elapsedMs,
    coins: Math.max(existing.coins || 0, G.coinsCollected),
    completedAt: new Date().toISOString(),
    attempts: (existing.attempts || 0) + 1,
    perfect: !!isPerfect || !!existing.perfect,
  } : {
    ...existing,
    coins: Math.max(existing.coins || 0, G.coinsCollected),
    attempts: (existing.attempts || 0) + 1,
    perfect: !!isPerfect || !!existing.perfect,
  };

  PROGRESS.rounds[roundId] = newResult;
  PROGRESS.total_runs = (PROGRESS.total_runs || 0) + 1;
  PROGRESS.total_coins = (PROGRESS.total_coins || 0) + G.coinsCollected;
  PROGRESS.coin_meter = G.coinMeter || 0; // persist progress toward next coin-life
  if(roundId.startsWith('1-') && (!PROGRESS.best_unit1_ms || elapsedMs < PROGRESS.best_unit1_ms)){
    PROGRESS.best_unit1_ms = elapsedMs;
  }

  await STORE.save(PROGRESS);
  // Refresh world map next time it's shown
  renderWorldMap();
  renderProfile();
}

function calculateStars(correct, total, lives){
  if(total === 0) return 0;
  const acc = correct / total;
  if(acc >= 1.0 && lives === 3) return 3;
  if(acc >= 0.75) return 2;
  if(acc >= 0.5) return 1;
  return 0;
}

// ── Round-clear / game-over overlay ──────────────────────────────
function showRoundClear(refs, victory, reason, opts){
  opts = opts || {};
  G.running = false;
  refs.rcOverlay.querySelector('h2').textContent = victory ? 'ROUND CLEAR' : 'GAME OVER';
  refs.rcTitle.textContent = activeRound.round.title;
  const total = activeRoundQuestions.length;
  const accuracy = total > 0 ? Math.round((G.correctCount / total) * 100) : 0;
  let statsHtml = `
    <div class="rc-stat"><span class="v">${accuracy}%</span><span class="k">ACCURACY</span></div>
    <div class="rc-stat"><span class="v">${G.correctCount}/${total}</span><span class="k">CORRECT</span></div>
    <div class="rc-stat"><span class="v">${G.coinsCollected}</span><span class="k">COINS</span></div>
    <div class="rc-stat"><span class="v">${G.score}</span><span class="k">SCORE</span></div>
  `;
  if(opts.isPerfect){
    statsHtml += `<div class="rc-stat" style="border-color:#fce598;background:rgba(252,229,152,.18);"><span class="v" style="color:#fff8d8;">+1 ★</span><span class="k">PERFECT BONUS</span></div>`;
  }
  refs.rcStats.innerHTML = statsHtml;

  // Spinning star: only show on victory. Restart its animation by
  // briefly removing and re-adding the parent class.
  const starHost = document.getElementById('rcStarHost');
  if(starHost){
    starHost.style.display = victory ? '' : 'none';
    if(victory){
      // Clone-replace the star to retrigger CSS animations on replay.
      const old = starHost.querySelector('.rc-star');
      if(old){
        const fresh = old.cloneNode(true);
        old.replaceWith(fresh);
      }
    }
  }

  // Decide whether to offer "Next Round". Only on victory, only if there
  // IS a next round in this unit, and only if it has a question pool wired up.
  let nextRound = null;
  if(victory){
    const idx = activeRound.world.rounds.findIndex(r => r.id === activeRound.round.id);
    if(idx >= 0 && idx < activeRound.world.rounds.length - 1){
      const candidate = activeRound.world.rounds[idx + 1];
      if(QUESTION_BANK[candidate.id] && QUESTION_BANK[candidate.id].length && ROUND_BUILDERS[candidate.id]){
        nextRound = candidate;
      }
    }
  }
  if(nextRound){
    refs.rcNext.style.display = '';
    refs.rcNext.textContent = 'Next: ' + nextRound.num + ' ' + nextRound.title + ' →';
    refs.rcNext.onclick = () => {
      refs.rcOverlay.classList.remove('visible');
      launchRound(activeRound.world, nextRound);
    };
  } else {
    refs.rcNext.style.display = 'none';
    refs.rcNext.onclick = null;
  }

  refs.rcOverlay.classList.add('visible');
}

// ── Round launch ─────────────────────────────────────────────────
// Maps round id to its level builder function. As more rounds get
// authored, add them here. Rounds without an entry are gated below.
const ROUND_BUILDERS = {
  '1-1': buildRound1_1,
  '1-2': buildRound1_2,
  '1-3': buildRound1_3,
  '1-4': buildRound1_4_castle,
};

function launchRound(world, round){
  const refs = getGameRefs();
  // Gate: only rounds with a real builder are playable for now.
  if(!ROUND_BUILDERS[round.id]){
    alert(
      'Round ' + round.num + ' "' + round.title + '" is authored but its level layout ' +
      'is coming next.\n\nFor now, all 4 rounds of Unit 1 are fully playable. ' +
      'Replay them to practice (each round samples its question pool fresh per run).'
    );
    return;
  }
  activeRound = { world, round };
  activeRoundQuestions = sampleAndShufflePool(round.id, round.sampleSize);
  if(!activeRoundQuestions.length){
    alert('No questions found for ' + round.id + '. (Pool empty.)');
    return;
  }

  G = freshGameState();
  // Coin meter persists across rounds (cumulative progress toward 100-coin life bonus).
  // Stored on PROGRESS as coin_meter; falls back to 0 for first run.
  G.coinMeter = (PROGRESS.coin_meter || 0);
  refs.hudTitle.textContent = world.title;
  refs.hudSubtitle.textContent = 'UNIT ' + world.num + ' · ROUND ' + round.num;
  refs.player.innerHTML = KID_SVG;
  refs.player.style.left = PLAYER_LEFT + 'px';

  // Clear any previous round's theme classes
  refs.area.classList.remove('theme-battlefield', 'theme-postwar', 'theme-castle', 'theme-archivequest', 'theme-gilded', 'theme-gilded-rails', 'theme-gilded-labor', 'theme-gilded-city', 'theme-gilded-machine');

  ROUND_BUILDERS[round.id](refs);
  refs.qmodalBg.classList.remove('visible');
  refs.rcOverlay.classList.remove('visible');
  refs.msg.classList.remove('visible');

  showScreen('game');
  updateHud(refs);
  updateWorldVisuals(refs);
  updatePlayerVisual(refs);

  G.startTime = Date.now();
  G.running = true;
  G.loopId++;
  const myId = G.loopId;
  requestAnimationFrame(() => loop(refs, myId));
}

// ── Input handlers ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Modal keyboard nav takes priority when modal is visible
  if(G && G.questionInProgress){
    const refs = getGameRefs();
    if(qmodalKbPhase === 'choice'){
      const numChoices = refs.qChoices.children.length;
      if(numChoices === 0) return;
      if(e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 's' || e.key === 'S' || e.key === 'd' || e.key === 'D'){
        qmodalKbIndex = (qmodalKbIndex + 1) % numChoices;
        applyKbFocus(refs);
        e.preventDefault();
      } else if(e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'w' || e.key === 'W' || e.key === 'a' || e.key === 'A'){
        qmodalKbIndex = (qmodalKbIndex - 1 + numChoices) % numChoices;
        applyKbFocus(refs);
        e.preventDefault();
      } else if(e.key === 'Enter' || e.key === ' '){
        const target = refs.qChoices.children[qmodalKbIndex];
        if(target && !target.disabled) target.click();
        e.preventDefault();
      } else if(e.key >= '1' && e.key <= '9'){
        // Number-key shortcuts: 1-4 picks A-D
        const idx = parseInt(e.key, 10) - 1;
        if(idx < numChoices){
          const target = refs.qChoices.children[idx];
          if(target && !target.disabled){
            qmodalKbIndex = idx;
            target.click();
          }
          e.preventDefault();
        }
      }
    } else if(qmodalKbPhase === 'continue'){
      if(e.key === 'Enter' || e.key === ' '){
        refs.qContinue.click();
        e.preventDefault();
      }
    }
    return;
  }

  // Game movement input (only when game screen active and no modal)
  if(screens.game.classList.contains('active') && !G?.questionInProgress){
    if(e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A'){ inputState.left = true; e.preventDefault(); }
    else if(e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D'){ inputState.right = true; e.preventDefault(); }
    else if(e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W'){ jump(); e.preventDefault(); }
    else if(e.key === 'ArrowDown' || e.key === 's' || e.key === 'S'){
      // Repeat events shouldn't re-trigger downPressed (held key fires keydown
      // many times). Only set the one-shot on a fresh press.
      if(!inputState.down) inputState.downPressed = true;
      inputState.down = true;
      e.preventDefault();
    }
  }
});
document.addEventListener('keyup', e => {
  if(e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputState.left = false;
  if(e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputState.right = false;
  if(e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputState.down = false;
});

// Safety net: clear ALL input flags whenever the window loses focus or
// the tab becomes hidden. Browsers may swallow the keyup event when
// focus changes, leaving the player running forever. This catches that.
function clearAllInput(){
  inputState.left = false;
  inputState.right = false;
  inputState.down = false;
  inputState.jump = false;
  inputState.jumpHeld = false;
}
window.addEventListener('blur', clearAllInput);
document.addEventListener('visibilitychange', () => {
  if(document.hidden) clearAllInput();
});
// Also clear input when a modal pops up (fail-safe — the keydown gate
// stops new presses, but a key already held when the modal opens would
// otherwise stay held).
function clearInputOnModal(){ clearAllInput(); }

// ── Round-clear / exit buttons ───────────────────────────────────
document.getElementById('rcReplay').addEventListener('click', () => {
  document.getElementById('roundClear').classList.remove('visible');
  if(activeRound) launchRound(activeRound.world, activeRound.round);
});
document.getElementById('rcMap').addEventListener('click', () => {
  document.getElementById('roundClear').classList.remove('visible');
  showScreen('worldMap');
});
document.getElementById('hudExit').addEventListener('click', () => {
  if(G){ G.running = false; G.over = true; }
  showScreen('worldMap');
});
// Enter on the round-clear screen: prefer Next Round if available, else Replay
document.addEventListener('keydown', e => {
  const overlay = document.getElementById('roundClear');
  if(overlay.classList.contains('visible') && (e.key === 'Enter' || e.key === ' ')){
    const next = document.getElementById('rcNext');
    if(next.style.display !== 'none') next.click();
    else document.getElementById('rcReplay').click();
    e.preventDefault();
  }
});

// ════════════════════════════════════════════════════════════════
// DEBUG — toggle with the DEBUG button or pressing backtick (`).
// ════════════════════════════════════════════════════════════════
const debugPanel = document.getElementById('debugPanel');
const debugContent = document.getElementById('debugContent');
document.getElementById('debugToggle').addEventListener('click', () => {
  debugPanel.classList.toggle('visible');
  if(debugPanel.classList.contains('visible')) DEBUG.dump();
});
document.addEventListener('keydown', e => {
  if(e.key === '`'){
    debugPanel.classList.toggle('visible');
    if(debugPanel.classList.contains('visible')) DEBUG.dump();
  }
});

const DEBUG = {
  dump(){
    const pending = STORE.readPending();
    const html = `
      <h4>Identity</h4>
      <pre>${escapeHtml(JSON.stringify(IDENTITY, null, 2))}</pre>
      <h4>Progress (in memory)</h4>
      <pre>${escapeHtml(JSON.stringify({
        full_name: PROGRESS.full_name,
        display_name: PROGRESS.display_name,
        period: PROGRESS.period,
        composite_score: PROGRESS.composite_score,
        completion_pct: PROGRESS.completion_pct,
        trophy_tier: PROGRESS.trophy_tier,
        rounds_completed: PROGRESS.rounds_completed,
        units_completed: PROGRESS.units_completed,
        total_runs: PROGRESS.total_runs,
        total_coins: PROGRESS.total_coins,
        last_played_at: PROGRESS.last_played_at,
        roundsKeys: Object.keys(PROGRESS.rounds),
        unitsKeys: Object.keys(PROGRESS.units),
      }, null, 2))}</pre>
      <h4>Pending writes (queued for retry)</h4>
      <pre>${pending.length ? escapeHtml(JSON.stringify(pending, null, 2)) : '(none)'}</pre>
      <h4>Question library</h4>
      <pre>${Object.entries(QUESTION_BANK).map(([k,v]) => k + ': ' + v.length + ' items').join('\n')}</pre>
    `;
    debugContent.innerHTML = html;
  },
  async clearLocal(){
    try{
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(PENDING_KEY);
      DEBUG.dump();
      alert('Local cache + pending queue cleared. Reload to refetch from Supabase.');
    }catch(e){ alert('Failed: ' + e.message); }
  },
  async forceSyncDown(){
    const remote = await STORE.fetchRemote();
    if(remote){
      PROGRESS = mergeRemoteIntoProgress(remote);
      STORE.writeCache(PROGRESS);
      renderIdentity(); renderProfile(); renderWorldMap();
      DEBUG.dump();
      alert('Resynced from Supabase.');
    }else{
      alert('Supabase returned no row (or unreachable).');
    }
  },
  dumpQuestions(){
    let s = '';
    Object.entries(QUESTION_BANK).forEach(([round, qs]) => {
      s += '\n=== ' + round + ' (' + qs.length + ' items) ===\n';
      qs.forEach((q, i) => {
        s += (i+1) + '. ' + q.stem.split('\n')[0].slice(0,80) + (q.stem.length > 80 ? '...' : '') + '\n';
        q.choices.forEach((c, j) => {
          const marker = j === q.correctIdx ? '* ' : '  ';
          s += '   ' + marker + String.fromCharCode(65+j) + '. ' + c.slice(0,100) + (c.length > 100 ? '...' : '') + '\n';
        });
      });
    });
    debugContent.innerHTML = '<pre>' + escapeHtml(s) + '</pre>';
  },
  // Mark every round in PROGRESS.rounds as completed so they all unlock
  // for testing. Doesn't save to Supabase — local-only convenience.
  unlockAll(){
    if(!PROGRESS.rounds) PROGRESS.rounds = {};
    let count = 0;
    WORLDS.forEach(w => {
      if(!w.rounds) return;
      w.rounds.forEach(rd => {
        if(!PROGRESS.rounds[rd.id]){
          PROGRESS.rounds[rd.id] = {
            accuracy: 0, correct: 0, total: rd.sampleSize || 8,
            stars: 0, livesLeft: 3, ms: 0, coins: 0,
            completedAt: new Date().toISOString(),
            attempts: 0, perfect: false,
            _debugUnlocked: true,
          };
          count++;
        }
      });
    });
    renderUnitEntry();
    renderWorldMap();
    DEBUG.dump();
    alert('Unlocked ' + count + ' previously-locked round(s) locally. (Not saved to Supabase.)');
  },
};

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ════════════════════════════════════════════════════════════════
// BOOT — load progress from Supabase (or cache), render, ready.
// ════════════════════════════════════════════════════════════════
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMsg = document.getElementById('loadingMsg');

async function boot(){
  try{
    loadingMsg.textContent = 'Connecting to Civitas…';
    const result = await STORE.load();
    PROGRESS = result.progress;

    if(result.source === 'remote'){
      loadingMsg.textContent = 'Welcome back, ' + IDENTITY.name + '.';
    }else if(result.source === 'cache'){
      loadingMsg.textContent = 'Network slow — using cached progress.';
    }else{
      loadingMsg.textContent = 'New campaign. Welcome, ' + IDENTITY.name + '.';
    }

    renderIdentity();
    renderProfile();
    renderWorldMap();

    // Brief pause so the welcome message reads, then reveal.
    setTimeout(() => loadingOverlay.classList.add('hidden'), 600);
  }catch(e){
    loadingMsg.textContent = 'Loading failed. Refresh to retry. (' + (e.message || 'unknown') + ')';
    console.error('boot error', e);
  }
}


// ════════════════════════════════════════════════════════════════
// ARCHIVE QUEST PROTOTYPE PATCH — replaces Round 1-1 layout only.
// Keeps the existing Civitas engine, questions, HUD, saving, modal,
// lives, collisions, and round-clear flow. The goal is to preview a
// Mario-like but visually unique history level with more route choice.
// ════════════════════════════════════════════════════════════════
const RUMOR_GREMLIN_SVG = `<svg viewBox="0 0 40 42" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="20" cy="25" rx="15" ry="13" fill="#5a4030" stroke="#1a0e08" stroke-width="1.5"/>
  <path d="M8 18 Q4 10 13 12" fill="#5a4030" stroke="#1a0e08" stroke-width="1.2"/>
  <path d="M32 18 Q36 10 27 12" fill="#5a4030" stroke="#1a0e08" stroke-width="1.2"/>
  <ellipse cx="15" cy="23" rx="3" ry="4" fill="#fce598"/><ellipse cx="25" cy="23" rx="3" ry="4" fill="#fce598"/>
  <circle cx="16" cy="24" r="1" fill="#1a0e08"/><circle cx="24" cy="24" r="1" fill="#1a0e08"/>
  <path d="M13 31 Q20 36 27 31" fill="none" stroke="#f0d4c4" stroke-width="2" stroke-linecap="round"/>
  <path d="M9 36 L5 42" stroke="#1a0e08" stroke-width="2"/><path d="M31 36 L35 42" stroke="#1a0e08" stroke-width="2"/>
  <path d="M9 15 Q20 2 31 15" fill="none" stroke="#a8202a" stroke-width="2" stroke-dasharray="3 2"/>
</svg>`;

const BIAS_BAT_SVG = `<svg viewBox="0 0 42 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 13 Q12 2 3 8 Q10 10 12 18 Q15 13 20 15" fill="#3a2a1a" stroke="#1a0e08" stroke-width="1.2"/>
  <path d="M22 13 Q30 2 39 8 Q32 10 30 18 Q27 13 22 15" fill="#3a2a1a" stroke="#1a0e08" stroke-width="1.2"/>
  <ellipse cx="21" cy="17" rx="9" ry="8" fill="#5a4030" stroke="#1a0e08" stroke-width="1.2"/>
  <path d="M14 10 L9 4 M28 10 L33 4" stroke="#a8202a" stroke-width="1.4" stroke-linecap="round"/>
  <circle cx="18" cy="16" r="2.2" fill="#fce598"/><circle cx="24" cy="16" r="2.2" fill="#fce598"/>
  <circle cx="18.5" cy="16.5" r=".8" fill="#1a0e08"/><circle cx="23.5" cy="16.5" r=".8" fill="#1a0e08"/>
  <path d="M17 23 Q21 26 25 23" fill="none" stroke="#f0d4c4" stroke-width="1.7" stroke-linecap="round"/>
  <rect x="16" y="1" width="10" height="5" rx="1" fill="#f5e8c4" stroke="#6a4a28" stroke-width=".8" transform="rotate(-8 21 3)"/>
  <path d="M18 3 L24 3" stroke="#a8202a" stroke-width=".7"/>
</svg>`;


function buildRound1_1_archiveQuestPrototype(refs){
  const area = refs.area;
  area.querySelectorAll('.platform, .deco-platform, .finish-platform, .pit, .coin, .enemy, .obstacle, .cannon, .cannonball, .cannonball-trail, .cannon-flash, .debris, .debris-warning, .castle-finish, .boss-health, .boss-shadow').forEach(el => el.remove());
  area.classList.add('theme-archivequest');

  const SPACING = 1430;
  const FIRST_X = 900;

  // Source Blocks: same question-gate logic, redesigned as historical source blocks.
  G.platforms = [];
  for(let i=0; i<8; i++){
    const worldX = FIRST_X + i * SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = 'SOURCE ' + (i+1);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({ el, lbl, worldX, idx:i, cleared:false, armed:true, width:86, height:86 });
  }

  // Finish: courthouse/debate stand vibe using existing grandstand parts.
  const fEl = document.createElement('div');
  fEl.className = 'finish-platform';
  fEl.innerHTML = `
    <div class="fp-post-l"></div><div class="fp-post-r"></div><div class="fp-bar"></div>
    <div class="fp-banner">ARCHIVE</div>
    <div class="fp-bunting"><div class="swag blue"></div><div class="swag white"></div><div class="swag red"></div><div class="swag white"></div><div class="swag blue"></div></div>
    <div class="fp-base"></div>`;
  area.appendChild(fEl);
  G.finishPlatform = { el:fEl, worldX: FINISH - 200, width:120, height:170 };

  // Wider, more meaningful gaps so route choice matters.
  G.pits = [
    { worldX: FIRST_X + SPACING * 1 + 840, width: 150 },
    { worldX: FIRST_X + SPACING * 3 + 760, width: 190 },
    { worldX: FIRST_X + SPACING * 5 + 620, width: 150 },
  ];
  G.pits.forEach(pit => {
    const el = document.createElement('div');
    el.className = 'pit';
    el.style.width = pit.width + 'px';
    area.appendChild(el);
    pit.el = el;
  });

  // Alternate paths: low route = easier jumps but more enemies/spikes; high route = platforming reward path.
  G.decoPlatforms = [];
  const decoSpec = [
    // Opening staircase into the first source block.
    { worldX:FIRST_X+360, width:95, height:26, bottomOffset:45 },
    { worldX:FIRST_X+560, width:95, height:26, bottomOffset:90 },
    // High path over the first rumor zone.
    { worldX:FIRST_X+SPACING*1+220, width:105, height:24, bottomOffset:115 },
    { worldX:FIRST_X+SPACING*1+440, width:105, height:24, bottomOffset:150 },
    { worldX:FIRST_X+SPACING*1+660, width:105, height:24, bottomOffset:115 },
    // Bridge over pit 1.
    { worldX:FIRST_X+SPACING*1+835, width:60, height:22, bottomOffset:70 },
    { worldX:FIRST_X+SPACING*1+925, width:60, height:22, bottomOffset:100 },
    { worldX:FIRST_X+SPACING*1+1015,width:60, height:22, bottomOffset:70 },
    // Mid-level split path: top route bypasses archive crates.
    { worldX:FIRST_X+SPACING*2+370, width:110, height:24, bottomOffset:135 },
    { worldX:FIRST_X+SPACING*2+610, width:110, height:24, bottomOffset:175 },
    { worldX:FIRST_X+SPACING*2+850, width:110, height:24, bottomOffset:135 },
    // Wide gap / rooftop route.
    { worldX:FIRST_X+SPACING*3+710, width:70, height:22, bottomOffset:80 },
    { worldX:FIRST_X+SPACING*3+820, width:70, height:22, bottomOffset:125 },
    { worldX:FIRST_X+SPACING*3+930, width:70, height:22, bottomOffset:80 },
    // Long optional balcony with seals.
    { worldX:FIRST_X+SPACING*4+250, width:120, height:24, bottomOffset:130 },
    { worldX:FIRST_X+SPACING*4+490, width:120, height:24, bottomOffset:165 },
    { worldX:FIRST_X+SPACING*4+730, width:120, height:24, bottomOffset:130 },
    // Final zig-zag: less linear end section.
    { worldX:FIRST_X+SPACING*6+250, width:85, height:24, bottomOffset:85 },
    { worldX:FIRST_X+SPACING*6+450, width:85, height:24, bottomOffset:145 },
    { worldX:FIRST_X+SPACING*6+650, width:85, height:24, bottomOffset:95 },
    { worldX:FIRST_X+SPACING*6+880, width:100,height:24, bottomOffset:155 },
  ];
  decoSpec.forEach(d => {
    const el = document.createElement('div');
    el.className = 'deco-platform archive-path';
    el.style.width = d.width + 'px';
    el.style.height = d.height + 'px';
    el.style.bottom = (GROUND_HEIGHT + d.bottomOffset) + 'px';
    area.appendChild(el);
    G.decoPlatforms.push({ el, worldX:d.worldX, width:d.width, height:d.height, bottomOffset:d.bottomOffset });
  });

  // Rumor gremlins use sentry mechanics but fit the history theme.
  G.enemies = [];
  const rawGremlins = [
    { worldX:FIRST_X+SPACING*1+350, patrolMin:FIRST_X+SPACING*1+180, patrolMax:FIRST_X+SPACING*1+760, vx:-1.35 },
    { worldX:FIRST_X+SPACING*2+330, patrolMin:FIRST_X+SPACING*2+180, patrolMax:FIRST_X+SPACING*2+560, vx:-1.45 },
    { worldX:FIRST_X+SPACING*4+500, patrolMin:FIRST_X+SPACING*4+260, patrolMax:FIRST_X+SPACING*4+900, vx:-1.55 },
    { worldX:FIRST_X+SPACING*6+520, patrolMin:FIRST_X+SPACING*6+300, patrolMax:FIRST_X+SPACING*6+920, vx:-1.65 },
  ];
  rawGremlins.forEach(sp => {
    const clamped = clampPatrolToPits(sp);
    const el = document.createElement('div');
    el.className = 'enemy sentry rumor-gremlin';
    el.innerHTML = RUMOR_GREMLIN_SVG;
    area.appendChild(el);
    G.enemies.push({ el, type:'sentry', worldX:clamped.worldX, vx:clamped.vx, patrolMin:clamped.patrolMin, patrolMax:clamped.patrolMax, dead:false });
  });

  // Archive crates = stand-on-able bigblocks; spikes are still quick hazard reads.
  G.obstacles = [];
  const obstacleSpec = [
    { type:'spike', worldX:FIRST_X+SPACING*0+760 },
    { type:'bigblock', worldX:FIRST_X+SPACING*2+700 },
    { type:'bigblock', worldX:FIRST_X+SPACING*2+775 },
    { type:'spike', worldX:FIRST_X+SPACING*2+940 },
    { type:'spike', worldX:FIRST_X+SPACING*3+520 },
    { type:'spike', worldX:FIRST_X+SPACING*3+580 },
    { type:'bigblock', worldX:FIRST_X+SPACING*5+230 },
    { type:'spike', worldX:FIRST_X+SPACING*5+370 },
    { type:'spike', worldX:FIRST_X+SPACING*6+1040 },
    { type:'spike', worldX:FIRST_X+SPACING*6+1100 },
  ];
  obstacleSpec.forEach(o => {
    if(G.pits.some(p => o.worldX > p.worldX - 45 && o.worldX < p.worldX + p.width + 45)) return;
    const el = document.createElement('div');
    el.className = 'obstacle ' + o.type + (o.type === 'bigblock' ? ' archive-crate' : '');
    area.appendChild(el);
    const w = o.type === 'spike' ? 34 : 54;
    const h = o.type === 'spike' ? 42 : 52;
    G.obstacles.push({ el, type:o.type, worldX:o.worldX, width:w, height:h });
  });

  // Gold Seals: ground path + high-route bonus trails.
  G.coins = [];
  const coinSpots = [];
  for(let i=0; i<7; i++){
    const baseX = FIRST_X + i * SPACING + 710;
    coinSpots.push({worldX:baseX, y:60},{worldX:baseX+34, y:60},{worldX:baseX+68, y:60});
  }
  [
    [1,250,140],[1,470,180],[1,690,140],
    [2,390,165],[2,630,205],[2,870,165],
    [4,285,160],[4,525,200],[4,765,160],
    [6,270,115],[6,470,175],[6,670,125],[6,900,185]
  ].forEach(([seg,off,y])=>coinSpots.push({worldX:FIRST_X+SPACING*seg+off,y}));
  coinSpots.forEach(c => {
    if(G.pits.some(p => c.worldX > p.worldX - 25 && c.worldX < p.worldX + p.width + 25 && c.y < 90)) return;
    const el = document.createElement('div');
    el.className = 'coin gold-seal';
    area.appendChild(el);
    G.coins.push({ el, worldX:c.worldX, y:c.y, collected:false });
  });

  // More stylized clouds.
  refs.skyClouds.innerHTML = '';
  for(let i=0; i<7; i++){
    const c = document.createElement('div');
    c.className = 'cloud';
    const w = 55 + Math.random() * 85;
    c.style.width = w + 'px';
    c.style.height = (w * 0.42) + 'px';
    c.style.left = (5 + Math.random() * 90) + '%';
    c.style.top = (4 + Math.random() * 34) + '%';
    refs.skyClouds.appendChild(c);
  }

  refs.msg.innerHTML = 'Archive Quest prototype: try the high routes for bonus seals, or stay low and fight through rumor gremlins.';
  refs.msg.classList.add('visible','prototype-note');
  setTimeout(() => refs.msg.classList.remove('visible','prototype-note'), 4200);
}


// ────────────────────────────────────────────────────────────────
// UNIT 1 POLISH PASS — keep 1-1, then make 1-2/1-3/1-4 match it.
// Fixes:
//   • Round 1-2/1-3/1-4 no longer visually rely on the old sentry enemy.
//   • Bias Bats are introduced clearly in 1-3 and return in the castle.
//   • Source Block / Gold Seal styling carries across Unit 1.
//   • Bonus seal trails snap above nearby platforms so they don't float awkwardly.
// ────────────────────────────────────────────────────────────────
function applyUnit1VisualPolish(refs, roundId){
  const area = refs.area;

  // All Unit 1 question gates should now read as Source Blocks.
  (G.platforms || []).forEach((p, i) => {
    p.el.classList.add('source-block');
    if(p.lbl){ p.lbl.textContent = 'SOURCE ' + (i + 1); }
  });

  // All collectibles become Gold Seals.
  (G.coins || []).forEach(c => c.el && c.el.classList.add('gold-seal'));

  // Fix misaligned floating seals: if a seal is intended as a platform reward,
  // place it just above the closest platform top instead of using hard-coded y.
  const platforms = (G.decoPlatforms || []).filter(Boolean);
  (G.coins || []).forEach(c => {
    let best = null;
    let bestDx = Infinity;
    for(const d of platforms){
      const left = d.worldX - 18;
      const right = d.worldX + d.width + 18;
      if(c.worldX >= left && c.worldX <= right){
        const center = d.worldX + d.width / 2;
        const dx = Math.abs(c.worldX - center);
        if(dx < bestDx){ best = d; bestDx = dx; }
      }
    }
    if(best && c.y > 80){
      c.y = best.bottomOffset + best.height + 14;
    }
  });
}

function makeRumorGremlinEnemy(area, sp){
  const clamped = clampPatrolToPits(sp);
  const el = document.createElement('div');
  el.className = 'enemy sentry rumor-gremlin';
  el.innerHTML = RUMOR_GREMLIN_SVG;
  area.appendChild(el);
  return {
    el, type:'sentry',
    worldX:clamped.worldX, vx:clamped.vx,
    patrolMin:clamped.patrolMin, patrolMax:clamped.patrolMax,
    dead:false
  };
}

function makeBiasBatEnemy(area, sp){
  const el = document.createElement('div');
  el.className = 'enemy bias-bat';
  el.innerHTML = BIAS_BAT_SVG;
  area.appendChild(el);
  return {
    el, type:'biasbat',
    worldX:sp.worldX,
    vx:sp.vx || -1.15,
    patrolMin:sp.patrolMin,
    patrolMax:sp.patrolMax,
    baseY:sp.baseY || 150,
    y:sp.baseY || 150,
    amp:sp.amp || 28,
    phase:sp.phase || 0,
    dead:false
  };
}

function replaceSentriesWithRumorGremlins(area, label){
  const updated = [];
  (G.enemies || []).forEach((e, idx) => {
    if(e.type === 'sentry'){
      if(e.el && e.el.parentNode) e.el.remove();
      updated.push(makeRumorGremlinEnemy(area, {
        worldX:e.worldX,
        patrolMin:e.patrolMin,
        patrolMax:e.patrolMax,
        vx:e.vx || -1.35
      }));
    }else{
      updated.push(e);
    }
  });
  G.enemies = updated;
}

function addRound13BiasBats(area){
  const FIRST_X = 900;
  const SPACING = 1350;
  const batSpecs = [
    { worldX:FIRST_X + SPACING*2 + 650, patrolMin:FIRST_X + SPACING*2 + 420, patrolMax:FIRST_X + SPACING*2 + 920, baseY:165, amp:34, vx:-1.05, phase:0.4 },
    { worldX:FIRST_X + SPACING*4 + 520, patrolMin:FIRST_X + SPACING*4 + 300, patrolMax:FIRST_X + SPACING*4 + 880, baseY:190, amp:38, vx:-1.20, phase:1.8 },
    { worldX:FIRST_X + SPACING*6 + 650, patrolMin:FIRST_X + SPACING*6 + 420, patrolMax:FIRST_X + SPACING*6 + 980, baseY:155, amp:30, vx:-1.15, phase:2.7 },
  ];
  batSpecs.forEach(sp => G.enemies.push(makeBiasBatEnemy(area, sp)));
}

function addRound14BiasBats(area){
  const FIRST_X = 900;
  const SPACING = 1080;
  const batSpecs = [
    { worldX:FIRST_X + SPACING*3 + 520, patrolMin:FIRST_X + SPACING*3 + 280, patrolMax:FIRST_X + SPACING*3 + 820, baseY:170, amp:30, vx:-1.2, phase:1.1 },
    { worldX:FIRST_X + SPACING*7 + 450, patrolMin:FIRST_X + SPACING*7 + 230, patrolMax:FIRST_X + SPACING*7 + 760, baseY:190, amp:36, vx:-1.25, phase:2.2 },
  ];
  batSpecs.forEach(sp => G.enemies.push(makeBiasBatEnemy(area, sp)));
}

function convertCastleSentriesToRedeemers(area){
  // v3: remove the old Lincoln/top-hat style ground enemies from the castle.
  // Ground patrols now become Backlash Gremlins so 1-4 visually matches the
  // redesigned history-fantasy enemy set instead of the original sentries.
  const updated = [];
  (G.enemies || []).forEach((e) => {
    if(e.type === 'sentry' || e.type === 'redeemer'){
      if(e.el && e.el.parentNode) e.el.remove();
      const clamped = clampPatrolToPits({
        worldX:e.worldX,
        patrolMin:e.patrolMin || e.worldX - 120,
        patrolMax:e.patrolMax || e.worldX + 120,
        vx:e.vx || -1.25
      });
      const el = document.createElement('div');
      el.className = 'enemy sentry rumor-gremlin backlash-gremlin';
      el.innerHTML = RUMOR_GREMLIN_SVG;
      area.appendChild(el);
      updated.push({
        el, type:'sentry',
        worldX:clamped.worldX, vx:Math.max(-1.35, Math.min(1.35, clamped.vx)),
        patrolMin:clamped.patrolMin, patrolMax:clamped.patrolMax,
        dead:false
      });
    }else{
      updated.push(e);
    }
  });
  G.enemies = updated;
}



function createWorld2SourceSafeZones(options){
  // Gameplay comfort pass: Source Blocks should feel like short reprieves.
  // Keep enemies, shooters, steam, and spikes away from the question boxes so
  // students are not hit immediately after answering.
  options = options || {};
  const before = options.before || 260;
  const after = options.after || 430;
  const platforms = (G.platforms || []).filter(p => p && typeof p.worldX === 'number');
  if(!platforms.length) return;
  function overlapsSafeZone(minX, maxX){
    return platforms.some(p => {
      const safeMin = p.worldX - before;
      const safeMax = p.worldX + (p.width || 86) + after;
      return maxX >= safeMin && minX <= safeMax;
    });
  }
  function removeEl(obj){
    if(obj && obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
  }

  G.enemies = (G.enemies || []).filter(e => {
    const minX = Math.min(e.patrolMin ?? e.worldX, e.worldX);
    const maxX = Math.max(e.patrolMax ?? (e.worldX + (e.width || 40)), e.worldX + (e.width || 40));
    const keep = !overlapsSafeZone(minX, maxX);
    if(!keep) removeEl(e);
    return keep;
  });

  G.obstacles = (G.obstacles || []).filter(o => {
    const keep = !overlapsSafeZone(o.worldX - 20, o.worldX + (o.width || 46) + 20);
    if(!keep) removeEl(o);
    return keep;
  });

  G.cannons = (G.cannons || []).filter(c => {
    const keep = !overlapsSafeZone(c.worldX - 90, c.worldX + 160);
    if(!keep) removeEl(c);
    return keep;
  });
}

function normalizeGoldSealAlignment(){
  // v3: platform reward seals now snap to the centerline of the platform
  // they belong to, then spread evenly. This fixes the awkward off-center
  // floating clusters on the small stepping stones.
  const platforms = (G.decoPlatforms || []).filter(d => d && typeof d.worldX === 'number');
  if(!platforms.length || !G.coins) return;
  const groups = new Map();
  (G.coins || []).forEach(c => {
    if(!c || c.collected || c.y <= 80) return;
    let best = null;
    let bestScore = Infinity;
    for(const d of platforms){
      const center = d.worldX + d.width / 2;
      const dx = Math.abs(c.worldX - center);
      const within = c.worldX >= d.worldX - 90 && c.worldX <= d.worldX + d.width + 90;
      if(within && dx < bestScore){ best = d; bestScore = dx; }
    }
    if(!best) return;
    const key = best.worldX + ':' + best.width + ':' + best.bottomOffset;
    if(!groups.has(key)) groups.set(key, { platform: best, coins: [] });
    groups.get(key).coins.push(c);
  });
  groups.forEach(group => {
    const d = group.platform;
    const topY = d.bottomOffset + d.height;
    const center = d.worldX + d.width / 2;
    const coins = group.coins.sort((a,b)=>a.worldX-b.worldX).slice(0,5);
    const gap = Math.min(34, Math.max(26, d.width / Math.max(1, coins.length)));
    coins.forEach((c, i) => {
      c.worldX = center + (i - (coins.length - 1) / 2) * gap;
      c.y = topY + 18;
    });
  });
}

// Save the original authored builders, then wrap them.
const ORIGINAL_BUILDERS_UNIT1 = {
  '1-2': buildRound1_2,
  '1-3': buildRound1_3,
  '1-4': buildRound1_4_castle,
};

function buildRound1_2_polished(refs){
  ORIGINAL_BUILDERS_UNIT1['1-2'](refs);
  const area = refs.area;
  replaceSentriesWithRumorGremlins(area, '1-2');
  applyUnit1VisualPolish(refs, '1-2');
  normalizeGoldSealAlignment();
  refs.msg.textContent = 'Round 1-2 adds cannons: low shots must be jumped, high shots must be ducked.';
  refs.msg.classList.add('visible');
  setTimeout(() => refs.msg.classList.remove('visible'), 3400);
}

function buildRound1_3_polished(refs){
  ORIGINAL_BUILDERS_UNIT1['1-3'](refs);
  const area = refs.area;
  replaceSentriesWithRumorGremlins(area, '1-3');
  addRound13BiasBats(area);
  applyUnit1VisualPolish(refs, '1-3');
  normalizeGoldSealAlignment();
  refs.msg.textContent = 'New enemy: Bias Bats fly in a wave pattern. Watch the air, not just the ground.';
  refs.msg.classList.add('visible');
  setTimeout(() => refs.msg.classList.remove('visible'), 3800);
}

function buildRound1_4_castle_polished(refs){
  ORIGINAL_BUILDERS_UNIT1['1-4'](refs);
  const area = refs.area;
  convertCastleSentriesToRedeemers(area);
  addRound14BiasBats(area);
  applyUnit1VisualPolish(refs, '1-4');
  normalizeGoldSealAlignment();
  if(G.boss){
    // v3: clean boss arena. Once the player reaches the final stretch,
    // the only challenge should be the boss, not a spike/enemy/projectile pileup.
    const arenaStart = G.boss.worldX - 760;
    G.obstacles = (G.obstacles || []).filter(o => {
      const keep = o.worldX < arenaStart;
      if(!keep && o.el && o.el.parentNode) o.el.remove();
      return keep;
    });
    G.enemies = (G.enemies || []).filter(e => {
      const keep = e.worldX < arenaStart || e.type === 'biasbat';
      if(!keep && e.el && e.el.parentNode) e.el.remove();
      return keep;
    });
    G.boss.health = 4;
    G.boss.maxHealth = 4;
    G.boss.nextJumpAt = Date.now() + 2200;
    G.boss.nextShotAt = Date.now() + 3200;
    if(G.boss.healthFill) G.boss.healthFill.style.width = '100%';
    const label = G.boss.healthEl && G.boss.healthEl.querySelector('.boss-health-label');
    if(label) label.textContent = 'RESISTANCE';
  }
  refs.msg.textContent = 'Castle boss: Resistance jumps, lands with shockwaves, and fires high/low policy attacks.';
  refs.msg.classList.add('visible');
  setTimeout(() => refs.msg.classList.remove('visible'), 4200);
}

// Patch all Unit 1 builders before boot.
if(typeof ROUND_BUILDERS !== 'undefined'){
  ROUND_BUILDERS['1-1'] = buildRound1_1_archiveQuestPrototype;
  ROUND_BUILDERS['1-2'] = buildRound1_2_polished;
  ROUND_BUILDERS['1-3'] = buildRound1_3_polished;
  ROUND_BUILDERS['1-4'] = buildRound1_4_castle_polished;
}



// ════════════════════════════════════════════════════════════════
// WORLD 2 PROTOTYPE — The Gilded Machine, Round 2-1 only
// Gameplay-first draft with placeholder Source Block questions.
// ════════════════════════════════════════════════════════════════
const TRUST_GOBLIN_SVG = `<svg viewBox="0 0 42 54" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="21" cy="52" rx="15" ry="2" fill="rgba(0,0,0,.32)"/>
  <rect x="11" y="36" width="7" height="15" rx="1" fill="#221815"/><rect x="24" y="36" width="7" height="15" rx="1" fill="#221815"/>
  <ellipse cx="14" cy="51" rx="5" ry="1.7" fill="#0b0706"/><ellipse cx="28" cy="51" rx="5" ry="1.7" fill="#0b0706"/>
  <path d="M9 18 Q9 10 21 10 Q33 10 33 18 L35 36 Q35 39 31 39 L11 39 Q7 39 7 36 Z" fill="#4b2e20" stroke="#160d09" stroke-width=".8"/>
  <path d="M12 18 L21 31 L30 18 L27 38 L15 38 Z" fill="#1c1512" opacity=".95"/>
  <path d="M16 18 L21 27 L26 18" fill="#efe6d0" stroke="#b79b72" stroke-width=".35"/>
  <circle cx="21" cy="30" r="2.1" fill="#d6a543" stroke="#4b2e10" stroke-width=".4"/>
  <path d="M7 22 L2 28 L4 31 L10 27 Z" fill="#4b2e20" stroke="#160d09" stroke-width=".5"/>
  <path d="M35 22 L40 28 L38 31 L32 27 Z" fill="#4b2e20" stroke="#160d09" stroke-width=".5"/>
  <ellipse cx="21" cy="11" rx="8" ry="7" fill="#d0a47c" stroke="#5a3820" stroke-width=".5"/>
  <path d="M14 12 Q17 17 21 17 Q25 17 28 12" fill="#8b5e38" opacity=".55"/>
  <ellipse cx="18" cy="10" rx=".8" ry="1" fill="#120907"/><ellipse cx="24" cy="10" rx=".8" ry="1" fill="#120907"/>
  <path d="M17 14 Q21 12 25 14" stroke="#3a2012" stroke-width=".7" fill="none"/>
  <ellipse cx="21" cy="5" rx="11" ry="1.6" fill="#111"/>
  <rect x="13" y="-2" width="16" height="8" rx="1" fill="#111" stroke="#000" stroke-width=".4"/>
  <rect x="13" y="4" width="16" height="1.3" fill="#7b4d18"/>
  <rect x="30" y="20" width="7" height="10" rx="1" fill="#c49a49" stroke="#4b2e10" stroke-width=".4"/>
  <text x="33.5" y="27.5" text-anchor="middle" font-size="6" font-family="serif" fill="#3a2208">$</text>
</svg>`;

function makeTrustGoblinEnemy(area, sp){
  const clamped = clampPatrolToPits(sp);
  const el = document.createElement('div');
  el.className = 'enemy sentry trust-goblin';
  el.innerHTML = TRUST_GOBLIN_SVG;
  area.appendChild(el);
  return { el, type:'sentry', worldX:clamped.worldX, vx:clamped.vx || -1.05, patrolMin:clamped.patrolMin, patrolMax:clamped.patrolMax, dead:false };
}

function addPlaceholderQuestionsForWorld2(){
  QUESTION_BANK['2-1'] = Array.from({length:12}, (_,i)=>({
    id:'2-1-Q'+(i+1),
    stem:'Placeholder Source Block 2-1' + String.fromCharCode(65+i) + ': This will become a Gilded Age question later. For now, choose the answer that says “prototype.”',
    choices:[
      'Prototype answer — correct for gameplay testing',
      'Distractor answer — railroad vocabulary placeholder',
      'Distractor answer — factory vocabulary placeholder',
      'Distractor answer — labor vocabulary placeholder'
    ],
    correctIdx:0,
    explain:'Prototype feedback: later this will explain the actual Gilded Age concept.'
  }));
  QUESTION_BANK['2-2'] = Array.from({length:12}, (_,i)=>({
    id:'2-2-Q'+(i+1),
    stem:'Placeholder Source Block 2-2' + String.fromCharCode(65+i) + ': Labor and Unrest question placeholder. Choose the answer that says “prototype” to keep testing gameplay.',
    choices:[
      'Prototype answer — correct for gameplay testing',
      'Distractor answer — strike vocabulary placeholder',
      'Distractor answer — union vocabulary placeholder',
      'Distractor answer — Pinkerton vocabulary placeholder'
    ],
    correctIdx:0,
    explain:'Prototype feedback: later this will explain labor unions, strikes, Pinkertons, working conditions, or industrial conflict.'
  }));
}

function unlockWorld2Prototype(){
  const w = WORLDS.find(x => x.id === 'unit2');
  if(!w) return;
  w.title = 'The Gilded Machine';
  w.years = '1865 - 1900';
  w.eraColor = '#7a5018';
  w.iconKey = 'factory';
  w.intro = 'Factories, railroads, cities, labor conflict, trusts, and political machines reshape American life.';
  w.unlocked = true;
  w.comingSoon = false;
  w.rounds = [
    {id:'2-1', num:'2-1', title:'Rails and Factories', sub:'Industrial growth, railroads, and trusts', sampleSize:8},
    {id:'2-2', num:'2-2', title:'Labor and Unrest', sub:'Strikes, unions, Pinkertons, and factory danger', sampleSize:8}
  ];
}

function buildRound2_1_gildedPrototype(refs){
  const area = refs.area;
  area.querySelectorAll('.platform, .deco-platform, .finish-platform, .pit, .coin, .enemy, .obstacle, .cannon, .cannonball, .cannonball-trail, .cannon-flash, .debris, .debris-warning, .castle-finish, .boss-health, .boss-shadow').forEach(el => el.remove());
  area.classList.add('theme-gilded');
  area.classList.remove('theme-battlefield','theme-postwar','theme-castle','theme-archivequest','theme-gilded-rails','theme-gilded-labor','theme-gilded-city','theme-gilded-machine');

  const SPACING = 1280;
  const FIRST_X = 850;

  // 8 Source Blocks, but the spaces between them are now real platforming rooms.
  G.platforms = [];
  for(let i=0;i<8;i++){
    const worldX = FIRST_X + i*SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block industrial-source';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = 'SOURCE ' + (i+1);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({el,lbl,worldX,idx:i,cleared:false,armed:true,width:86,height:86});
  }

  const fEl = document.createElement('div');
  fEl.className = 'finish-platform';
  fEl.innerHTML = `<div class="fp-post-l"></div><div class="fp-post-r"></div><div class="fp-bar"></div>
    <div class="fp-banner">SHIFT BELL</div>
    <div class="fp-bunting"><div class="swag red"></div><div class="swag white"></div><div class="swag blue"></div><div class="swag white"></div><div class="swag red"></div></div>
    <div class="fp-base"></div>`;
  area.appendChild(fEl);
  G.finishPlatform = {el:fEl, worldX:FINISH-220, width:120, height:170};

  // Bigger gaps: 2-1 is still early, but no longer just flat running.
  G.pits = [
    {worldX:FIRST_X+SPACING*1+650,width:170},
    {worldX:FIRST_X+SPACING*2+690,width:210},
    {worldX:FIRST_X+SPACING*3+610,width:185},
    {worldX:FIRST_X+SPACING*5+640,width:230},
    {worldX:FIRST_X+SPACING*6+700,width:190}
  ];
  G.pits.forEach(p=>{const el=document.createElement('div');el.className='pit';el.style.width=p.width+'px';area.appendChild(el);p.el=el;});

  G.decoPlatforms = [];
  const decoSpec = [
    // Opening: simple two-step warmup.
    {worldX:FIRST_X+270,width:120,height:24,bottomOffset:58},{worldX:FIRST_X+505,width:110,height:24,bottomOffset:112},
    // First pit: three timed beams, with seals above the high route.
    {worldX:FIRST_X+SPACING*1+475,width:74,height:22,bottomOffset:78,hard:true},{worldX:FIRST_X+SPACING*1+600,width:70,height:22,bottomOffset:126,hard:true},{worldX:FIRST_X+SPACING*1+735,width:72,height:22,bottomOffset:82,hard:true},
    // Factory catwalk: high route over enemies.
    {worldX:FIRST_X+SPACING*2+210,width:125,height:24,bottomOffset:122},{worldX:FIRST_X+SPACING*2+420,width:105,height:24,bottomOffset:176,hard:true},{worldX:FIRST_X+SPACING*2+585,width:85,height:22,bottomOffset:136,hard:true},{worldX:FIRST_X+SPACING*2+825,width:82,height:22,bottomOffset:92,hard:true},
    // Steam room: low route is risky, upper route requires jumps.
    {worldX:FIRST_X+SPACING*3+235,width:100,height:24,bottomOffset:95},{worldX:FIRST_X+SPACING*3+395,width:92,height:24,bottomOffset:148,hard:true},{worldX:FIRST_X+SPACING*3+555,width:86,height:22,bottomOffset:198,hard:true},{worldX:FIRST_X+SPACING*3+730,width:90,height:22,bottomOffset:138,hard:true},
    // Rooftop run.
    {worldX:FIRST_X+SPACING*4+230,width:150,height:26,bottomOffset:135},{worldX:FIRST_X+SPACING*4+510,width:120,height:26,bottomOffset:184},{worldX:FIRST_X+SPACING*4+760,width:145,height:26,bottomOffset:128},
    // Long pit and smoke cloud section.
    {worldX:FIRST_X+SPACING*5+410,width:80,height:22,bottomOffset:88,hard:true},{worldX:FIRST_X+SPACING*5+555,width:72,height:22,bottomOffset:132,hard:true},{worldX:FIRST_X+SPACING*5+720,width:74,height:22,bottomOffset:178,hard:true},{worldX:FIRST_X+SPACING*5+895,width:90,height:22,bottomOffset:120,hard:true},
    // Final skill staircase.
    {worldX:FIRST_X+SPACING*6+230,width:92,height:22,bottomOffset:88,hard:true},{worldX:FIRST_X+SPACING*6+390,width:86,height:22,bottomOffset:138,hard:true},{worldX:FIRST_X+SPACING*6+555,width:80,height:22,bottomOffset:190,hard:true},{worldX:FIRST_X+SPACING*6+775,width:86,height:22,bottomOffset:145,hard:true},{worldX:FIRST_X+SPACING*6+950,width:120,height:24,bottomOffset:98}
  ];
  decoSpec.forEach(d=>{const el=document.createElement('div');el.className='deco-platform rail-beam'+(d.hard?' danger-step':'');el.style.width=d.width+'px';el.style.height=d.height+'px';el.style.bottom=(GROUND_HEIGHT+d.bottomOffset)+'px';area.appendChild(el);G.decoPlatforms.push({el,worldX:d.worldX,width:d.width,height:d.height,bottomOffset:d.bottomOffset});});

  G.enemies = [];
  // Slow monopoly/trust enemies first.
  [
    {worldX:FIRST_X+SPACING*1+270,patrolMin:FIRST_X+SPACING*1+120,patrolMax:FIRST_X+SPACING*1+455,vx:-1.05},
    {worldX:FIRST_X+SPACING*2+700,patrolMin:FIRST_X+SPACING*2+525,patrolMax:FIRST_X+SPACING*2+995,vx:-1.12},
    {worldX:FIRST_X+SPACING*4+650,patrolMin:FIRST_X+SPACING*4+420,patrolMax:FIRST_X+SPACING*4+935,vx:-1.18}
  ].forEach(sp=>G.enemies.push(makeTrustGoblinEnemy(area,sp)));

  // Faster Pinkerton Guard: same collision rules, new speed/visual.
  [
    {worldX:FIRST_X+SPACING*3+500,patrolMin:FIRST_X+SPACING*3+225,patrolMax:FIRST_X+SPACING*3+790,vx:-1.72},
    {worldX:FIRST_X+SPACING*6+450,patrolMin:FIRST_X+SPACING*6+210,patrolMax:FIRST_X+SPACING*6+625,vx:-1.85}
  ].forEach(sp=>G.enemies.push(makePinkertonGuardEnemy(area,sp)));

  // Smoke Clouds: flying hazard, introduces vertical timing without needing 2-3 yet.
  [
    {worldX:FIRST_X+SPACING*2+455,patrolMin:FIRST_X+SPACING*2+360,patrolMax:FIRST_X+SPACING*2+720,vx:.72,baseY:155,amp:34,phase:0},
    {worldX:FIRST_X+SPACING*5+690,patrolMin:FIRST_X+SPACING*5+500,patrolMax:FIRST_X+SPACING*5+940,vx:.8,baseY:165,amp:42,phase:1.8},
    {worldX:FIRST_X+SPACING*6+820,patrolMin:FIRST_X+SPACING*6+690,patrolMax:FIRST_X+SPACING*6+1020,vx:-.75,baseY:135,amp:28,phase:3.1}
  ].forEach(sp=>G.enemies.push(makeSmokeCloudEnemy(area,sp)));

  G.obstacles = [];
  [
    {type:'steam-vent',worldX:FIRST_X+SPACING*0+690,width:42,height:46,phase:0},
    {type:'spike',worldX:FIRST_X+SPACING*1+900,width:34,height:42},
    {type:'steam-vent',worldX:FIRST_X+SPACING*2+345,width:42,height:46,phase:430},
    {type:'bigblock',worldX:FIRST_X+SPACING*2+980,width:54,height:52},
    {type:'steam-vent',worldX:FIRST_X+SPACING*3+330,width:42,height:46,phase:900},
    {type:'steam-vent',worldX:FIRST_X+SPACING*3+650,width:42,height:46,phase:1300},
    {type:'spike',worldX:FIRST_X+SPACING*4+965,width:34,height:42},
    {type:'steam-vent',worldX:FIRST_X+SPACING*5+990,width:42,height:46,phase:250},
    {type:'bigblock',worldX:FIRST_X+SPACING*6+1085,width:54,height:52}
  ].forEach(o=>{if(G.pits.some(p=>o.worldX>p.worldX-45&&o.worldX<p.worldX+p.width+45))return;const el=document.createElement('div');el.className='obstacle '+o.type+(o.type==='bigblock'?' archive-crate':'')+(o.type==='steam-vent'?' hazard':'');area.appendChild(el);G.obstacles.push({el,type:o.type,worldX:o.worldX,width:o.width,height:o.height,phase:o.phase||0});});

  G.coins = [];
  const coinSpots = [];
  // Low-route rewards after Source Blocks.
  for(let i=0;i<7;i++){const bx=FIRST_X+i*SPACING+540;coinSpots.push({worldX:bx,y:62},{worldX:bx+34,y:62},{worldX:bx+68,y:62});}
  // High-route rewards over tricky beams.
  decoSpec.filter(d=>d.hard).forEach(d=>{
    coinSpots.push({worldX:d.worldX+d.width/2-30,y:d.bottomOffset+d.height+34},{worldX:d.worldX+d.width/2,y:d.bottomOffset+d.height+38},{worldX:d.worldX+d.width/2+30,y:d.bottomOffset+d.height+34});
  });
  coinSpots.forEach(c=>{if(G.pits.some(p=>c.worldX>p.worldX-25&&c.worldX<p.worldX+p.width+25&&c.y<90))return;const el=document.createElement('div');el.className='coin gold-seal gilded-token';area.appendChild(el);G.coins.push({el,worldX:c.worldX,y:c.y,collected:false});});
  createWorld2SourceSafeZones({before:260, after:430});
  normalizeGoldSealAlignment();

  refs.skyClouds.innerHTML='';
  for(let i=0;i<11;i++){const c=document.createElement('div');c.className='cloud';const w=45+Math.random()*105;c.style.width=w+'px';c.style.height=(w*.35)+'px';c.style.left=(3+Math.random()*94)+'%';c.style.top=(2+Math.random()*38)+'%';refs.skyClouds.appendChild(c);}

  refs.msg.textContent='2-1 Boomtown Frontier: rails, smokestacks, timed steam, Pinkerton Guards, and Smoke Clouds.';
  refs.msg.classList.add('visible','prototype-note');
  setTimeout(()=>refs.msg.classList.remove('visible','prototype-note'),4800);
}

// Faster ground enemy for World 2.
const PINKERTON_GUARD_SVG = `<svg viewBox="0 0 38 52" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="19" cy="50" rx="14" ry="2" fill="rgba(0,0,0,.32)"/>
  <rect x="10" y="35" width="7" height="15" rx="1" fill="#1d2326"/><rect x="22" y="35" width="7" height="15" rx="1" fill="#1d2326"/>
  <path d="M8 17 Q8 11 19 11 Q30 11 30 17 L33 36 Q33 39 29 39 L9 39 Q5 39 5 36 Z" fill="#24333a" stroke="#0c1012" stroke-width=".8"/>
  <path d="M12 18 L19 31 L26 18 L27 38 L11 38 Z" fill="#111719" opacity=".95"/>
  <path d="M14 18 L19 27 L24 18" fill="#efe6d0" stroke="#9a8d72" stroke-width=".35"/>
  <circle cx="19" cy="30" r="2" fill="#c6a052" stroke="#33230a" stroke-width=".4"/>
  <path d="M7 22 L1 25 L3 29 L9 27 Z" fill="#24333a" stroke="#0c1012" stroke-width=".5"/>
  <path d="M31 22 L37 25 L35 29 L29 27 Z" fill="#24333a" stroke="#0c1012" stroke-width=".5"/>
  <ellipse cx="19" cy="11" rx="8" ry="7" fill="#d4a17a" stroke="#5a3820" stroke-width=".5"/>
  <ellipse cx="16" cy="10" rx=".8" ry="1" fill="#120907"/><ellipse cx="22" cy="10" rx=".8" ry="1" fill="#120907"/>
  <path d="M15 14 Q19 16 23 14" stroke="#3a2012" stroke-width=".7" fill="none"/>
  <path d="M9 5 L29 5 L24 0 L14 0 Z" fill="#1c2529" stroke="#000" stroke-width=".4"/>
  <rect x="8" y="5" width="22" height="2" fill="#0e1214"/>
  <rect x="29" y="24" width="7" height="3" rx="1" fill="#6f4a2a"/>
</svg>`;
function makePinkertonGuardEnemy(area, sp){
  const clamped = clampPatrolToPits(sp);
  const el = document.createElement('div');
  el.className = 'enemy sentry pinkerton-guard';
  el.innerHTML = PINKERTON_GUARD_SVG;
  area.appendChild(el);
  return { el, type:'sentry', worldX:clamped.worldX, vx:clamped.vx || -1.7, patrolMin:clamped.patrolMin, patrolMax:clamped.patrolMax, dead:false };
}

const SMOKE_CLOUD_SVG = `<svg viewBox="0 0 48 34" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="24" cy="29" rx="18" ry="3" fill="rgba(0,0,0,.18)"/>
  <circle cx="13" cy="19" r="9" fill="#7f7773" stroke="#322b2b" stroke-width=".6"/>
  <circle cx="23" cy="13" r="11" fill="#9a918b" stroke="#322b2b" stroke-width=".6"/>
  <circle cx="34" cy="19" r="9" fill="#746d6a" stroke="#322b2b" stroke-width=".6"/>
  <ellipse cx="24" cy="22" rx="19" ry="10" fill="#8c837e" stroke="#322b2b" stroke-width=".6"/>
  <ellipse cx="20" cy="19" rx="2" ry="2.5" fill="#2b2220"/><ellipse cx="29" cy="19" rx="2" ry="2.5" fill="#2b2220"/>
  <path d="M19 24 Q24 27 30 24" stroke="#2b2220" stroke-width="1.1" fill="none"/>
  <path d="M8 8 Q14 1 20 6" stroke="#c8c0b8" stroke-width="2" fill="none" opacity=".5"/>
  <path d="M30 5 Q39 0 43 8" stroke="#c8c0b8" stroke-width="2" fill="none" opacity=".45"/>
</svg>`;
function makeSmokeCloudEnemy(area, sp){
  const clamped = clampPatrolToPits(sp);
  const el = document.createElement('div');
  el.className = 'enemy bias-bat smoke-cloud';
  el.innerHTML = SMOKE_CLOUD_SVG;
  area.appendChild(el);
  return {
    el, type:'biasbat', worldX:clamped.worldX, vx:clamped.vx || .75,
    patrolMin:clamped.patrolMin, patrolMax:clamped.patrolMax,
    baseY:sp.baseY || 150, amp:sp.amp || 32, phase:sp.phase || 0, y:sp.baseY || 150,
    dead:false
  };
}


const GEAR_RAT_SVG = `<svg viewBox="0 0 40 34" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="20" cy="32" rx="15" ry="2" fill="rgba(0,0,0,.28)"/>
  <path d="M7 22 Q8 11 22 12 Q33 13 35 22 Q32 30 18 29 Q8 28 7 22 Z" fill="#4d403c" stroke="#171211" stroke-width=".7"/>
  <path d="M8 20 L2 17 L6 24 Z" fill="#4d403c" stroke="#171211" stroke-width=".6"/>
  <circle cx="28" cy="18" r="1.3" fill="#120907"/>
  <path d="M35 22 Q41 20 39 16" stroke="#4d403c" stroke-width="2" fill="none"/>
  <circle cx="15" cy="27" r="3" fill="#191615"/><circle cx="29" cy="27" r="3" fill="#191615"/>
  <path d="M13 8 L18 8 L20 3 L23 8 L28 8 L24 12 L26 17 L20 14 L14 17 L16 12 Z" fill="#d99a35" stroke="#3a2208" stroke-width=".45" opacity=".95"/>
</svg>`;
function makeGearRatEnemy(area, sp){
  const clamped = clampPatrolToPits(sp);
  const el = document.createElement('div');
  el.className = 'enemy sentry gear-rat';
  el.innerHTML = GEAR_RAT_SVG;
  area.appendChild(el);
  return { el, type:'sentry', worldX:clamped.worldX, vx:clamped.vx || -2.05, patrolMin:clamped.patrolMin, patrolMax:clamped.patrolMax, dead:false };
}

function clearGildedArea(refs){
  const area = refs.area;
  area.querySelectorAll('.platform, .deco-platform, .finish-platform, .pit, .coin, .enemy, .obstacle, .cannon, .cannonball, .cannonball-trail, .cannon-flash, .debris, .debris-warning, .castle-finish, .boss-health, .boss-shadow').forEach(el => el.remove());
  area.classList.add('theme-gilded');
  area.classList.remove('theme-battlefield','theme-postwar','theme-castle','theme-archivequest','theme-gilded-rails','theme-gilded-labor','theme-gilded-city','theme-gilded-machine');
}

function buildRound2_2_laborUnrest(refs){
  const area = refs.area;
  clearGildedArea(refs);
  area.classList.add('theme-gilded-labor');
  const SPACING = 1340;
  const FIRST_X = 860;

  G.platforms = [];
  for(let i=0;i<8;i++){
    const worldX = FIRST_X + i*SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block industrial-source';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = 'SOURCE ' + (i+1);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({el,lbl,worldX,idx:i,cleared:false,armed:true,width:86,height:86});
  }

  const fEl = document.createElement('div');
  fEl.className = 'finish-platform';
  fEl.innerHTML = `<div class="fp-post-l"></div><div class="fp-post-r"></div><div class="fp-bar"></div>
    <div class="fp-banner">UNION HALL</div>
    <div class="fp-bunting"><div class="swag blue"></div><div class="swag white"></div><div class="swag red"></div><div class="swag white"></div><div class="swag blue"></div></div>
    <div class="fp-base"></div>`;
  area.appendChild(fEl);
  G.finishPlatform = {el:fEl, worldX:FINISH-220, width:120, height:170};

  G.pits = [
    {worldX:FIRST_X+SPACING*0+840,width:135},
    {worldX:FIRST_X+SPACING*1+585,width:205},
    {worldX:FIRST_X+SPACING*2+610,width:240},
    {worldX:FIRST_X+SPACING*3+760,width:185},
    {worldX:FIRST_X+SPACING*4+590,width:255},
    {worldX:FIRST_X+SPACING*5+725,width:225},
    {worldX:FIRST_X+SPACING*6+610,width:210}
  ];
  G.pits.forEach(p=>{const el=document.createElement('div');el.className='pit';el.style.width=p.width+'px';area.appendChild(el);p.el=el;});

  G.decoPlatforms = [];
  const decoSpec = [
    {worldX:FIRST_X+300,width:92,height:22,bottomOffset:72,hard:true},{worldX:FIRST_X+470,width:82,height:22,bottomOffset:124,hard:true},{worldX:FIRST_X+635,width:96,height:22,bottomOffset:82,hard:true},
    {worldX:FIRST_X+SPACING*1+350,width:92,height:22,bottomOffset:78,hard:true},{worldX:FIRST_X+SPACING*1+510,width:78,height:22,bottomOffset:132,hard:true},{worldX:FIRST_X+SPACING*1+675,width:82,height:22,bottomOffset:182,hard:true},{worldX:FIRST_X+SPACING*1+850,width:105,height:22,bottomOffset:118,hard:true},
    {worldX:FIRST_X+SPACING*2+240,width:125,height:24,bottomOffset:108},{worldX:FIRST_X+SPACING*2+450,width:92,height:22,bottomOffset:168,hard:true},{worldX:FIRST_X+SPACING*2+610,width:70,height:22,bottomOffset:220,hard:true},{worldX:FIRST_X+SPACING*2+780,width:88,height:22,bottomOffset:160,hard:true},{worldX:FIRST_X+SPACING*2+965,width:132,height:24,bottomOffset:96},
    {worldX:FIRST_X+SPACING*3+235,width:112,height:24,bottomOffset:94},{worldX:FIRST_X+SPACING*3+415,width:82,height:22,bottomOffset:154,hard:true},{worldX:FIRST_X+SPACING*3+575,width:82,height:22,bottomOffset:205,hard:true},{worldX:FIRST_X+SPACING*3+760,width:96,height:22,bottomOffset:145,hard:true},{worldX:FIRST_X+SPACING*3+940,width:118,height:24,bottomOffset:88},
    {worldX:FIRST_X+SPACING*4+260,width:132,height:24,bottomOffset:126},{worldX:FIRST_X+SPACING*4+485,width:94,height:22,bottomOffset:188,hard:true},{worldX:FIRST_X+SPACING*4+660,width:72,height:22,bottomOffset:242,hard:true},{worldX:FIRST_X+SPACING*4+850,width:96,height:22,bottomOffset:176,hard:true},{worldX:FIRST_X+SPACING*4+1030,width:120,height:24,bottomOffset:112},
    {worldX:FIRST_X+SPACING*5+275,width:102,height:22,bottomOffset:78,hard:true},{worldX:FIRST_X+SPACING*5+455,width:86,height:22,bottomOffset:132,hard:true},{worldX:FIRST_X+SPACING*5+620,width:78,height:22,bottomOffset:186,hard:true},{worldX:FIRST_X+SPACING*5+805,width:94,height:22,bottomOffset:138,hard:true},{worldX:FIRST_X+SPACING*5+990,width:132,height:24,bottomOffset:82},
    {worldX:FIRST_X+SPACING*6+255,width:80,height:22,bottomOffset:86,hard:true},{worldX:FIRST_X+SPACING*6+405,width:78,height:22,bottomOffset:142,hard:true},{worldX:FIRST_X+SPACING*6+560,width:72,height:22,bottomOffset:198,hard:true},{worldX:FIRST_X+SPACING*6+725,width:80,height:22,bottomOffset:154,hard:true},{worldX:FIRST_X+SPACING*6+895,width:110,height:24,bottomOffset:96}
  ];
  decoSpec.forEach(d=>{const el=document.createElement('div');el.className='deco-platform rail-beam'+(d.hard?' danger-step':'');el.style.width=d.width+'px';el.style.height=d.height+'px';el.style.bottom=(GROUND_HEIGHT+d.bottomOffset)+'px';area.appendChild(el);G.decoPlatforms.push({el,worldX:d.worldX,width:d.width,height:d.height,bottomOffset:d.bottomOffset});});

  G.enemies = [];
  [
    {worldX:FIRST_X+SPACING*0+690,patrolMin:FIRST_X+SPACING*0+520,patrolMax:FIRST_X+SPACING*0+820,vx:-1.2},
    {worldX:FIRST_X+SPACING*2+890,patrolMin:FIRST_X+SPACING*2+700,patrolMax:FIRST_X+SPACING*2+1080,vx:-1.25},
    {worldX:FIRST_X+SPACING*4+930,patrolMin:FIRST_X+SPACING*4+760,patrolMax:FIRST_X+SPACING*4+1110,vx:-1.35}
  ].forEach(sp=>G.enemies.push(makeTrustGoblinEnemy(area,sp)));
  [
    {worldX:FIRST_X+SPACING*1+925,patrolMin:FIRST_X+SPACING*1+790,patrolMax:FIRST_X+SPACING*1+1125,vx:-1.88},
    {worldX:FIRST_X+SPACING*3+1010,patrolMin:FIRST_X+SPACING*3+840,patrolMax:FIRST_X+SPACING*3+1160,vx:-1.95},
    {worldX:FIRST_X+SPACING*6+970,patrolMin:FIRST_X+SPACING*6+805,patrolMax:FIRST_X+SPACING*6+1140,vx:-2.05}
  ].forEach(sp=>G.enemies.push(makePinkertonGuardEnemy(area,sp)));
  [
    {worldX:FIRST_X+SPACING*2+520,patrolMin:FIRST_X+SPACING*2+390,patrolMax:FIRST_X+SPACING*2+760,vx:.92},
    {worldX:FIRST_X+SPACING*5+590,patrolMin:FIRST_X+SPACING*5+380,patrolMax:FIRST_X+SPACING*5+850,vx:-2.25},
    {worldX:FIRST_X+SPACING*6+460,patrolMin:FIRST_X+SPACING*6+260,patrolMax:FIRST_X+SPACING*6+620,vx:2.15}
  ].forEach(sp=>G.enemies.push(makeGearRatEnemy(area,sp)));
  [
    {worldX:FIRST_X+SPACING*1+620,patrolMin:FIRST_X+SPACING*1+435,patrolMax:FIRST_X+SPACING*1+910,vx:.82,baseY:180,amp:48,phase:.5},
    {worldX:FIRST_X+SPACING*3+575,patrolMin:FIRST_X+SPACING*3+390,patrolMax:FIRST_X+SPACING*3+860,vx:-.88,baseY:174,amp:44,phase:2.2},
    {worldX:FIRST_X+SPACING*4+700,patrolMin:FIRST_X+SPACING*4+520,patrolMax:FIRST_X+SPACING*4+970,vx:.86,baseY:210,amp:38,phase:1.4},
    {worldX:FIRST_X+SPACING*6+760,patrolMin:FIRST_X+SPACING*6+620,patrolMax:FIRST_X+SPACING*6+1010,vx:-.82,baseY:158,amp:36,phase:3.3}
  ].forEach(sp=>G.enemies.push(makeSmokeCloudEnemy(area,sp)));

  G.obstacles = [];
  [
    {type:'steam-vent',worldX:FIRST_X+SPACING*0+760,width:42,height:46,phase:0},
    {type:'steam-vent',worldX:FIRST_X+SPACING*1+310,width:42,height:46,phase:520},
    {type:'spike',worldX:FIRST_X+SPACING*1+1060,width:34,height:42},
    {type:'steam-vent',worldX:FIRST_X+SPACING*2+330,width:42,height:46,phase:1040},
    {type:'steam-vent',worldX:FIRST_X+SPACING*2+1040,width:42,height:46,phase:250},
    {type:'bigblock',worldX:FIRST_X+SPACING*2+1160,width:54,height:52},
    {type:'steam-vent',worldX:FIRST_X+SPACING*3+300,width:42,height:46,phase:750},
    {type:'steam-vent',worldX:FIRST_X+SPACING*3+670,width:42,height:46,phase:1280},
    {type:'spike',worldX:FIRST_X+SPACING*4+1110,width:34,height:42},
    {type:'steam-vent',worldX:FIRST_X+SPACING*5+335,width:42,height:46,phase:180},
    {type:'steam-vent',worldX:FIRST_X+SPACING*5+1010,width:42,height:46,phase:970},
    {type:'bigblock',worldX:FIRST_X+SPACING*6+1075,width:54,height:52}
  ].forEach(o=>{if(G.pits.some(p=>o.worldX>p.worldX-45&&o.worldX<p.worldX+p.width+45))return;const el=document.createElement('div');el.className='obstacle '+o.type+(o.type==='bigblock'?' archive-crate':'')+(o.type==='steam-vent'?' hazard':'');area.appendChild(el);G.obstacles.push({el,type:o.type,worldX:o.worldX,width:o.width,height:o.height,phase:o.phase||0});});

  G.coins = [];
  const coinSpots = [];
  for(let i=0;i<7;i++){const bx=FIRST_X+i*SPACING+520;coinSpots.push({worldX:bx,y:62},{worldX:bx+34,y:62},{worldX:bx+68,y:62});}
  decoSpec.filter(d=>d.hard).forEach(d=>{
    coinSpots.push({worldX:d.worldX+d.width/2-28,y:d.bottomOffset+d.height+34},{worldX:d.worldX+d.width/2,y:d.bottomOffset+d.height+40},{worldX:d.worldX+d.width/2+28,y:d.bottomOffset+d.height+34});
  });
  coinSpots.forEach(c=>{if(G.pits.some(p=>c.worldX>p.worldX-25&&c.worldX<p.worldX+p.width+25&&c.y<90))return;const el=document.createElement('div');el.className='coin gold-seal gilded-token';area.appendChild(el);G.coins.push({el,worldX:c.worldX,y:c.y,collected:false});});
  createWorld2SourceSafeZones({before:280, after:460});
  normalizeGoldSealAlignment();

  refs.skyClouds.innerHTML='';
  for(let i=0;i<13;i++){const c=document.createElement('div');c.className='cloud';const w=55+Math.random()*120;c.style.width=w+'px';c.style.height=(w*.35)+'px';c.style.left=(2+Math.random()*96)+'%';c.style.top=(1+Math.random()*42)+'%';refs.skyClouds.appendChild(c);}

  refs.msg.textContent='2-2 Labor and Unrest: harder timing, tighter beams, more steam vents, Gear Rats, Pinkerton Guards, and Smoke Clouds.';
  refs.msg.classList.add('visible','prototype-note');
  setTimeout(()=>refs.msg.classList.remove('visible','prototype-note'),5200);
}



const PAPER_SHOOTER_SVG = `<svg viewBox="0 0 50 58" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="25" cy="56" rx="17" ry="2" fill="rgba(0,0,0,.35)"/>
  <rect x="14" y="39" width="8" height="16" rx="1" fill="#201819"/><rect x="29" y="39" width="8" height="16" rx="1" fill="#201819"/>
  <path d="M11 22 Q11 14 25 14 Q39 14 39 22 L40 41 Q40 45 35 45 L15 45 Q10 45 10 41 Z" fill="#2b2a30" stroke="#0a090b" stroke-width=".8"/>
  <rect x="14" y="27" width="22" height="13" rx="1" fill="#f4ead0" stroke="#5b4128" stroke-width=".6"/>
  <text x="25" y="35" text-anchor="middle" font-family="serif" font-size="7" fill="#5b2b1a">NEWS</text>
  <ellipse cx="25" cy="13" rx="8" ry="7" fill="#c99b76" stroke="#4a2d1b" stroke-width=".5"/>
  <ellipse cx="22" cy="12" rx=".8" ry="1" fill="#140b08"/><ellipse cx="28" cy="12" rx=".8" ry="1" fill="#140b08"/>
  <path d="M21 17 Q25 15 29 17" stroke="#3a2012" stroke-width=".7" fill="none"/>
  <path d="M16 8 Q25 0 34 8 Q29 5 25 5 Q21 5 16 8" fill="#1b1a1d"/>
  <rect x="36" y="27" width="12" height="6" rx="1" fill="#f4ead0" stroke="#5b4128" stroke-width=".5"/>
  <path d="M43 30 L50 27 L50 35 Z" fill="#d99a35" opacity=".9"/>
</svg>`;

function addWorld2Round23Questions(){
  QUESTION_BANK['2-3'] = Array.from({length:12}, (_,i)=>({
    id:'2-3-Q'+(i+1),
    stem:'Placeholder Source Block 2-3' + String.fromCharCode(65+i) + ': Immigration and Urbanization question placeholder. Choose the answer that says “prototype” to keep testing gameplay.',
    choices:[
      'Prototype answer — correct for gameplay testing',
      'Distractor answer — tenement vocabulary placeholder',
      'Distractor answer — immigration vocabulary placeholder',
      'Distractor answer — urban reform vocabulary placeholder'
    ],
    correctIdx:0,
    explain:'Prototype feedback: later this will explain immigration, urbanization, tenements, settlement houses, or city reform.'
  }));
}

function addWorld2Round23ToMenu(){
  const w = WORLDS.find(x => x.id === 'unit2');
  if(!w) return;
  const already = (w.rounds || []).some(r => r.id === '2-3');
  if(!already){
    w.rounds.push({id:'2-3', num:'2-3', title:'Tenements and City Life', sub:'Immigration, urbanization, rooftops, smoke, and press attacks', sampleSize:8});
  }
}

function makePaperShooter(area, sp){
  const el = document.createElement('div');
  el.className = 'cannon paper-shooter';
  el.innerHTML = PAPER_SHOOTER_SVG;
  area.appendChild(el);
  return {
    el,
    worldX:sp.worldX,
    cooldown:sp.cooldown || 4200,
    nextFire:sp.nextFire || 0,
    pattern:sp.pattern || 'low',
    shotIndex:0,
    projectileClass:'paper-shot',
    lastFireAt:Date.now() - (sp.cooldown || 4200) + (sp.nextFire || 0)
  };
}

function buildRound2_3_cityLife(refs){
  const area = refs.area;
  clearGildedArea(refs);
  area.classList.add('theme-gilded-city');
  const SPACING = 1320;
  const FIRST_X = 840;

  G.cannons = [];
  G.cannonballs = [];
  G.platforms = [];
  for(let i=0;i<8;i++){
    const worldX = FIRST_X + i*SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block industrial-source';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = 'SOURCE ' + (i+1);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({el,lbl,worldX,idx:i,cleared:false,armed:true,width:86,height:86});
  }

  const fEl = document.createElement('div');
  fEl.className = 'finish-platform';
  fEl.innerHTML = `<div class="fp-post-l"></div><div class="fp-post-r"></div><div class="fp-bar"></div>
    <div class="fp-banner">SETTLEMENT</div>
    <div class="fp-bunting"><div class="swag white"></div><div class="swag blue"></div><div class="swag white"></div><div class="swag red"></div><div class="swag white"></div></div>
    <div class="fp-base"></div>`;
  area.appendChild(fEl);
  G.finishPlatform = {el:fEl, worldX:FINISH-220, width:120, height:170};

  G.pits = [
    {worldX:FIRST_X+SPACING*0+790,width:150},
    {worldX:FIRST_X+SPACING*1+620,width:195},
    {worldX:FIRST_X+SPACING*2+745,width:165},
    {worldX:FIRST_X+SPACING*3+620,width:245},
    {worldX:FIRST_X+SPACING*4+705,width:210},
    {worldX:FIRST_X+SPACING*5+640,width:240},
    {worldX:FIRST_X+SPACING*6+760,width:170}
  ];
  G.pits.forEach(p=>{const el=document.createElement('div');el.className='pit';el.style.width=p.width+'px';area.appendChild(el);p.el=el;});

  G.decoPlatforms = [];
  const decoSpec = [
    {worldX:FIRST_X+250,width:120,height:22,bottomOffset:72},{worldX:FIRST_X+445,width:90,height:22,bottomOffset:138},{worldX:FIRST_X+625,width:100,height:22,bottomOffset:196},
    {worldX:FIRST_X+SPACING*1+260,width:100,height:22,bottomOffset:88},{worldX:FIRST_X+SPACING*1+440,width:86,height:22,bottomOffset:152},{worldX:FIRST_X+SPACING*1+610,width:76,height:22,bottomOffset:218},{worldX:FIRST_X+SPACING*1+790,width:110,height:22,bottomOffset:150},
    {worldX:FIRST_X+SPACING*2+240,width:95,height:22,bottomOffset:96},{worldX:FIRST_X+SPACING*2+410,width:80,height:22,bottomOffset:165},{worldX:FIRST_X+SPACING*2+585,width:85,height:22,bottomOffset:230},{worldX:FIRST_X+SPACING*2+780,width:118,height:22,bottomOffset:160},
    {worldX:FIRST_X+SPACING*3+245,width:130,height:24,bottomOffset:90},{worldX:FIRST_X+SPACING*3+470,width:86,height:22,bottomOffset:158},{worldX:FIRST_X+SPACING*3+650,width:74,height:22,bottomOffset:226},{worldX:FIRST_X+SPACING*3+850,width:110,height:22,bottomOffset:148},
    {worldX:FIRST_X+SPACING*4+250,width:108,height:22,bottomOffset:82},{worldX:FIRST_X+SPACING*4+450,width:90,height:22,bottomOffset:145},{worldX:FIRST_X+SPACING*4+645,width:78,height:22,bottomOffset:210},{worldX:FIRST_X+SPACING*4+845,width:116,height:22,bottomOffset:152},
    {worldX:FIRST_X+SPACING*5+240,width:115,height:24,bottomOffset:102},{worldX:FIRST_X+SPACING*5+455,width:84,height:22,bottomOffset:172},{worldX:FIRST_X+SPACING*5+635,width:76,height:22,bottomOffset:238},{worldX:FIRST_X+SPACING*5+835,width:120,height:22,bottomOffset:166},
    {worldX:FIRST_X+SPACING*6+270,width:96,height:22,bottomOffset:92},{worldX:FIRST_X+SPACING*6+460,width:84,height:22,bottomOffset:162},{worldX:FIRST_X+SPACING*6+650,width:78,height:22,bottomOffset:222},{worldX:FIRST_X+SPACING*6+865,width:128,height:24,bottomOffset:132}
  ];
  decoSpec.forEach(d=>{const el=document.createElement('div');el.className='deco-platform fire-escape';el.style.width=d.width+'px';el.style.height=d.height+'px';el.style.bottom=(GROUND_HEIGHT+d.bottomOffset)+'px';area.appendChild(el);G.decoPlatforms.push({el,worldX:d.worldX,width:d.width,height:d.height,bottomOffset:d.bottomOffset});});

  G.enemies = [];
  [
    {worldX:FIRST_X+SPACING*0+640,patrolMin:FIRST_X+SPACING*0+500,patrolMax:FIRST_X+SPACING*0+780,vx:-1.15},
    {worldX:FIRST_X+SPACING*3+1040,patrolMin:FIRST_X+SPACING*3+900,patrolMax:FIRST_X+SPACING*3+1170,vx:-1.3},
    {worldX:FIRST_X+SPACING*6+1040,patrolMin:FIRST_X+SPACING*6+880,patrolMax:FIRST_X+SPACING*6+1160,vx:-1.35}
  ].forEach(sp=>G.enemies.push(makeTrustGoblinEnemy(area,sp)));
  [
    {worldX:FIRST_X+SPACING*1+720,patrolMin:FIRST_X+SPACING*1+540,patrolMax:FIRST_X+SPACING*1+920,vx:.88,baseY:210,amp:52,phase:.7},
    {worldX:FIRST_X+SPACING*2+720,patrolMin:FIRST_X+SPACING*2+520,patrolMax:FIRST_X+SPACING*2+980,vx:-.9,baseY:180,amp:42,phase:2.2},
    {worldX:FIRST_X+SPACING*4+690,patrolMin:FIRST_X+SPACING*4+520,patrolMax:FIRST_X+SPACING*4+970,vx:.86,baseY:232,amp:36,phase:1.3},
    {worldX:FIRST_X+SPACING*5+780,patrolMin:FIRST_X+SPACING*5+600,patrolMax:FIRST_X+SPACING*5+1010,vx:-.82,baseY:170,amp:46,phase:3.0}
  ].forEach(sp=>G.enemies.push(makeSmokeCloudEnemy(area,sp)));
  [
    {worldX:FIRST_X+SPACING*2+1020,patrolMin:FIRST_X+SPACING*2+860,patrolMax:FIRST_X+SPACING*2+1160,vx:-2.1},
    {worldX:FIRST_X+SPACING*5+1020,patrolMin:FIRST_X+SPACING*5+850,patrolMax:FIRST_X+SPACING*5+1150,vx:-2.2}
  ].forEach(sp=>G.enemies.push(makeGearRatEnemy(area,sp)));

  G.cannons = [
    makePaperShooter(area,{worldX:FIRST_X+SPACING*1+1010,cooldown:4700,nextFire:1600,pattern:'low'}),
    makePaperShooter(area,{worldX:FIRST_X+SPACING*3+1060,cooldown:5200,nextFire:900,pattern:'alternate'}),
    makePaperShooter(area,{worldX:FIRST_X+SPACING*5+1080,cooldown:5000,nextFire:2100,pattern:'low'})
  ];

  G.obstacles = [];
  [
    {type:'steam-vent',worldX:FIRST_X+SPACING*0+720,width:42,height:46,phase:500},
    {type:'spike',worldX:FIRST_X+SPACING*1+1050,width:34,height:42},
    {type:'steam-vent',worldX:FIRST_X+SPACING*2+340,width:42,height:46,phase:950},
    {type:'bigblock',worldX:FIRST_X+SPACING*2+1120,width:54,height:52},
    {type:'steam-vent',worldX:FIRST_X+SPACING*3+760,width:42,height:46,phase:200},
    {type:'spike',worldX:FIRST_X+SPACING*4+1120,width:34,height:42},
    {type:'steam-vent',worldX:FIRST_X+SPACING*5+360,width:42,height:46,phase:1200},
    {type:'bigblock',worldX:FIRST_X+SPACING*6+1085,width:54,height:52}
  ].forEach(o=>{if(G.pits.some(p=>o.worldX>p.worldX-45&&o.worldX<p.worldX+p.width+45))return;const el=document.createElement('div');el.className='obstacle '+o.type+(o.type==='bigblock'?' archive-crate':'')+(o.type==='steam-vent'?' hazard':'');area.appendChild(el);G.obstacles.push({el,type:o.type,worldX:o.worldX,width:o.width,height:o.height,phase:o.phase||0});});

  G.coins = [];
  const coinSpots = [];
  decoSpec.forEach((d,idx)=>{if(idx % 2 === 0){coinSpots.push({worldX:d.worldX+d.width/2-24,y:d.bottomOffset+d.height+34},{worldX:d.worldX+d.width/2+4,y:d.bottomOffset+d.height+40},{worldX:d.worldX+d.width/2+32,y:d.bottomOffset+d.height+34});}});
  for(let i=0;i<7;i++){const bx=FIRST_X+i*SPACING+525;coinSpots.push({worldX:bx,y:64},{worldX:bx+34,y:64});}
  coinSpots.forEach(c=>{if(G.pits.some(p=>c.worldX>p.worldX-25&&c.worldX<p.worldX+p.width+25&&c.y<90))return;const el=document.createElement('div');el.className='coin gold-seal gilded-token';area.appendChild(el);G.coins.push({el,worldX:c.worldX,y:c.y,collected:false});});
  createWorld2SourceSafeZones({before:300, after:500});
  normalizeGoldSealAlignment();

  refs.skyClouds.innerHTML='';
  for(let i=0;i<16;i++){const c=document.createElement('div');c.className='cloud';const w=38+Math.random()*105;c.style.width=w+'px';c.style.height=(w*.34)+'px';c.style.left=(1+Math.random()*98)+'%';c.style.top=(1+Math.random()*45)+'%';refs.skyClouds.appendChild(c);}
  refs.msg.textContent='2-3 Tenements and City Life: vertical fire escapes, Smoke Clouds, Gear Rats, and paper-shooting press enemies.';
  refs.msg.classList.add('visible','prototype-note');
  setTimeout(()=>refs.msg.classList.remove('visible','prototype-note'),5600);
}


// ════════════════════════════════════════════════════════════════
// WORLD 2 SCOPE PASS — align to Iron and Gold / Unit 2A structure
// Lessons in the uploaded unit file: Boomtown Frontier, Age of Innovation,
// Labor Rising, Through Ellis Island, and an EOC review synthesis.
// ════════════════════════════════════════════════════════════════
const MACHINE_BOSS_SVG = `<svg viewBox="0 0 74 86" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="19" y="18" width="36" height="42" rx="8" fill="#3a2a22" stroke="#120c08" stroke-width="2"/>
  <rect x="13" y="8" width="48" height="12" rx="3" fill="#1a1412" stroke="#070504" stroke-width="2"/>
  <rect x="24" y="0" width="26" height="12" rx="2" fill="#1a1412" stroke="#070504" stroke-width="2"/>
  <circle cx="28" cy="31" r="5" fill="#f5d27a" stroke="#1a1008" stroke-width="1.2"/>
  <circle cx="46" cy="31" r="5" fill="#f5d27a" stroke="#1a1008" stroke-width="1.2"/>
  <path d="M28 45 Q37 51 46 45" stroke="#d89840" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g fill="#b87830" stroke="#2a1808" stroke-width="1.3">
    <circle cx="16" cy="56" r="8"/><circle cx="58" cy="56" r="8"/><circle cx="37" cy="64" r="9"/>
  </g>
  <rect x="13" y="58" width="13" height="24" rx="3" fill="#211817" stroke="#090606" stroke-width="1.5"/>
  <rect x="48" y="58" width="13" height="24" rx="3" fill="#211817" stroke="#090606" stroke-width="1.5"/>
  <path d="M14 25 L2 36 L13 40" stroke="#2a1c18" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M60 25 L72 36 L61 40" stroke="#2a1c18" stroke-width="6" fill="none" stroke-linecap="round"/>
  <rect x="2" y="32" width="17" height="9" rx="2" fill="#f4ead0" stroke="#5b4128" stroke-width="1"/>
  <rect x="55" y="32" width="17" height="9" rx="2" fill="#f4ead0" stroke="#5b4128" stroke-width="1"/>
</svg>`;

function addWorld2Round24Questions(){
  QUESTION_BANK['2-4'] = Array.from({length:10}, (_,i)=>({
    id:'2-4-Q'+(i+1),
    stem:'Placeholder Source Block 2-4' + String.fromCharCode(65+i) + ': Iron and Gold synthesis question placeholder. Choose the answer that says “prototype” to keep testing the boss level.',
    choices:[
      'Prototype answer — correct for gameplay testing',
      'Distractor answer — monopoly vocabulary placeholder',
      'Distractor answer — political machine placeholder',
      'Distractor answer — immigration/labor synthesis placeholder'
    ],
    correctIdx:0,
    explain:'Prototype feedback: later this will connect railroads, industry, labor, immigration, nativism, trusts, and political machines.'
  }));
}

function addWorld2Round24ToMenu(){
  const w = WORLDS.find(x => x.id === 'unit2');
  if(!w) return;
  // Align the playable sequence to the uploaded Unit 2A scope while keeping the gameplay you liked.
  const rounds = w.rounds || [];
  const r21 = rounds.find(r=>r.id==='2-1');
  if(r21){r21.title='Boomtown Frontier'; r21.sub='Railroads, western growth, industry, and the first factory hazards';}
  const r22 = rounds.find(r=>r.id==='2-2');
  if(r22){r22.title='Labor Rising'; r22.sub='Strikes, unions, Pinkertons, steam, and dangerous machinery';}
  const r23 = rounds.find(r=>r.id==='2-3');
  if(r23){r23.title='Through Ellis Island'; r23.sub='Immigration, urbanization, tenements, newspapers, and city life';}
  if(!rounds.some(r=>r.id==='2-4')){
    rounds.push({id:'2-4', num:'2-4', title:'Iron and Gold', sub:'Political machines, trusts, corruption, and the Gilded Machine boss', sampleSize:10, isCastle:true});
  }
  w.rounds = rounds;
  w.intro = 'Boomtowns, railroads, industrial growth, labor conflict, immigration, nativism, trusts, and political machines reshape American life.';
}

function reskinWorld2FinalEnemies(area){
  // Remove the old Civil War/Reconstruction identities. Keep the collision behavior,
  // but make the visual language Gilded Age: guards, rats, smoke, papers, and machinery.
  (G.enemies || []).forEach((e, idx)=>{
    if(e.el && e.type === 'sentry'){
      e.el.className = 'enemy pinkerton-guard';
      e.el.innerHTML = PINKERTON_SVG;
      e.type = 'pinkerton';
      e.vx = Math.sign(e.vx || -1) * 1.65;
    } else if(e.el && e.type === 'redeemer'){
      e.el.className = 'enemy gear-rat';
      e.el.innerHTML = GEAR_RAT_SVG;
      e.type = 'gearrat';
      e.vx = Math.sign(e.vx || -1) * 2.05;
    }
  });
}

function buildRound2_4_ironGoldBoss(refs){
  // Clean custom build for World 2's final stage. This no longer reuses the
  // Civil War castle layout; it builds a true Gilded Age machine-room approach
  // followed by a locked, readable boss arena.
  const area = refs.area;
  clearGildedArea(refs);
  area.classList.remove('theme-gilded','theme-gilded-rails','theme-gilded-labor','theme-gilded-city');
  area.classList.add('theme-gilded-machine');

  // Reset final-round systems explicitly so nothing from another builder leaks in.
  G.platforms = [];
  G.decoPlatforms = [];
  G.pits = [];
  G.coins = [];
  G.enemies = [];
  G.cannons = [];
  G.cannonballs = [];
  G.debris = [];
  G.obstacles = [];
  G.boss = null;
  G.bossDefeated = false;
  G.finishGated = true;
  G.bossArenaActive = false;
  G.bossArenaStartX = null;
  G.bossArenaCameraX = null;

  const FIRST_X = 820;
  const SPACING = 1375;
  const BOSS_X = FIRST_X + 10*SPACING + 650;

  // 10 Source Blocks: the first seven are the machine-room review, the last
  // three are a short synthesis hallway before the boss arena.
  for(let i=0;i<10;i++){
    const worldX = FIRST_X + i*SPACING;
    const el = document.createElement('div');
    el.className = 'platform armed source-block industrial-source';
    el.style.width = '86px';
    el.style.height = '86px';
    const lbl = document.createElement('div');
    lbl.className = 'platform-label';
    lbl.textContent = i < 7 ? 'SOURCE ' + (i+1) : 'SYNTHESIS ' + (i-6);
    el.appendChild(lbl);
    area.appendChild(el);
    G.platforms.push({el,lbl,worldX,idx:i,cleared:false,armed:true,width:86,height:86});
  }

  // Locked machine gate after the boss. This uses the existing finish-gated
  // logic, but with the Gilded Age machine visual.
  const fEl = document.createElement('div');
  fEl.className = 'castle-finish machine-gate';
  fEl.innerHTML = `
    <div class="cf-pole"></div>
    <div class="cf-flag"></div>
    <div class="cf-arch"></div>
    <div class="cf-banner">MACHINE</div>
    <div class="cf-chains"></div>
  `;
  area.appendChild(fEl);
  G.finishPlatform = {el:fEl, worldX:BOSS_X+520, width:140, height:200};

  // Pits: 2-4 is challenging, but the final boss approach is clean.
  G.pits = [
    {worldX:FIRST_X+SPACING*1+650,width:170},
    {worldX:FIRST_X+SPACING*2+610,width:220},
    {worldX:FIRST_X+SPACING*3+735,width:185},
    {worldX:FIRST_X+SPACING*4+615,width:245},
    {worldX:FIRST_X+SPACING*5+760,width:210},
    {worldX:FIRST_X+SPACING*7+575,width:180}
  ];
  G.pits.forEach(p=>{const el=document.createElement('div');el.className='pit';el.style.width=p.width+'px';area.appendChild(el);p.el=el;});

  // Machine-room platforms: steel beams, fire escapes, and gear-room ledges.
  const decoSpec = [
    // Opening factory floor warmup
    {worldX:FIRST_X+260,width:116,height:22,bottomOffset:78,cls:'rail-beam'},
    {worldX:FIRST_X+470,width:96,height:22,bottomOffset:138,cls:'rail-beam'},
    {worldX:FIRST_X+SPACING*1+430,width:82,height:22,bottomOffset:86,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*1+570,width:74,height:22,bottomOffset:136,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*1+730,width:86,height:22,bottomOffset:96,cls:'rail-beam hard'},

    // Press/paper-shooter section
    {worldX:FIRST_X+SPACING*2+245,width:120,height:24,bottomOffset:104,cls:'fire-escape'},
    {worldX:FIRST_X+SPACING*2+455,width:88,height:22,bottomOffset:170,cls:'fire-escape hard'},
    {worldX:FIRST_X+SPACING*2+640,width:76,height:22,bottomOffset:220,cls:'fire-escape hard'},
    {worldX:FIRST_X+SPACING*2+835,width:118,height:24,bottomOffset:150,cls:'fire-escape'},

    // Steam/gear room
    {worldX:FIRST_X+SPACING*3+260,width:100,height:22,bottomOffset:82,cls:'rail-beam'},
    {worldX:FIRST_X+SPACING*3+445,width:86,height:22,bottomOffset:144,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*3+625,width:78,height:22,bottomOffset:205,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*3+850,width:122,height:24,bottomOffset:126,cls:'rail-beam'},

    // High/low route over labor unrest enemies
    {worldX:FIRST_X+SPACING*4+250,width:128,height:24,bottomOffset:92,cls:'fire-escape'},
    {worldX:FIRST_X+SPACING*4+485,width:86,height:22,bottomOffset:162,cls:'fire-escape hard'},
    {worldX:FIRST_X+SPACING*4+665,width:74,height:22,bottomOffset:225,cls:'fire-escape hard'},
    {worldX:FIRST_X+SPACING*4+880,width:116,height:24,bottomOffset:146,cls:'fire-escape'},

    // Trust/city-machine ramp
    {worldX:FIRST_X+SPACING*5+240,width:110,height:22,bottomOffset:80,cls:'rail-beam'},
    {worldX:FIRST_X+SPACING*5+430,width:86,height:22,bottomOffset:132,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*5+610,width:82,height:22,bottomOffset:188,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*5+810,width:110,height:22,bottomOffset:132,cls:'rail-beam'},

    // Final review steps, then a clean warning hallway
    {worldX:FIRST_X+SPACING*6+250,width:124,height:24,bottomOffset:106,cls:'fire-escape'},
    {worldX:FIRST_X+SPACING*6+480,width:90,height:22,bottomOffset:170,cls:'fire-escape hard'},
    {worldX:FIRST_X+SPACING*6+680,width:96,height:22,bottomOffset:120,cls:'fire-escape'},
    {worldX:FIRST_X+SPACING*7+350,width:82,height:22,bottomOffset:88,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*7+500,width:78,height:22,bottomOffset:145,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*7+670,width:84,height:22,bottomOffset:96,cls:'rail-beam hard'},
    {worldX:FIRST_X+SPACING*8+260,width:126,height:24,bottomOffset:96,cls:'fire-escape'},
    {worldX:FIRST_X+SPACING*8+500,width:100,height:22,bottomOffset:154,cls:'fire-escape'},
    {worldX:FIRST_X+SPACING*9+230,width:140,height:24,bottomOffset:96,cls:'rail-beam'}
  ];
  decoSpec.forEach(d=>{
    const el=document.createElement('div');
    el.className='deco-platform ' + d.cls;
    el.style.width=d.width+'px';
    el.style.height=d.height+'px';
    el.style.bottom=(GROUND_HEIGHT+d.bottomOffset)+'px';
    area.appendChild(el);
    G.decoPlatforms.push({el,worldX:d.worldX,width:d.width,height:d.height,bottomOffset:d.bottomOffset});
  });

  // Enemies increase variety, but they live in the challenge lanes BETWEEN
  // Source Blocks. With the wider 2-4 spacing, each Source Block now has a
  // real safe reprieve, then the chaos returns in the middle of the next gap.
  [
    {worldX:FIRST_X+SPACING*0+720,patrolMin:FIRST_X+SPACING*0+600,patrolMax:FIRST_X+SPACING*0+1015,vx:-1.1},
    {worldX:FIRST_X+SPACING*3+820,patrolMin:FIRST_X+SPACING*3+620,patrolMax:FIRST_X+SPACING*3+1040,vx:-1.25},
    {worldX:FIRST_X+SPACING*6+790,patrolMin:FIRST_X+SPACING*6+610,patrolMax:FIRST_X+SPACING*6+1035,vx:-1.28}
  ].forEach(sp=>G.enemies.push(makeTrustGoblinEnemy(area,sp)));
  [
    {worldX:FIRST_X+SPACING*1+840,patrolMin:FIRST_X+SPACING*1+620,patrolMax:FIRST_X+SPACING*1+1040,vx:-1.75},
    {worldX:FIRST_X+SPACING*4+900,patrolMin:FIRST_X+SPACING*4+630,patrolMax:FIRST_X+SPACING*4+1045,vx:-1.9},
    {worldX:FIRST_X+SPACING*7+820,patrolMin:FIRST_X+SPACING*7+620,patrolMax:FIRST_X+SPACING*7+1030,vx:-1.65}
  ].forEach(sp=>G.enemies.push(makePinkertonGuardEnemy(area,sp)));
  [
    {worldX:FIRST_X+SPACING*2+900,patrolMin:FIRST_X+SPACING*2+635,patrolMax:FIRST_X+SPACING*2+1045,vx:-2.15},
    {worldX:FIRST_X+SPACING*5+930,patrolMin:FIRST_X+SPACING*5+650,patrolMax:FIRST_X+SPACING*5+1040,vx:-2.2},
    {worldX:FIRST_X+SPACING*8+820,patrolMin:FIRST_X+SPACING*8+620,patrolMax:FIRST_X+SPACING*8+1025,vx:-2.0}
  ].forEach(sp=>G.enemies.push(makeGearRatEnemy(area,sp)));
  [
    {worldX:FIRST_X+SPACING*2+760,patrolMin:FIRST_X+SPACING*2+610,patrolMax:FIRST_X+SPACING*2+1040,vx:.82,baseY:205,amp:42,phase:1.1},
    {worldX:FIRST_X+SPACING*4+750,patrolMin:FIRST_X+SPACING*4+610,patrolMax:FIRST_X+SPACING*4+1035,vx:-.86,baseY:190,amp:48,phase:2.7},
    {worldX:FIRST_X+SPACING*7+780,patrolMin:FIRST_X+SPACING*7+610,patrolMax:FIRST_X+SPACING*7+1025,vx:.74,baseY:165,amp:34,phase:.3}
  ].forEach(sp=>G.enemies.push(makeSmokeCloudEnemy(area,sp)));

  // Paper shooters act as the shooting enemies before the boss. They are
  // centered in the challenge lanes rather than parked on top of Source Blocks.
  G.cannons = [
    makePaperShooter(area,{worldX:FIRST_X+SPACING*2+780,cooldown:5600,nextFire:1800,pattern:'low'}),
    makePaperShooter(area,{worldX:FIRST_X+SPACING*4+820,cooldown:6100,nextFire:1100,pattern:'alternate'}),
    makePaperShooter(area,{worldX:FIRST_X+SPACING*6+790,cooldown:5800,nextFire:2600,pattern:'high'})
  ];

  // Obstacles: steam and gears before the clean boss arena. These are also
  // placed in the middle lanes, so Source Blocks remain short safe checkpoints.
  [
    {type:'steam-vent',worldX:FIRST_X+SPACING*0+650,width:42,height:46,phase:0},
    {type:'steam-vent',worldX:FIRST_X+SPACING*1+720,width:42,height:46,phase:500},
    {type:'spike',worldX:FIRST_X+SPACING*1+985,width:34,height:42},
    {type:'steam-vent',worldX:FIRST_X+SPACING*2+700,width:42,height:46,phase:700},
    {type:'bigblock',worldX:FIRST_X+SPACING*2+1010,width:54,height:52},
    {type:'steam-vent',worldX:FIRST_X+SPACING*3+760,width:42,height:46,phase:250},
    {type:'spike',worldX:FIRST_X+SPACING*4+1015,width:34,height:42},
    {type:'steam-vent',worldX:FIRST_X+SPACING*5+720,width:42,height:46,phase:1200},
    {type:'bigblock',worldX:FIRST_X+SPACING*6+1005,width:54,height:52},
    {type:'steam-vent',worldX:FIRST_X+SPACING*7+930,width:42,height:46,phase:500}
  ].forEach(o=>{
    if(G.pits.some(p=>o.worldX>p.worldX-45&&o.worldX<p.worldX+p.width+45))return;
    const el=document.createElement('div');
    el.className='obstacle '+o.type+(o.type==='bigblock'?' archive-crate':'')+(o.type==='steam-vent'?' hazard':'');
    area.appendChild(el);
    G.obstacles.push({el,type:o.type,worldX:o.worldX,width:o.width,height:o.height,phase:o.phase||0});
  });

  // Coins/seals reward the harder high routes.
  const coinSpots=[];
  decoSpec.forEach((d,idx)=>{
    if(idx%2===0 || d.cls.indexOf('hard')>=0){
      coinSpots.push({worldX:d.worldX+d.width/2-28,y:d.bottomOffset+d.height+34});
      coinSpots.push({worldX:d.worldX+d.width/2,y:d.bottomOffset+d.height+38});
      coinSpots.push({worldX:d.worldX+d.width/2+28,y:d.bottomOffset+d.height+34});
    }
  });
  for(let i=0;i<9;i++){
    const bx=FIRST_X+i*SPACING+520;
    coinSpots.push({worldX:bx,y:64},{worldX:bx+34,y:64});
  }
  coinSpots.forEach(c=>{
    if(G.pits.some(p=>c.worldX>p.worldX-25&&c.worldX<p.worldX+p.width+25&&c.y<90))return;
    const el=document.createElement('div');
    el.className='coin gold-seal gilded-token';
    area.appendChild(el);
    G.coins.push({el,worldX:c.worldX,y:c.y,collected:false});
  });
  createWorld2SourceSafeZones({before:300, after:460});
  normalizeGoldSealAlignment();

  // Gilded Machine boss: placed far enough back to give a clear warning hallway.
  const bossEl = document.createElement('div');
  bossEl.className = 'enemy boss machine-boss';
  bossEl.innerHTML = MACHINE_BOSS_SVG;
  area.appendChild(bossEl);

  const healthEl = document.createElement('div');
  healthEl.className = 'boss-health';
  healthEl.innerHTML = `<div class="boss-health-label">GILDED MACHINE</div><div class="boss-health-fill"></div>`;
  area.appendChild(healthEl);

  const bossShadow = document.createElement('div');
  bossShadow.className = 'boss-shadow';
  area.appendChild(bossShadow);

  G.boss = {
    el: bossEl,
    shadowEl: bossShadow,
    healthEl: healthEl,
    healthFill: healthEl.querySelector('.boss-health-fill'),
    worldX: BOSS_X,
    vx: -0.82,
    patrolMin: BOSS_X - 80,
    patrolMax: BOSS_X + 80,
    y: 0,
    vy: 0,
    onGround: true,
    nextJumpAt: Date.now() + 5200,
    nextShotAt: Date.now() + 7600,
    shotIndex: 0,
    health: 4,
    maxHealth: 4,
    dead: false,
    invulnerableUntil: 0
  };
  G.bossDefeated = false;
  G.finishGated = true;

  // Lock only when the player enters the actual boss room, not at load.
  G.bossArenaStartX = BOSS_X - 700;
  G.bossArenaCameraX = BOSS_X - 760;
  G.bossArenaActive = false;

  // Make sure there is no enemy/projectile pileup inside the final arena.
  const arenaStart = G.bossArenaStartX - 20;
  G.enemies = (G.enemies || []).filter(e=>{
    const keep = e.worldX < arenaStart;
    if(!keep && e.el && e.el.parentNode) e.el.remove();
    return keep;
  });
  G.obstacles = (G.obstacles || []).filter(o=>{
    const keep = o.worldX < arenaStart;
    if(!keep && o.el && o.el.parentNode) o.el.remove();
    return keep;
  });
  G.cannons = (G.cannons || []).filter(c=>{
    const keep = c.worldX < arenaStart - 200;
    if(!keep && c.el && c.el.parentNode) c.el.remove();
    return keep;
  });

  // Menacing machine-room smoke.
  refs.skyClouds.innerHTML='';
  for(let i=0;i<12;i++){
    const c=document.createElement('div');
    c.className='cloud';
    const w=45+Math.random()*125;
    c.style.width=w+'px';
    c.style.height=(w*.34)+'px';
    c.style.left=(2+Math.random()*96)+'%';
    c.style.top=(2+Math.random()*42)+'%';
    refs.skyClouds.appendChild(c);
  }

  refs.msg.textContent='2-4 Iron and Gold: wider spacing keeps Source Blocks safe, while the challenge lanes between them stay chaotic.';
  refs.msg.classList.add('visible','prototype-note');
  setTimeout(()=>refs.msg.classList.remove('visible','prototype-note'),6200);
}


// ════════════════════════════════════════════════════════════════
// RE-SLOT PASS — pacing guide alignment
// World 2 = Challenges in the West; World 3 = Industrial Revolution.
// The factory/labor/boss prototypes are preserved as World 3.
// ════════════════════════════════════════════════════════════════
const PRAIRIE_WOLF_SVG = `<svg viewBox="0 0 54 42" xmlns="http://www.w3.org/2000/svg"><ellipse cx="27" cy="39" rx="19" ry="2.5" fill="rgba(0,0,0,.3)"/><path d="M12 24 Q18 12 33 15 Q43 16 48 24 L44 31 L20 31 Z" fill="#6a4a30" stroke="#27160a" stroke-width="1.2"/><path d="M37 15 L47 8 L46 21" fill="#6a4a30" stroke="#27160a" stroke-width="1.2"/><path d="M15 18 L8 10 L10 23" fill="#6a4a30" stroke="#27160a" stroke-width="1.2"/><circle cx="16" cy="21" r="1.4" fill="#080604"/><path d="M8 25 L2 23 L7 28" fill="#27160a"/><rect x="20" y="29" width="5" height="10" rx="1" fill="#3a2414"/><rect x="37" y="29" width="5" height="10" rx="1" fill="#3a2414"/></svg>`;
const DUST_DEVIL_SVG = `<svg viewBox="0 0 48 62" xmlns="http://www.w3.org/2000/svg"><ellipse cx="24" cy="59" rx="17" ry="2" fill="rgba(0,0,0,.22)"/><path d="M14 55 Q31 50 21 42 Q8 32 30 28 Q47 24 23 17 Q8 12 33 6" fill="none" stroke="#c99b63" stroke-width="9" stroke-linecap="round" opacity=".86"/><path d="M16 54 Q33 48 22 41 Q11 35 31 29 Q42 25 24 19" fill="none" stroke="#7c5128" stroke-width="3" stroke-linecap="round" opacity=".55"/><circle cx="18" cy="28" r="2" fill="#5a3518" opacity=".5"/><circle cx="31" cy="36" r="1.8" fill="#5a3518" opacity=".45"/></svg>`;
const RAIL_BARON_SVG = `<svg viewBox="0 0 58 70" xmlns="http://www.w3.org/2000/svg"><ellipse cx="29" cy="68" rx="18" ry="2.5" fill="rgba(0,0,0,.32)"/><rect x="18" y="44" width="7" height="21" rx="1" fill="#18110d"/><rect x="34" y="44" width="7" height="21" rx="1" fill="#18110d"/><path d="M14 25 Q13 16 29 16 Q45 16 44 25 L47 47 Q47 51 42 51 L16 51 Q11 51 11 47 Z" fill="#3b281e" stroke="#100907" stroke-width="1.3"/><path d="M18 27 L29 44 L40 27 L38 50 L20 50 Z" fill="#17100d"/><path d="M23 27 L29 39 L35 27" fill="#eee0c8"/><circle cx="29" cy="42" r="2.4" fill="#d6a33a" stroke="#4a2a08"/><ellipse cx="29" cy="16" rx="10" ry="9" fill="#d0a47c" stroke="#5a3820"/><ellipse cx="25" cy="15" rx="1" ry="1.2" fill="#110907"/><ellipse cx="33" cy="15" rx="1" ry="1.2" fill="#110907"/><path d="M24 20 Q29 18 34 20" stroke="#3a2012" stroke-width="1" fill="none"/><ellipse cx="29" cy="8" rx="15" ry="2.2" fill="#111"/><rect x="19" y="-2" width="20" height="11" rx="2" fill="#111"/><rect x="19" y="7" width="20" height="2" fill="#a87926"/><rect x="42" y="30" width="10" height="13" rx="2" fill="#d4b15e" stroke="#4a2a08"/><text x="47" y="39" text-anchor="middle" font-size="7" font-family="serif" fill="#3a2208">$</text></svg>`;
const DEBT_BEETLE_SVG = `<svg viewBox="0 0 46 38" xmlns="http://www.w3.org/2000/svg"><ellipse cx="23" cy="35" rx="16" ry="2" fill="rgba(0,0,0,.3)"/><ellipse cx="23" cy="20" rx="17" ry="12" fill="#5c3a1a" stroke="#211006" stroke-width="1.4"/><path d="M23 8 L23 32" stroke="#211006" stroke-width="2" opacity=".65"/><circle cx="16" cy="17" r="2" fill="#e8c56a"/><circle cx="30" cy="17" r="2" fill="#e8c56a"/><path d="M9 20 L1 15 M9 25 L1 28 M37 20 L45 15 M37 25 L45 28" stroke="#211006" stroke-width="2" stroke-linecap="round"/><rect x="14" y="3" width="18" height="8" rx="2" fill="#eee1c6" stroke="#5a3a16"/><text x="23" y="9" text-anchor="middle" font-size="6" font-family="serif" fill="#5a2a10">DUE</text></svg>`;

function makePrairieWolfEnemy(area, sp){ const c=clampPatrolToPits(sp); const el=document.createElement('div'); el.className='enemy prairie-wolf'; el.innerHTML=PRAIRIE_WOLF_SVG; area.appendChild(el); return {el,type:'sentry',worldX:c.worldX,vx:c.vx||-1.3,patrolMin:c.patrolMin,patrolMax:c.patrolMax,dead:false}; }
function makeDustDevilEnemy(area, sp){ const c=clampPatrolToPits(sp); const el=document.createElement('div'); el.className='enemy dust-devil'; el.innerHTML=DUST_DEVIL_SVG; area.appendChild(el); return {el,type:'smokecloud',worldX:c.worldX,vx:c.vx||.72,patrolMin:c.patrolMin,patrolMax:c.patrolMax,baseY:c.baseY||150,amp:c.amp||34,phase:c.phase||0,dead:false}; }
function makeRailBaronEnemy(area, sp){ const c=clampPatrolToPits(sp); const el=document.createElement('div'); el.className='enemy rail-baron'; el.innerHTML=RAIL_BARON_SVG; area.appendChild(el); return {el,type:'sentry',worldX:c.worldX,vx:c.vx||-1.55,patrolMin:c.patrolMin,patrolMax:c.patrolMax,dead:false}; }
function makeDebtBeetleEnemy(area, sp){ const c=clampPatrolToPits(sp); const el=document.createElement('div'); el.className='enemy debt-beetle'; el.innerHTML=DEBT_BEETLE_SVG; area.appendChild(el); return {el,type:'sentry',worldX:c.worldX,vx:c.vx||-2.0,patrolMin:c.patrolMin,patrolMax:c.patrolMax,dead:false}; }

function addPlaceholderQuestionsForWest(){
  const labels = {
    '2-1':['Westward Trails','westward expansion, homesteads, railroads, and settlement'],
    '2-2':['Plains Under Pressure','Native Americans, buffalo, military conflict, and westward expansion'],
    '2-3':['Farmers and Populists','farmers, railroads, debt, Populism, and the Cross of Gold'],
    '2-4':['The Cross of Gold','farmers, railroads, Populism, and the Election of 1896']
  };
  Object.entries(labels).forEach(([rid,info])=>{
    QUESTION_BANK[rid]=Array.from({length:rid==='2-4'?10:12},(_,i)=>({
      id:rid+'-Q'+(i+1),
      stem:'Placeholder Source Block '+rid+String.fromCharCode(65+i)+': '+info[0]+' question placeholder. Choose the prototype answer to keep testing gameplay.',
      choices:['Prototype answer — correct for gameplay testing','Distractor answer — '+info[1]+' placeholder','Distractor answer — timeline vocabulary placeholder','Distractor answer — primary source placeholder'],
      correctIdx:0,
      explain:'Prototype feedback: later this will explain '+info[1]+'.'
    }));
  });
}
function moveIndustrialQuestionsToWorld3(){
  addPlaceholderQuestionsForWorld2();
  addWorld2Round23Questions();
  addWorld2Round24Questions();
  ['1','2','3','4'].forEach(n=>{ QUESTION_BANK['3-'+n] = (QUESTION_BANK['2-'+n]||[]).map(q=>({...q,id:q.id.replace('2-'+n,'3-'+n),stem:q.stem.replaceAll('2-'+n,'3-'+n)})); });
}
function configureWorld2WestAndWorld3Industry(){
  const w2=WORLDS.find(x=>x.id==='unit2');
  if(w2){
    w2.title='Challenges in the West'; w2.years='1865 - 1900'; w2.eraColor='#b56b2a'; w2.iconKey='wagon';
    w2.intro='Railroads, settlers, Native American displacement, farming struggles, Populism, and the fight over silver and gold reshape the West.';
    w2.unlocked=true; w2.comingSoon=false;
    w2.rounds=[
      {id:'2-1',num:'2-1',title:'Trails Across the Plains',sub:'Westward expansion, wagons, homesteads, and railroad paths',sampleSize:8},
      {id:'2-2',num:'2-2',title:'Plains Under Pressure',sub:'Native Americans, buffalo, military conflict, and railroad expansion',sampleSize:8},
      {id:'2-3',num:'2-3',title:'Farmers and Populists',sub:'Debt, railroad rates, Populism, and agrarian protest',sampleSize:8},
      {id:'2-4',num:'2-4',title:'The Cross of Gold',sub:'Castle: farmers, silver, gold, and the Election of 1896',sampleSize:10,isCastle:true}
    ];
  }
  const w3=WORLDS.find(x=>x.id==='unit3');
  if(w3){
    w3.title='Industrial Revolution'; w3.years='1865 - 1900'; w3.eraColor='#7a5018'; w3.iconKey='factory';
    w3.intro='Factories, railroads, steel, inventors, big business, labor unrest, trusts, and industrial power transform American life.';
    w3.unlocked=true; w3.comingSoon=false;
    w3.rounds=[
      {id:'3-1',num:'3-1',title:'Rails and Factories',sub:'Industrial growth, railroads, and trusts',sampleSize:8},
      {id:'3-2',num:'3-2',title:'Labor Rising',sub:'Strikes, unions, Pinkertons, steam, and machinery',sampleSize:8},
      {id:'3-3',num:'3-3',title:'City of Smoke',sub:'Industrial cities, newspapers, smoke, and vertical routes',sampleSize:8},
      {id:'3-4',num:'3-4',title:'Iron and Gold',sub:'Castle: trusts, labor conflict, and the Gilded Machine boss',sampleSize:10,isCastle:true}
    ];
  }
}

function clearWestArea(refs, theme){
  clearGildedArea(refs);
  const area=refs.area;
  area.classList.remove('theme-gilded','theme-gilded-rails','theme-gilded-labor','theme-gilded-city','theme-gilded-machine');
  area.classList.add(theme);
  G.boss=null; G.bossDefeated=false; G.finishGated=false; G.bossArenaActive=false;
}
function addWestFinish(area, label){
  const fEl=document.createElement('div'); fEl.className='finish-platform';
  fEl.innerHTML=`<div class="fp-post-l"></div><div class="fp-post-r"></div><div class="fp-bar"></div><div class="fp-banner">${label}</div><div class="fp-bunting"><div class="swag red"></div><div class="swag white"></div><div class="swag blue"></div><div class="swag white"></div><div class="swag red"></div></div><div class="fp-base"></div>`;
  area.appendChild(fEl); G.finishPlatform={el:fEl,worldX:FINISH-220,width:120,height:170};
}
function buildWestRound(refs, cfg){
  const area=refs.area; clearWestArea(refs,cfg.theme);
  const FIRST_X=820, SPACING=cfg.spacing||1260;
  G.platforms=[]; G.decoPlatforms=[]; G.pits=[]; G.enemies=[]; G.obstacles=[]; G.coins=[]; G.cannons=[];
  const count=cfg.count||8;
  for(let i=0;i<count;i++){ const worldX=FIRST_X+i*SPACING; const el=document.createElement('div'); el.className='platform armed source-block frontier-source'; const lbl=document.createElement('div'); lbl.className='platform-label'; lbl.textContent='SOURCE '+(i+1); el.appendChild(lbl); area.appendChild(el); G.platforms.push({el,lbl,worldX,idx:i,cleared:false,armed:true,width:86,height:86}); }
  addWestFinish(area,cfg.finish||'TRAIL END');
  (cfg.pits||[]).forEach(p=>{ const pit={worldX:FIRST_X+p.x,width:p.w}; const el=document.createElement('div'); el.className='pit'; el.style.width=pit.width+'px'; area.appendChild(el); pit.el=el; G.pits.push(pit); });
  (cfg.decos||[]).forEach(d=>{ const el=document.createElement('div'); el.className='deco-platform '+(d.cls||'wagon-plank'); el.style.width=d.w+'px'; el.style.height=(d.h||24)+'px'; el.style.bottom=(GROUND_HEIGHT+d.y)+'px'; area.appendChild(el); G.decoPlatforms.push({el,worldX:FIRST_X+d.x,width:d.w,height:d.h||24,bottomOffset:d.y}); });
  (cfg.enemies||[]).forEach(e=>{ const sp={worldX:FIRST_X+e.x,patrolMin:FIRST_X+e.min,patrolMax:FIRST_X+e.max,vx:e.vx,baseY:e.baseY,amp:e.amp,phase:e.phase}; if(e.kind==='dust')G.enemies.push(makeDustDevilEnemy(area,sp)); else if(e.kind==='baron')G.enemies.push(makeRailBaronEnemy(area,sp)); else if(e.kind==='debt')G.enemies.push(makeDebtBeetleEnemy(area,sp)); else G.enemies.push(makePrairieWolfEnemy(area,sp)); });
  (cfg.obstacles||[]).forEach(o=>{ const el=document.createElement('div'); el.className='obstacle '+(o.cls||'rail-spike'); area.appendChild(el); G.obstacles.push({el,type:o.type||'spike',worldX:FIRST_X+o.x,width:o.w||38,height:o.h||42,phase:o.phase||0}); });
  const spots=[]; (cfg.decos||[]).forEach((d,idx)=>{ if(idx%2===0 || d.hard){ spots.push({worldX:FIRST_X+d.x+d.w/2-28,y:d.y+(d.h||24)+34},{worldX:FIRST_X+d.x+d.w/2,y:d.y+(d.h||24)+40},{worldX:FIRST_X+d.x+d.w/2+28,y:d.y+(d.h||24)+34}); }});
  for(let i=0;i<count;i++){spots.push({worldX:FIRST_X+i*SPACING+520,y:64},{worldX:FIRST_X+i*SPACING+555,y:64});}
  spots.forEach(c=>{ if(G.pits.some(p=>c.worldX>p.worldX-25&&c.worldX<p.worldX+p.width+25&&c.y<90))return; const el=document.createElement('div'); el.className='coin gold-seal trail-token'; area.appendChild(el); G.coins.push({el,worldX:c.worldX,y:c.y,collected:false}); });
  createWorld2SourceSafeZones({before:220,after:360}); normalizeGoldSealAlignment();
  refs.skyClouds.innerHTML=''; for(let i=0;i<10;i++){ const c=document.createElement('div'); c.className='cloud'; const w=60+Math.random()*130; c.style.width=w+'px'; c.style.height=(w*.34)+'px'; c.style.left=(1+Math.random()*98)+'%'; c.style.top=(2+Math.random()*43)+'%'; refs.skyClouds.appendChild(c); }
  refs.msg.textContent=cfg.msg; refs.msg.classList.add('visible','prototype-note'); setTimeout(()=>refs.msg.classList.remove('visible','prototype-note'),5600);
}
function buildRound2_1_westTrails(refs){ buildWestRound(refs,{theme:'theme-west-trails',finish:'TRAIL END',msg:'2-1 Trails Across the Plains: wagon platforms, open prairie, ravines, Prairie Wolves, and Dust Devils.',pits:[{x:1550,w:150},{x:2920,w:185},{x:5360,w:170},{x:7800,w:205}],decos:[{x:330,w:130,y:70,cls:'wagon-plank'},{x:560,w:110,y:124,cls:'wagon-plank',hard:true},{x:1460,w:78,y:88,cls:'wagon-plank',hard:true},{x:1600,w:78,y:136,cls:'wagon-plank',hard:true},{x:1750,w:90,y:92,cls:'wagon-plank'},{x:2660,w:150,y:100,cls:'rail-trestle'},{x:2900,w:90,y:158,cls:'rail-trestle',hard:true},{x:3100,w:120,y:106,cls:'rail-trestle'},{x:5150,w:82,y:92,cls:'wagon-plank',hard:true},{x:5300,w:78,y:148,cls:'wagon-plank',hard:true},{x:5480,w:92,y:96,cls:'wagon-plank'},{x:7600,w:84,y:90,cls:'rail-trestle',hard:true},{x:7780,w:76,y:142,cls:'rail-trestle',hard:true},{x:7980,w:110,y:98,cls:'rail-trestle'}],enemies:[{kind:'wolf',x:1080,min:900,max:1330,vx:-1.15},{kind:'dust',x:2240,min:2050,max:2500,vx:.65,baseY:150,amp:30},{kind:'wolf',x:4300,min:4050,max:4620,vx:-1.25},{kind:'dust',x:6660,min:6450,max:6980,vx:-.7,baseY:175,amp:36}],obstacles:[{x:3620,cls:'tumbleweed',type:'bigblock',w:42,h:42},{x:8950,cls:'rail-spike',w:38,h:42}]}); }
function buildRound2_2_plainsPressure(refs){ buildWestRound(refs,{theme:'theme-west-plains',finish:'FORT GATE',msg:'2-2 Plains Under Pressure: rail lines cut across the plains, with careful jumps and abstract conflict hazards.',pits:[{x:1420,w:185},{x:2760,w:210},{x:4100,w:190},{x:6760,w:230},{x:8150,w:180}],decos:[{x:280,w:120,y:70,cls:'rail-trestle'},{x:520,w:100,y:132,cls:'rail-trestle',hard:true},{x:1340,w:78,y:92,cls:'rail-trestle',hard:true},{x:1500,w:78,y:152,cls:'rail-trestle',hard:true},{x:1680,w:100,y:102,cls:'rail-trestle'},{x:2700,w:80,y:94,cls:'wagon-plank',hard:true},{x:2870,w:72,y:150,cls:'wagon-plank',hard:true},{x:3050,w:92,y:108,cls:'wagon-plank'},{x:3950,w:100,y:86,cls:'rail-trestle'},{x:4140,w:76,y:146,cls:'rail-trestle',hard:true},{x:4330,w:96,y:96,cls:'rail-trestle'},{x:6600,w:88,y:92,cls:'wagon-plank',hard:true},{x:6780,w:78,y:156,cls:'wagon-plank',hard:true},{x:6990,w:110,y:106,cls:'wagon-plank'},{x:8000,w:90,y:88,cls:'rail-trestle',hard:true},{x:8170,w:82,y:142,cls:'rail-trestle',hard:true},{x:8380,w:120,y:98,cls:'rail-trestle'}],enemies:[{kind:'dust',x:1020,min:820,max:1220,vx:.72,baseY:160,amp:36},{kind:'wolf',x:2220,min:2050,max:2520,vx:-1.35},{kind:'baron',x:3560,min:3350,max:3820,vx:-1.5},{kind:'dust',x:5400,min:5200,max:5700,vx:-.78,baseY:190,amp:40},{kind:'wolf',x:7550,min:7360,max:7800,vx:-1.5}],obstacles:[{x:1880,cls:'rail-spike',w:38,h:42},{x:4800,cls:'rail-spike',w:38,h:42},{x:6130,cls:'tumbleweed',type:'bigblock',w:42,h:42},{x:9050,cls:'rail-spike',w:38,h:42}]}); }
function buildRound2_3_farmersPopulists(refs){ buildWestRound(refs,{theme:'theme-west-farmers',finish:'DEPOT STAGE',msg:'2-3 Farmers and Populists: debt, railroad rates, wind, and Populist pressure make this the hardest western route before the boss.',spacing:1320,pits:[{x:1550,w:190},{x:3050,w:230},{x:4540,w:200},{x:6120,w:250},{x:7900,w:210}],decos:[{x:310,w:130,y:74,cls:'farm-crate'},{x:560,w:96,y:142,cls:'farm-crate',hard:true},{x:1470,w:80,y:90,cls:'rail-trestle',hard:true},{x:1640,w:74,y:150,cls:'rail-trestle',hard:true},{x:1840,w:110,y:105,cls:'rail-trestle'},{x:2880,w:100,y:84,cls:'farm-crate'},{x:3070,w:82,y:148,cls:'farm-crate',hard:true},{x:3260,w:80,y:210,cls:'farm-crate',hard:true},{x:3490,w:112,y:132,cls:'farm-crate'},{x:4400,w:88,y:92,cls:'rail-trestle',hard:true},{x:4580,w:76,y:154,cls:'rail-trestle',hard:true},{x:4780,w:110,y:105,cls:'rail-trestle'},{x:5960,w:78,y:90,cls:'farm-crate',hard:true},{x:6120,w:70,y:150,cls:'farm-crate',hard:true},{x:6310,w:74,y:212,cls:'farm-crate',hard:true},{x:6530,w:118,y:138,cls:'farm-crate'},{x:7750,w:86,y:92,cls:'rail-trestle',hard:true},{x:7920,w:82,y:150,cls:'rail-trestle',hard:true},{x:8125,w:120,y:102,cls:'rail-trestle'}],enemies:[{kind:'debt',x:1120,min:910,max:1320,vx:-1.95},{kind:'dust',x:2380,min:2180,max:2680,vx:.82,baseY:185,amp:45},{kind:'baron',x:3920,min:3700,max:4200,vx:-1.65},{kind:'debt',x:5350,min:5150,max:5680,vx:-2.05},{kind:'dust',x:7050,min:6800,max:7350,vx:-.8,baseY:170,amp:38},{kind:'baron',x:9020,min:8820,max:9300,vx:-1.75}],obstacles:[{x:1920,cls:'rail-spike',w:38,h:42},{x:5000,cls:'tumbleweed',type:'bigblock',w:42,h:42},{x:7040,cls:'rail-spike',w:38,h:42},{x:9520,cls:'rail-spike',w:38,h:42}]}); }
function buildRound2_4_crossGold(refs){ buildWestRound(refs,{theme:'theme-west-crossgold',finish:'BALLOT GATE',msg:'2-4 The Cross of Gold: survive the western review route, then face the Rail Baron in a cleaner final arena.',spacing:1330,pits:[{x:1420,w:190},{x:2850,w:220},{x:4300,w:200},{x:5750,w:230},{x:7240,w:210}],decos:[{x:280,w:124,y:76,cls:'rail-trestle'},{x:520,w:100,y:142,cls:'rail-trestle',hard:true},{x:1360,w:82,y:92,cls:'farm-crate',hard:true},{x:1530,w:76,y:152,cls:'farm-crate',hard:true},{x:1730,w:108,y:104,cls:'farm-crate'},{x:2700,w:92,y:90,cls:'rail-trestle',hard:true},{x:2870,w:78,y:154,cls:'rail-trestle',hard:true},{x:3080,w:115,y:108,cls:'rail-trestle'},{x:4150,w:88,y:92,cls:'farm-crate',hard:true},{x:4330,w:78,y:156,cls:'farm-crate',hard:true},{x:4530,w:116,y:108,cls:'farm-crate'},{x:5600,w:86,y:90,cls:'rail-trestle',hard:true},{x:5770,w:78,y:150,cls:'rail-trestle',hard:true},{x:5985,w:120,y:104,cls:'rail-trestle'},{x:7100,w:86,y:94,cls:'farm-crate',hard:true},{x:7270,w:82,y:156,cls:'farm-crate',hard:true},{x:7480,w:122,y:108,cls:'farm-crate'},{x:8700,w:130,y:96,cls:'rail-trestle'},{x:9000,w:115,y:140,cls:'rail-trestle'}],enemies:[{kind:'debt',x:1080,min:890,max:1300,vx:-2.0},{kind:'baron',x:2250,min:2050,max:2500,vx:-1.65},{kind:'dust',x:3650,min:3420,max:3900,vx:.78,baseY:180,amp:42},{kind:'debt',x:5050,min:4850,max:5350,vx:-2.15},{kind:'baron',x:6600,min:6400,max:6900,vx:-1.75}],obstacles:[{x:1920,cls:'rail-spike',w:38,h:42},{x:3520,cls:'rail-spike',w:38,h:42},{x:6320,cls:'tumbleweed',type:'bigblock',w:42,h:42},{x:8150,cls:'rail-spike',w:38,h:42}]});
  const area=refs.area; const BOSS_X=10880;
  const bossEl=document.createElement('div'); bossEl.className='enemy boss rail-baron-boss'; bossEl.innerHTML=RAIL_BARON_SVG; area.appendChild(bossEl);
  const healthEl=document.createElement('div'); healthEl.className='boss-health'; healthEl.innerHTML='<div class="boss-health-label">RAIL BARON</div><div class="boss-health-fill"></div>'; area.appendChild(healthEl);
  const bossShadow=document.createElement('div'); bossShadow.className='boss-shadow'; area.appendChild(bossShadow);
  G.boss={el:bossEl,shadowEl:bossShadow,healthEl:healthEl,healthFill:healthEl.querySelector('.boss-health-fill'),worldX:BOSS_X,vx:-.72,patrolMin:BOSS_X-90,patrolMax:BOSS_X+90,y:0,vy:0,onGround:true,nextJumpAt:Date.now()+5600,nextShotAt:Date.now()+8200,shotIndex:0,health:3,maxHealth:3,dead:false,invulnerableUntil:0};
  G.bossDefeated=false; G.finishGated=true; G.bossArenaStartX=BOSS_X-690; G.bossArenaCameraX=BOSS_X-760; G.bossArenaActive=false;
  const arenaStart=G.bossArenaStartX-20; G.enemies=(G.enemies||[]).filter(e=>{const keep=e.worldX<arenaStart; if(!keep&&e.el?.parentNode)e.el.remove(); return keep;}); G.obstacles=(G.obstacles||[]).filter(o=>{const keep=o.worldX<arenaStart; if(!keep&&o.el?.parentNode)o.el.remove(); return keep;});
}

moveIndustrialQuestionsToWorld3();
addPlaceholderQuestionsForWest();
configureWorld2WestAndWorld3Industry();
if(typeof ROUND_BUILDERS !== 'undefined'){
  ROUND_BUILDERS['2-1']=buildRound2_1_westTrails;
  ROUND_BUILDERS['2-2']=buildRound2_2_plainsPressure;
  ROUND_BUILDERS['2-3']=buildRound2_3_farmersPopulists;
  ROUND_BUILDERS['2-4']=buildRound2_4_crossGold;
  ROUND_BUILDERS['3-1']=buildRound2_1_gildedPrototype;
  ROUND_BUILDERS['3-2']=buildRound2_2_laborUnrest;
  ROUND_BUILDERS['3-3']=buildRound2_3_cityLife;
  ROUND_BUILDERS['3-4']=buildRound2_4_ironGoldBoss;
}



// ════════════════════════════════════════════════════════════════
// WORLD 2 GAMEPLAY VARIETY PASS
// Goal: each western level has a different "verb": explore, time rails, fight wind/debt, boss.
// ════════════════════════════════════════════════════════════════
const WEST_DEPOT_SHOOTER_SVG = `<svg viewBox="0 0 56 58" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="28" cy="55" rx="20" ry="3" fill="rgba(0,0,0,.28)"/>
  <rect x="11" y="28" width="34" height="22" rx="2" fill="#7b4b25" stroke="#241208" stroke-width="1.2"/>
  <rect x="15" y="32" width="26" height="5" fill="#d7b760" opacity=".85"/>
  <rect x="18" y="40" width="20" height="6" fill="#3a2410" opacity=".75"/>
  <path d="M8 29 L28 12 L48 29 Z" fill="#5c3518" stroke="#241208" stroke-width="1.2"/>
  <rect x="24" y="8" width="8" height="8" fill="#3a2410"/>
  <text x="28" y="36" text-anchor="middle" font-size="8" font-family="serif" fill="#3a2208">$</text>
  <path d="M43 36 L55 34 L55 42 L43 41 Z" fill="#2b1a0d" stroke="#120804"/>
</svg>`;

function addWesternShooters(refs, specs){
  G.cannons = G.cannons || [];
  specs.forEach(s => {
    const el = document.createElement('div');
    el.className = 'cannon west-shooter';
    el.innerHTML = WEST_DEPOT_SHOOTER_SVG;
    refs.area.appendChild(el);
    G.cannons.push({
      el,
      worldX: 850 + s.x,
      cooldown: s.cooldown || 3900,
      pattern: s.pattern || 'low',
      shotIndex: 0,
      projectileClass: 'west-shot',
      lastFireAt: Date.now() - (s.cooldown || 3900) + (s.delay || 1500)
    });
  });
}

// 2-1 remains the gentlest level, but it now has a flatter exploratory route and an optional high wagon route.
function buildRound2_1_westTrails_variety(refs){
  buildWestRound(refs,{
    theme:'theme-west-trails',finish:'TRAIL END',spacing:1240,
    msg:'2-1 Trails Across the Plains: open prairie, wagon routes, optional high path, and a few simple hazards.',
    pits:[{x:1700,w:145},{x:3320,w:165},{x:6020,w:190},{x:8420,w:170}],
    decos:[
      {x:360,w:150,y:62,cls:'wagon-plank'},{x:610,w:110,y:118,cls:'wagon-plank',hard:true},{x:790,w:120,y:64,cls:'wagon-plank'},
      {x:1580,w:100,y:78,cls:'wagon-plank',hard:true},{x:1760,w:96,y:132,cls:'wagon-plank',hard:true},{x:1950,w:125,y:82,cls:'wagon-plank'},
      {x:2760,w:150,y:70,cls:'rail-trestle'},{x:3000,w:130,y:70,cls:'rail-trestle'},{x:3280,w:92,y:130,cls:'rail-trestle',hard:true},{x:3480,w:118,y:84,cls:'rail-trestle'},
      {x:4920,w:135,y:76,cls:'wagon-plank'},{x:5190,w:115,y:138,cls:'wagon-plank',hard:true},{x:5440,w:145,y:76,cls:'wagon-plank'},
      {x:5880,w:88,y:88,cls:'rail-cart',hard:true},{x:6040,w:84,y:145,cls:'rail-cart',hard:true},{x:6230,w:112,y:92,cls:'rail-cart'},
      {x:7540,w:165,y:70,cls:'wagon-plank'},{x:7800,w:118,y:126,cls:'wagon-plank',hard:true},{x:8060,w:150,y:70,cls:'wagon-plank'},
      {x:8320,w:92,y:92,cls:'rail-trestle',hard:true},{x:8490,w:88,y:145,cls:'rail-trestle',hard:true},{x:8680,w:130,y:94,cls:'rail-trestle'}
    ],
    enemies:[
      {kind:'wolf',x:1140,min:940,max:1440,vx:-1.1},
      {kind:'dust',x:2380,min:2150,max:2700,vx:.62,baseY:142,amp:28},
      {kind:'wolf',x:4430,min:4140,max:4700,vx:-1.18},
      {kind:'dust',x:6900,min:6620,max:7160,vx:-.68,baseY:168,amp:34}
    ],
    obstacles:[
      {x:3860,cls:'tumbleweed',type:'bigblock',w:42,h:42},
      {x:9020,cls:'rail-spike',w:38,h:42}
    ]
  });
  createWorld2SourceSafeZones({before:300,after:420});
}

// 2-2 is now the rail-timing level: rail carts, timed wind columns, and a couple of depot shooters.
function buildRound2_2_plainsPressure_variety(refs){
  buildWestRound(refs,{
    theme:'theme-west-plains',finish:'FORT GATE',spacing:1320,
    msg:'2-2 Plains Under Pressure: railroad timing, wind-gust windows, rail carts, and abstract conflict hazards.',
    pits:[{x:1500,w:210},{x:3160,w:240},{x:4920,w:210},{x:6620,w:260},{x:8350,w:220}],
    decos:[
      {x:300,w:140,y:66,cls:'rail-trestle'},{x:555,w:105,y:124,cls:'rail-cart',hard:true},{x:765,w:145,y:66,cls:'rail-trestle'},
      {x:1380,w:80,y:82,cls:'rail-cart',hard:true},{x:1540,w:78,y:138,cls:'rail-cart',hard:true},{x:1735,w:112,y:86,cls:'rail-trestle'},
      {x:2500,w:150,y:72,cls:'rail-trestle'},{x:2805,w:86,y:132,cls:'rail-cart',hard:true},{x:2985,w:78,y:188,cls:'rail-cart',hard:true},{x:3200,w:88,y:132,cls:'rail-cart',hard:true},{x:3405,w:130,y:82,cls:'rail-trestle'},
      {x:4300,w:130,y:70,cls:'wagon-plank'},{x:4580,w:102,y:136,cls:'wagon-plank',hard:true},{x:4860,w:86,y:88,cls:'rail-cart',hard:true},{x:5030,w:78,y:145,cls:'rail-cart',hard:true},{x:5220,w:120,y:92,cls:'rail-trestle'},
      {x:6200,w:160,y:70,cls:'rail-trestle'},{x:6510,w:88,y:122,cls:'rail-cart',hard:true},{x:6695,w:76,y:178,cls:'rail-cart',hard:true},{x:6905,w:128,y:86,cls:'rail-trestle'},
      {x:7900,w:118,y:76,cls:'wagon-plank'},{x:8150,w:95,y:132,cls:'rail-cart',hard:true},{x:8350,w:86,y:188,cls:'rail-cart',hard:true},{x:8570,w:135,y:94,cls:'rail-trestle'}
    ],
    enemies:[
      {kind:'dust',x:1050,min:880,max:1240,vx:.72,baseY:160,amp:36},
      {kind:'wolf',x:2220,min:2030,max:2500,vx:-1.35},
      {kind:'baron',x:3890,min:3660,max:4200,vx:-1.55},
      {kind:'dust',x:5750,min:5450,max:5980,vx:-.82,baseY:188,amp:42},
      {kind:'wolf',x:7480,min:7280,max:7800,vx:-1.45}
    ],
    obstacles:[
      {x:1920,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:0},
      {x:3700,cls:'rail-spike',w:38,h:42},
      {x:5520,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:850},
      {x:7250,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:350},
      {x:9150,cls:'rail-spike',w:38,h:42}
    ]
  });
  addWesternShooters(refs,[
    {x:4660,cooldown:4300,delay:1900,pattern:'low'},
    {x:7800,cooldown:4700,delay:2300,pattern:'alternate'}
  ]);
  createWorld2SourceSafeZones({before:340,after:470});
}

// 2-3 is the "economic pressure" level: grain-elevator climb, faster debt enemies, wind timing, and debt-note shots.
function buildRound2_3_farmersPopulists_variety(refs){
  buildWestRound(refs,{
    theme:'theme-west-farmers',finish:'DEPOT STAGE',spacing:1380,
    msg:'2-3 Farmers and Populists: grain-elevator climb, wind gusts, debt notices, and faster economic-pressure enemies.',
    pits:[{x:1620,w:200},{x:3280,w:245},{x:5050,w:220},{x:6900,w:270},{x:8750,w:210}],
    decos:[
      {x:320,w:140,y:70,cls:'farm-crate'},{x:590,w:95,y:136,cls:'farm-crate',hard:true},{x:820,w:125,y:78,cls:'farm-crate'},
      {x:1480,w:88,y:88,cls:'rail-trestle',hard:true},{x:1660,w:76,y:150,cls:'rail-trestle',hard:true},{x:1870,w:120,y:104,cls:'rail-trestle'},
      // grain elevator climb instead of simple three-step ladder
      {x:2700,w:115,y:70,cls:'grain-elevator'},{x:2915,w:96,y:128,cls:'grain-elevator',hard:true},{x:3105,w:84,y:190,cls:'grain-elevator',hard:true},{x:3310,w:88,y:250,cls:'grain-elevator',hard:true},{x:3545,w:140,y:154,cls:'grain-elevator'},
      {x:4450,w:120,y:80,cls:'farm-crate'},{x:4740,w:92,y:140,cls:'farm-crate',hard:true},{x:5000,w:80,y:96,cls:'rail-cart',hard:true},{x:5170,w:78,y:152,cls:'rail-cart',hard:true},{x:5390,w:130,y:92,cls:'rail-trestle'},
      {x:6200,w:126,y:76,cls:'grain-elevator'},{x:6485,w:88,y:136,cls:'grain-elevator',hard:true},{x:6690,w:76,y:198,cls:'grain-elevator',hard:true},{x:6920,w:82,y:146,cls:'grain-elevator',hard:true},{x:7160,w:138,y:90,cls:'farm-crate'},
      {x:8000,w:130,y:75,cls:'rail-trestle'},{x:8300,w:90,y:136,cls:'rail-cart',hard:true},{x:8520,w:78,y:196,cls:'rail-cart',hard:true},{x:8760,w:120,y:104,cls:'rail-trestle'},
      {x:9550,w:150,y:82,cls:'farm-crate'},{x:9820,w:110,y:142,cls:'grain-elevator',hard:true},{x:10060,w:155,y:84,cls:'farm-crate'}
    ],
    enemies:[
      {kind:'debt',x:1120,min:900,max:1320,vx:-2.05},
      {kind:'dust',x:2300,min:2100,max:2580,vx:.82,baseY:188,amp:44},
      {kind:'debt',x:4080,min:3820,max:4320,vx:-2.2},
      {kind:'baron',x:5850,min:5620,max:6120,vx:-1.65},
      {kind:'dust',x:7600,min:7350,max:7900,vx:-.86,baseY:174,amp:40},
      {kind:'baron',x:9280,min:9000,max:9520,vx:-1.72}
    ],
    obstacles:[
      {x:2060,cls:'rail-spike',w:38,h:42},
      {x:3920,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:650},
      {x:5850,cls:'tumbleweed',type:'bigblock',w:42,h:42},
      {x:7440,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:100},
      {x:9100,cls:'rail-spike',w:38,h:42}
    ]
  });
  addWesternShooters(refs,[
    {x:3600,cooldown:4400,delay:1600,pattern:'low'},
    {x:7200,cooldown:4800,delay:2400,pattern:'alternate'},
    {x:10150,cooldown:5200,delay:2100,pattern:'high'}
  ]);
  createWorld2SourceSafeZones({before:360,after:500});
}

// Keep the boss level, but widen the approach and add one pre-boss campaign hallway with fewer repetitive stair clusters.
function buildRound2_4_crossGold_variety(refs){
  buildWestRound(refs,{
    theme:'theme-west-crossgold',finish:'BALLOT GATE',spacing:1420,
    msg:'2-4 Cross of Gold: campaign-stage approach, spaced Source Blocks, and a cleaner Rail Baron boss arena.',
    pits:[{x:1540,w:210},{x:3270,w:240},{x:5060,w:230},{x:6900,w:260},{x:8580,w:220}],
    decos:[
      {x:310,w:150,y:72,cls:'rail-trestle'},{x:600,w:120,y:132,cls:'rail-cart',hard:true},{x:880,w:145,y:74,cls:'rail-trestle'},
      {x:1430,w:90,y:90,cls:'farm-crate',hard:true},{x:1605,w:78,y:152,cls:'farm-crate',hard:true},{x:1815,w:124,y:104,cls:'farm-crate'},
      {x:2700,w:145,y:78,cls:'grain-elevator'},{x:2990,w:92,y:140,cls:'grain-elevator',hard:true},{x:3200,w:80,y:202,cls:'grain-elevator',hard:true},{x:3450,w:130,y:108,cls:'grain-elevator'},
      {x:4480,w:130,y:80,cls:'rail-trestle'},{x:4770,w:90,y:138,cls:'rail-cart',hard:true},{x:5015,w:82,y:196,cls:'rail-cart',hard:true},{x:5260,w:130,y:104,cls:'rail-trestle'},
      {x:6200,w:160,y:74,cls:'farm-crate'},{x:6500,w:105,y:132,cls:'farm-crate',hard:true},{x:6810,w:88,y:194,cls:'grain-elevator',hard:true},{x:7040,w:130,y:108,cls:'farm-crate'},
      {x:7900,w:150,y:78,cls:'rail-trestle'},{x:8230,w:92,y:138,cls:'rail-cart',hard:true},{x:8480,w:86,y:194,cls:'rail-cart',hard:true},{x:8740,w:132,y:102,cls:'rail-trestle'},
      // campaign hallway / safe buildup before boss
      {x:9720,w:180,y:70,cls:'farm-crate'},{x:10080,w:150,y:120,cls:'grain-elevator'},{x:10420,w:190,y:72,cls:'rail-trestle'}
    ],
    enemies:[
      {kind:'debt',x:1120,min:900,max:1320,vx:-2.05},
      {kind:'baron',x:2350,min:2100,max:2620,vx:-1.62},
      {kind:'dust',x:4020,min:3760,max:4320,vx:.78,baseY:180,amp:42},
      {kind:'debt',x:5820,min:5560,max:6080,vx:-2.18},
      {kind:'baron',x:7600,min:7350,max:7900,vx:-1.72}
    ],
    obstacles:[
      {x:2060,cls:'rail-spike',w:38,h:42},
      {x:3920,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:700},
      {x:6120,cls:'tumbleweed',type:'bigblock',w:42,h:42},
      {x:9280,cls:'rail-spike',w:38,h:42}
    ]
  });
  addWesternShooters(refs,[
    {x:4550,cooldown:4600,delay:2000,pattern:'low'},
    {x:8180,cooldown:5200,delay:2600,pattern:'alternate'}
  ]);
  createWorld2SourceSafeZones({before:390,after:540});

  const area=refs.area; const BOSS_X=11850;
  const bossEl=document.createElement('div'); bossEl.className='enemy boss rail-baron-boss'; bossEl.innerHTML=RAIL_BARON_SVG; area.appendChild(bossEl);
  const healthEl=document.createElement('div'); healthEl.className='boss-health'; healthEl.innerHTML='<div class="boss-health-label">RAIL BARON</div><div class="boss-health-fill"></div>'; area.appendChild(healthEl);
  const bossShadow=document.createElement('div'); bossShadow.className='boss-shadow'; area.appendChild(bossShadow);
  G.boss={el:bossEl,shadowEl:bossShadow,healthEl:healthEl,healthFill:healthEl.querySelector('.boss-health-fill'),worldX:BOSS_X,vx:-.62,patrolMin:BOSS_X-80,patrolMax:BOSS_X+80,y:0,vy:0,onGround:true,nextJumpAt:Date.now()+6400,nextShotAt:Date.now()+9000,shotIndex:0,health:3,maxHealth:3,dead:false,invulnerableUntil:0};
  G.bossDefeated=false; G.finishGated=true; G.bossArenaStartX=BOSS_X-760; G.bossArenaCameraX=BOSS_X-820; G.bossArenaActive=false;
  const arenaStart=G.bossArenaStartX-30;
  G.enemies=(G.enemies||[]).filter(e=>{const keep=e.worldX<arenaStart; if(!keep&&e.el?.parentNode)e.el.remove(); return keep;});
  G.obstacles=(G.obstacles||[]).filter(o=>{const keep=o.worldX<arenaStart; if(!keep&&o.el?.parentNode)o.el.remove(); return keep;});
}

if(typeof ROUND_BUILDERS !== 'undefined'){
  ROUND_BUILDERS['2-1']=buildRound2_1_westTrails_variety;
  ROUND_BUILDERS['2-2']=buildRound2_2_plainsPressure_variety;
  ROUND_BUILDERS['2-3']=buildRound2_3_farmersPopulists_variety;
  ROUND_BUILDERS['2-4']=buildRound2_4_crossGold_variety;
}


/* ════════════════════════════════════════════════════════════════
   WORLD 2 BALANCE PASS — more patrol enemies, longer spacing,
   Source Blocks as safe reprieves rather than chaos traps.
   ════════════════════════════════════════════════════════════════ */
function buildRound2_1_westTrails_enemySpacing(refs){
  buildWestRound(refs,{
    theme:'theme-west-trails',finish:'TRAIL END',spacing:1540,
    msg:'2-1 Trails Across the Plains: longer spaces, safe Source Blocks, prairie patrols, and optional wagon routes.',
    pits:[{x:820,w:170},{x:2360,w:185},{x:3900,w:175},{x:5440,w:195},{x:6980,w:180},{x:8520,w:205},{x:10060,w:180}],
    decos:[
      {x:330,w:150,y:70,cls:'wagon-plank'},{x:620,w:110,y:128,cls:'wagon-plank',hard:true},{x:900,w:130,y:76,cls:'wagon-plank'},
      {x:1700,w:140,y:72,cls:'wagon-plank'},{x:2000,w:100,y:132,cls:'wagon-plank',hard:true},{x:2320,w:115,y:82,cls:'rail-trestle'},
      {x:3220,w:145,y:74,cls:'rail-trestle'},{x:3520,w:96,y:132,cls:'rail-trestle',hard:true},{x:3860,w:120,y:82,cls:'rail-trestle'},
      {x:4760,w:150,y:72,cls:'wagon-plank'},{x:5060,w:102,y:130,cls:'wagon-plank',hard:true},{x:5380,w:130,y:80,cls:'wagon-plank'},
      {x:6300,w:140,y:74,cls:'rail-trestle'},{x:6600,w:98,y:136,cls:'rail-trestle',hard:true},{x:6940,w:126,y:86,cls:'rail-trestle'},
      {x:7840,w:150,y:72,cls:'wagon-plank'},{x:8140,w:108,y:130,cls:'wagon-plank',hard:true},{x:8480,w:130,y:82,cls:'wagon-plank'},
      {x:9380,w:150,y:74,cls:'rail-trestle'},{x:9680,w:100,y:134,cls:'rail-trestle',hard:true},{x:10020,w:128,y:86,cls:'rail-trestle'},
      {x:10920,w:160,y:76,cls:'wagon-plank'},{x:11240,w:120,y:132,cls:'wagon-plank',hard:true}
    ],
    enemies:[
      {kind:'wolf',x:900,min:700,max:1140,vx:-1.12},
      {kind:'dust',x:1740,min:1580,max:2020,vx:.58,baseY:150,amp:28},
      {kind:'wolf',x:2440,min:2260,max:2720,vx:-1.18},
      {kind:'wolf',x:3980,min:3760,max:4240,vx:-1.22},
      {kind:'dust',x:5520,min:5300,max:5760,vx:-.62,baseY:165,amp:32},
      {kind:'wolf',x:7060,min:6840,max:7320,vx:-1.25},
      {kind:'dust',x:8600,min:8360,max:8860,vx:.65,baseY:170,amp:34},
      {kind:'wolf',x:10140,min:9920,max:10420,vx:-1.3}
    ],
    obstacles:[
      {x:1220,cls:'tumbleweed',type:'bigblock',w:42,h:42},
      {x:4300,cls:'tumbleweed',type:'bigblock',w:42,h:42},
      {x:7380,cls:'rail-spike',w:38,h:42},
      {x:10460,cls:'rail-spike',w:38,h:42}
    ]
  });
  createWorld2SourceSafeZones({before:360,after:560});
}

function buildRound2_2_plainsPressure_enemySpacing(refs){
  buildWestRound(refs,{
    theme:'theme-west-plains',finish:'FORT GATE',spacing:1540,
    msg:'2-2 Plains Under Pressure: safe Source stops, then railroad timing lanes with patrols, wind, and depot fire.',
    pits:[{x:820,w:190},{x:2360,w:225},{x:3900,w:200},{x:5440,w:240},{x:6980,w:210},{x:8520,w:235},{x:10060,w:200}],
    decos:[
      {x:300,w:145,y:68,cls:'rail-trestle'},{x:610,w:104,y:126,cls:'rail-cart',hard:true},{x:930,w:138,y:72,cls:'rail-trestle'},
      {x:1690,w:128,y:72,cls:'rail-trestle'},{x:1980,w:90,y:132,cls:'rail-cart',hard:true},{x:2320,w:120,y:86,cls:'rail-trestle'},
      {x:3220,w:150,y:70,cls:'rail-trestle'},{x:3500,w:86,y:128,cls:'rail-cart',hard:true},{x:3810,w:84,y:184,cls:'rail-cart',hard:true},{x:4050,w:130,y:86,cls:'rail-trestle'},
      {x:4760,w:138,y:74,cls:'wagon-plank'},{x:5060,w:102,y:132,cls:'wagon-plank',hard:true},{x:5400,w:124,y:86,cls:'rail-trestle'},
      {x:6300,w:150,y:70,cls:'rail-trestle'},{x:6600,w:90,y:128,cls:'rail-cart',hard:true},{x:6900,w:82,y:184,cls:'rail-cart',hard:true},{x:7160,w:130,y:86,cls:'rail-trestle'},
      {x:7840,w:138,y:74,cls:'wagon-plank'},{x:8140,w:102,y:132,cls:'rail-cart',hard:true},{x:8480,w:128,y:86,cls:'rail-trestle'},
      {x:9380,w:150,y:70,cls:'rail-trestle'},{x:9680,w:92,y:128,cls:'rail-cart',hard:true},{x:10020,w:128,y:86,cls:'rail-trestle'},
      {x:10940,w:160,y:74,cls:'rail-trestle'},{x:11270,w:120,y:132,cls:'rail-cart',hard:true}
    ],
    enemies:[
      {kind:'wolf',x:880,min:700,max:1130,vx:-1.35},
      {kind:'dust',x:1680,min:1520,max:1950,vx:.72,baseY:162,amp:35},
      {kind:'baron',x:2480,min:2250,max:2740,vx:-1.48},
      {kind:'wolf',x:3240,min:3060,max:3500,vx:-1.42},
      {kind:'dust',x:4020,min:3780,max:4300,vx:-.8,baseY:185,amp:42},
      {kind:'baron',x:5560,min:5320,max:5840,vx:-1.55},
      {kind:'wolf',x:7100,min:6860,max:7360,vx:-1.5},
      {kind:'dust',x:8640,min:8400,max:8920,vx:.82,baseY:178,amp:40},
      {kind:'baron',x:10180,min:9940,max:10480,vx:-1.6}
    ],
    obstacles:[
      {x:1260,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:0},
      {x:2780,cls:'rail-spike',w:38,h:42},
      {x:4320,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:850},
      {x:5860,cls:'rail-spike',w:38,h:42},
      {x:7400,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:350},
      {x:10480,cls:'rail-spike',w:38,h:42}
    ]
  });
  addWesternShooters(refs,[
    {x:4700,cooldown:5200,delay:1800,pattern:'low'},
    {x:7780,cooldown:5600,delay:2400,pattern:'alternate'},
    {x:10850,cooldown:5900,delay:3100,pattern:'low'}
  ]);
  createWorld2SourceSafeZones({before:380,after:590});
}

function buildRound2_3_farmersPopulists_enemySpacing(refs){
  buildWestRound(refs,{
    theme:'theme-west-farmers',finish:'DEPOT STAGE',spacing:1540,
    msg:'2-3 Farmers and Populists: grain-elevator climbs, debt patrols, wind lanes, and calmer Source checkpoints.',
    pits:[{x:820,w:195},{x:2360,w:230},{x:3900,w:210},{x:5440,w:250},{x:6980,w:220},{x:8520,w:245},{x:10060,w:210}],
    decos:[
      {x:310,w:150,y:74,cls:'farm-crate'},{x:620,w:100,y:136,cls:'farm-crate',hard:true},{x:930,w:135,y:80,cls:'farm-crate'},
      {x:1650,w:112,y:74,cls:'grain-elevator'},{x:1880,w:92,y:132,cls:'grain-elevator',hard:true},{x:2090,w:82,y:190,cls:'grain-elevator',hard:true},{x:2320,w:130,y:98,cls:'grain-elevator'},
      {x:3210,w:135,y:76,cls:'rail-trestle'},{x:3510,w:92,y:134,cls:'rail-cart',hard:true},{x:3820,w:88,y:190,cls:'rail-cart',hard:true},{x:4070,w:126,y:96,cls:'rail-trestle'},
      {x:4720,w:124,y:76,cls:'farm-crate'},{x:4990,w:92,y:134,cls:'farm-crate',hard:true},{x:5200,w:82,y:194,cls:'grain-elevator',hard:true},{x:5450,w:132,y:98,cls:'grain-elevator'},
      {x:6280,w:135,y:76,cls:'rail-trestle'},{x:6580,w:92,y:134,cls:'rail-cart',hard:true},{x:6900,w:90,y:190,cls:'rail-cart',hard:true},{x:7150,w:128,y:96,cls:'rail-trestle'},
      {x:7800,w:124,y:76,cls:'farm-crate'},{x:8070,w:92,y:134,cls:'grain-elevator',hard:true},{x:8290,w:82,y:194,cls:'grain-elevator',hard:true},{x:8540,w:132,y:98,cls:'farm-crate'},
      {x:9360,w:135,y:76,cls:'rail-trestle'},{x:9660,w:92,y:134,cls:'rail-cart',hard:true},{x:10000,w:128,y:96,cls:'rail-trestle'},
      {x:10920,w:160,y:78,cls:'farm-crate'},{x:11260,w:118,y:138,cls:'grain-elevator',hard:true}
    ],
    enemies:[
      {kind:'debt',x:900,min:690,max:1120,vx:-2.0},
      {kind:'dust',x:1700,min:1500,max:1980,vx:.78,baseY:185,amp:42},
      {kind:'baron',x:2480,min:2250,max:2750,vx:-1.58},
      {kind:'debt',x:3240,min:3040,max:3520,vx:-2.14},
      {kind:'dust',x:4020,min:3760,max:4300,vx:-.84,baseY:176,amp:40},
      {kind:'debt',x:5560,min:5320,max:5840,vx:-2.18},
      {kind:'baron',x:7100,min:6860,max:7380,vx:-1.65},
      {kind:'dust',x:8640,min:8400,max:8920,vx:.84,baseY:172,amp:38},
      {kind:'debt',x:10180,min:9940,max:10480,vx:-2.22}
    ],
    obstacles:[
      {x:1260,cls:'rail-spike',w:38,h:42},
      {x:2780,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:650},
      {x:4320,cls:'tumbleweed',type:'bigblock',w:42,h:42},
      {x:5860,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:100},
      {x:7400,cls:'rail-spike',w:38,h:42},
      {x:10480,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:500}
    ]
  });
  addWesternShooters(refs,[
    {x:3160,cooldown:5200,delay:1600,pattern:'low'},
    {x:6240,cooldown:5600,delay:2400,pattern:'alternate'},
    {x:9320,cooldown:6000,delay:3200,pattern:'high'}
  ]);
  createWorld2SourceSafeZones({before:390,after:610});
}

function buildRound2_4_crossGold_enemySpacing(refs){
  buildWestRound(refs,{
    theme:'theme-west-crossgold',finish:'BALLOT GATE',spacing:1540,
    msg:'2-4 The Cross of Gold: challenge lanes return, but Source Blocks are safe campaign stops before the Rail Baron.',
    pits:[{x:820,w:200},{x:2360,w:235},{x:3900,w:215},{x:5440,w:255},{x:6980,w:225},{x:8520,w:245},{x:10060,w:215}],
    decos:[
      {x:310,w:150,y:74,cls:'rail-trestle'},{x:620,w:112,y:132,cls:'rail-cart',hard:true},{x:940,w:140,y:76,cls:'rail-trestle'},
      {x:1660,w:128,y:78,cls:'farm-crate'},{x:1950,w:96,y:138,cls:'farm-crate',hard:true},{x:2300,w:126,y:94,cls:'farm-crate'},
      {x:3190,w:130,y:78,cls:'grain-elevator'},{x:3480,w:92,y:140,cls:'grain-elevator',hard:true},{x:3780,w:84,y:198,cls:'grain-elevator',hard:true},{x:4040,w:128,y:102,cls:'grain-elevator'},
      {x:4740,w:134,y:78,cls:'rail-trestle'},{x:5040,w:96,y:138,cls:'rail-cart',hard:true},{x:5340,w:90,y:194,cls:'rail-cart',hard:true},{x:5600,w:130,y:102,cls:'rail-trestle'},
      {x:6280,w:140,y:76,cls:'farm-crate'},{x:6580,w:102,y:136,cls:'farm-crate',hard:true},{x:6860,w:90,y:194,cls:'grain-elevator',hard:true},{x:7140,w:130,y:102,cls:'farm-crate'},
      {x:7820,w:134,y:78,cls:'rail-trestle'},{x:8120,w:96,y:138,cls:'rail-cart',hard:true},{x:8420,w:90,y:194,cls:'rail-cart',hard:true},{x:8680,w:130,y:102,cls:'rail-trestle'},
      {x:9360,w:150,y:78,cls:'farm-crate'},{x:9660,w:106,y:136,cls:'farm-crate',hard:true},{x:10000,w:135,y:100,cls:'rail-trestle'},
      {x:10940,w:170,y:78,cls:'farm-crate'},{x:11300,w:150,y:128,cls:'grain-elevator'},{x:11620,w:180,y:78,cls:'rail-trestle'}
    ],
    enemies:[
      {kind:'debt',x:900,min:690,max:1120,vx:-2.05},
      {kind:'baron',x:1700,min:1500,max:1980,vx:-1.58},
      {kind:'dust',x:2480,min:2240,max:2750,vx:.72,baseY:178,amp:40},
      {kind:'debt',x:3240,min:3040,max:3520,vx:-2.18},
      {kind:'baron',x:5560,min:5320,max:5840,vx:-1.68},
      {kind:'dust',x:7100,min:6860,max:7380,vx:-.8,baseY:180,amp:42},
      {kind:'debt',x:8640,min:8400,max:8920,vx:-2.2},
      {kind:'baron',x:10180,min:9940,max:10480,vx:-1.72}
    ],
    obstacles:[
      {x:1260,cls:'rail-spike',w:38,h:42},
      {x:2780,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:700},
      {x:4320,cls:'rail-spike',w:38,h:42},
      {x:5860,cls:'tumbleweed',type:'bigblock',w:42,h:42},
      {x:7400,cls:'wind-gust hazard',type:'steam-vent',w:72,h:86,phase:250},
      {x:10480,cls:'rail-spike',w:38,h:42}
    ]
  });
  addWesternShooters(refs,[
    {x:4700,cooldown:5600,delay:2200,pattern:'low'},
    {x:7780,cooldown:6000,delay:2900,pattern:'alternate'}
  ]);
  createWorld2SourceSafeZones({before:410,after:640});

  const area=refs.area; const BOSS_X=11940;
  const bossEl=document.createElement('div'); bossEl.className='enemy boss rail-baron-boss'; bossEl.innerHTML=RAIL_BARON_SVG; area.appendChild(bossEl);
  const healthEl=document.createElement('div'); healthEl.className='boss-health'; healthEl.innerHTML='<div class="boss-health-label">RAIL BARON</div><div class="boss-health-fill"></div>'; area.appendChild(healthEl);
  const bossShadow=document.createElement('div'); bossShadow.className='boss-shadow'; area.appendChild(bossShadow);
  G.boss={el:bossEl,shadowEl:bossShadow,healthEl:healthEl,healthFill:healthEl.querySelector('.boss-health-fill'),worldX:BOSS_X,vx:-.58,patrolMin:BOSS_X-85,patrolMax:BOSS_X+85,y:0,vy:0,onGround:true,nextJumpAt:Date.now()+6800,nextShotAt:Date.now()+9800,shotIndex:0,health:3,maxHealth:3,dead:false,invulnerableUntil:0};
  G.bossDefeated=false; G.finishGated=true; G.bossArenaStartX=BOSS_X-770; G.bossArenaCameraX=BOSS_X-830; G.bossArenaActive=false;
  const arenaStart=G.bossArenaStartX-30;
  G.enemies=(G.enemies||[]).filter(e=>{const keep=e.worldX<arenaStart; if(!keep&&e.el?.parentNode)e.el.remove(); return keep;});
  G.obstacles=(G.obstacles||[]).filter(o=>{const keep=o.worldX<arenaStart; if(!keep&&o.el?.parentNode)o.el.remove(); return keep;});
}

if(typeof ROUND_BUILDERS !== 'undefined'){
  ROUND_BUILDERS['2-1']=buildRound2_1_westTrails_enemySpacing;
  ROUND_BUILDERS['2-2']=buildRound2_2_plainsPressure_enemySpacing;
  ROUND_BUILDERS['2-3']=buildRound2_3_farmersPopulists_enemySpacing;
  ROUND_BUILDERS['2-4']=buildRound2_4_crossGold_enemySpacing;
}

boot();
