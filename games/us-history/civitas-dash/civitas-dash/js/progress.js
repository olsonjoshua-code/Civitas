// Civitas Dash identity, Supabase storage, and progress rollup logic.
// Loaded after data/unit1.js and before js/engine.js.

// ════════════════════════════════════════════════════════════════
// CIVITAS DASH — Chunks 1 + 2 + 3 + 4 + 5 (partial)
// Skeleton, data, identity, Supabase storage, world map,
// unit-entry, playable Round 1-1 (sentries), Round 1-2 (sentries +
// cannons, battlefield theme), parchment question modal, spinning
// star round-clear celebration.
// What's NOT here yet: Round 1-3 (sentries+cannons+falling debris),
// Round 1-4 castle (all + redeemer + general boss), Units 2-17,
// leaderboard (Chunk 6), certificate (Chunk 6), hub
// integration (Chunk 7), mobile touch controls (polish pass).
// ════════════════════════════════════════════════════════════════

// ── SUPABASE CONFIG ─────────────────────────────────────────
// Same project as the Civitas hub and house-divided.html.
const SUPA_URL = 'https://dnmrwglrcvlbamzhlzlx.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRubXJ3Z2xyY3ZsYmFtemhsemx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjA2OTEsImV4cCI6MjA4OTQzNjY5MX0.jEIM-dGgB0cUS0A6w31LJ5AK9QDCS_UqdVnPrb8dlXM';
const SUPA_HEADERS = {
  'Content-Type':'application/json',
  'apikey': SUPA_KEY,
  'Authorization':'Bearer ' + SUPA_KEY,
};

const TABLE = 'civitas_dash_progress';
const CACHE_KEY = 'civitas_dash_cache';
const PENDING_KEY = 'civitas_dash_pending';
const FETCH_TIMEOUT_MS = 6000;

// ════════════════════════════════════════════════════════════════
// IDENTITY — read from civitas_state set by the Civitas hub.
// ════════════════════════════════════════════════════════════════
const IDENTITY = (function(){
  // The session guard already verified one of these is valid.
  // Try civitas_state first (current), then ac_shell_state (legacy).
  try{
    const civ = JSON.parse(localStorage.getItem('civitas_state') || 'null');
    if(civ && civ.name && civ.name !== 'Guest'){
      return {
        name: civ.name,
        fullName: civ.fullName || civ.name,
        period: civ.period || null,
        avatar: civ.avatar || null,
        rank: civ.rank || null,
        source: 'civitas',
      };
    }
  }catch(e){}
  try{
    const ac = JSON.parse(localStorage.getItem('ac_shell_state') || 'null');
    if(ac && ac.name && ac.name !== 'Guest'){
      return {
        name: ac.name,
        fullName: ac.fullName || ac.name,
        period: ac.period || null,
        avatar: ac.avatar || null,
        rank: ac.rank || null,
        source: 'ac_legacy',
      };
    }
  }catch(e){}
  // Should be unreachable — the session guard would have redirected.
  return { name:'Guest', fullName:'Guest', period:null, avatar:null, rank:null, source:'fallback' };
})();

// ════════════════════════════════════════════════════════════════
// PROGRESS — the in-memory state, mirroring the Supabase row shape.
// Always rebuild rollups (composite_score, completion_pct, etc.)
// from `rounds` and `units` before persisting.
// ════════════════════════════════════════════════════════════════
function freshProgress(){
  return {
    full_name: IDENTITY.fullName,
    display_name: IDENTITY.name,
    period: IDENTITY.period || '',
    rounds: {},
    units: {},
    composite_score: 0,
    completion_pct: 0,
    trophy_tier: 'none',
    rounds_completed: 0,
    rounds_total: ROUNDS_TOTAL_PROJECTED,
    units_completed: 0,
    total_runs: 0,
    total_coins: 0,
    coin_meter: 0,
    best_unit1_ms: null,
    last_played_at: null,
  };
}

let PROGRESS = freshProgress();

// ════════════════════════════════════════════════════════════════
// STORAGE — Supabase is the source of truth. localStorage is a
// short-lived cache. Pending writes queue if Supabase is unreachable.
// ════════════════════════════════════════════════════════════════
const STORE = {
  // Try Supabase first. Returns row or null. Times out after FETCH_TIMEOUT_MS.
  async fetchRemote(){
    if(!IDENTITY.fullName || IDENTITY.fullName === 'Guest') return null;
    const url = SUPA_URL + '/rest/v1/' + TABLE
      + '?full_name=eq.' + encodeURIComponent(IDENTITY.fullName)
      + '&select=*&limit=1';
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), FETCH_TIMEOUT_MS);
    try{
      const r = await fetch(url, { headers: SUPA_HEADERS, signal: ctrl.signal });
      clearTimeout(timer);
      if(!r.ok) return null;
      const rows = await r.json();
      return (rows && rows[0]) || null;
    }catch(e){
      clearTimeout(timer);
      return null;
    }
  },

  // Push current PROGRESS state to Supabase. Returns true on success.
  async pushRemote(payload){
    if(!IDENTITY.fullName || IDENTITY.fullName === 'Guest') return false;
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), FETCH_TIMEOUT_MS);
    try{
      const r = await fetch(SUPA_URL + '/rest/v1/' + TABLE + '?on_conflict=full_name', {
        method:'POST',
        keepalive: true,
        headers: Object.assign({}, SUPA_HEADERS, {'Prefer':'resolution=merge-duplicates'}),
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      return r.ok;
    }catch(e){
      clearTimeout(timer);
      return false;
    }
  },

  readCache(){
    try{
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  },

  writeCache(progress){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(progress)); }
    catch(e){ /* private browsing or full quota — non-fatal */ }
  },

  // Pending writes queue — for failed Supabase pushes.
  readPending(){
    try{
      const raw = localStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return []; }
  },

  queuePending(payload){
    try{
      const q = STORE.readPending();
      q.push({ at: Date.now(), payload });
      localStorage.setItem(PENDING_KEY, JSON.stringify(q));
    }catch(e){}
  },

  clearPending(){
    try{ localStorage.removeItem(PENDING_KEY); }catch(e){}
  },

  // Replay any pending writes left from a previous session.
  // Called once after the initial load.
  async replayPending(){
    const queue = STORE.readPending();
    if(!queue.length) return;
    let allOK = true;
    for(const item of queue){
      const ok = await STORE.pushRemote(item.payload);
      if(!ok){ allOK = false; break; }
    }
    if(allOK) STORE.clearPending();
  },

  // ── Public API ──────────────────────────────────────────
  // Initial load: try Supabase, fall back to cache.
  // The Supabase row (if found) replaces local cache.
  async load(){
    const remote = await STORE.fetchRemote();
    if(remote){
      const merged = mergeRemoteIntoProgress(remote);
      STORE.writeCache(merged);
      // Also try to flush any pending writes the cache had.
      await STORE.replayPending();
      return { source:'remote', progress: merged };
    }
    // Supabase unreachable or no row yet. Use cache.
    const cached = STORE.readCache();
    if(cached){
      return { source:'cache', progress: cached };
    }
    // First-ever play. Fresh.
    const fresh = freshProgress();
    return { source:'fresh', progress: fresh };
  },

  // Save: build payload, push to Supabase, on failure queue locally.
  // Always update local cache too — fast UI re-render.
  async save(progress){
    const payload = buildPayload(progress);
    STORE.writeCache(progress);
    const ok = await STORE.pushRemote(payload);
    if(!ok) STORE.queuePending(payload);
    return ok;
  },
};

// Rollup recalculator — runs before every save.
// Reads `rounds` JSON and computes denormalized columns.
function recomputeRollups(progress){
  const roundIds = Object.keys(progress.rounds || {});
  const roundsCompleted = roundIds.length;

  // Composite score: average accuracy across all completed rounds.
  // Unattempted rounds count as 0 against the projected total — but only
  // when computing completion_pct, NOT composite_score (otherwise an early
  // 90% performer would show as 6% which feels wrong). Keep them separate.
  let accSum = 0;
  for(const id of roundIds){
    const r = progress.rounds[id];
    accSum += (r && typeof r.accuracy === 'number') ? r.accuracy : 0;
  }
  const composite = roundsCompleted > 0 ? Math.round(accSum / roundsCompleted) : 0;

  // Completion percentage uses the projected denominator (all 17 worlds).
  const completionPct = Math.round((roundsCompleted / progress.rounds_total) * 100);

  // Per-unit rollups
  const units = {};
  let unitsCompleted = 0;
  for(const world of WORLDS){
    if(!world.rounds || !world.rounds.length) continue;
    const completedInUnit = world.rounds.filter(rd => progress.rounds[rd.id]).length;
    const unitTotal = world.rounds.length;
    const unitAccs = world.rounds
      .map(rd => progress.rounds[rd.id])
      .filter(Boolean)
      .map(r => r.accuracy || 0);
    const unitAcc = unitAccs.length ? Math.round(unitAccs.reduce((a,b)=>a+b,0) / unitAccs.length) : 0;
    units[world.id] = {
      roundsCompleted: completedInUnit,
      roundsTotal: unitTotal,
      accuracy: unitAcc,
      tier: tierForScore(unitAcc, completedInUnit === unitTotal),
      completedAt: completedInUnit === unitTotal ? (progress.units?.[world.id]?.completedAt || new Date().toISOString()) : null,
    };
    if(completedInUnit === unitTotal) unitsCompleted++;
  }
  progress.units = units;

  progress.composite_score = composite;
  progress.completion_pct = completionPct;
  progress.trophy_tier = tierForScore(composite, roundsCompleted >= 1);
  progress.rounds_completed = roundsCompleted;
  progress.units_completed = unitsCompleted;
  progress.last_played_at = new Date().toISOString();
}

function tierForScore(acc, attempted){
  if(!attempted) return 'none';
  if(acc === 100) return 'historian';
  if(acc >= 90)  return 'gold';
  if(acc >= 80)  return 'silver';
  if(acc >= 70)  return 'bronze';
  if(acc >= 60)  return 'completed';
  return 'tryagain';
}

function buildPayload(progress){
  recomputeRollups(progress);
  return {
    full_name:        progress.full_name,
    display_name:     progress.display_name,
    period:           progress.period || '',
    rounds:           progress.rounds,
    units:            progress.units,
    composite_score:  progress.composite_score,
    completion_pct:   progress.completion_pct,
    trophy_tier:      progress.trophy_tier,
    rounds_completed: progress.rounds_completed,
    rounds_total:     progress.rounds_total,
    units_completed:  progress.units_completed,
    total_runs:       progress.total_runs,
    total_coins:      progress.total_coins,
    best_unit1_ms:    progress.best_unit1_ms,
    last_played_at:   progress.last_played_at,
  };
}

// Convert a Supabase row into our PROGRESS shape.
function mergeRemoteIntoProgress(row){
  const fresh = freshProgress();
  return {
    ...fresh,
    full_name:        row.full_name || fresh.full_name,
    display_name:     row.display_name || fresh.display_name,
    period:           row.period || fresh.period,
    rounds:           (typeof row.rounds === 'object' && row.rounds) ? row.rounds : {},
    units:            (typeof row.units === 'object' && row.units) ? row.units : {},
    composite_score:  row.composite_score || 0,
    completion_pct:   row.completion_pct || 0,
    trophy_tier:      row.trophy_tier || 'none',
    rounds_completed: row.rounds_completed || 0,
    rounds_total:     row.rounds_total || ROUNDS_TOTAL_PROJECTED,
    units_completed:  row.units_completed || 0,
    total_runs:       row.total_runs || 0,
    total_coins:      row.total_coins || 0,
    coin_meter:       row.coin_meter || 0,
    best_unit1_ms:    row.best_unit1_ms || null,
    last_played_at:   row.last_played_at || null,
  };
}
