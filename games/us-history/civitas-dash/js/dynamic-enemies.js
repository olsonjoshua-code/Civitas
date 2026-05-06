/* ════════════════════════════════════════════════════════════════
 * DYNAMIC ENEMIES — Civitas Dash Unit 2 + 3 gameplay overhaul.
 *
 * Loaded AFTER engine.js. Pure additive: nothing in engine.js is
 * mutated except (1) window.loop is wrapped to give enemies custom
 * per-frame ticks, (2) window.freshGameState is wrapped so we can
 * see G, and (3) ROUND_BUILDERS for unit 2/3 rounds are reassigned.
 * Unit 1 is untouched.
 *
 * Design goals:
 *   • Each enemy type has its OWN behavior, not just a sprite swap.
 *   • Patrol ranges are wide enough to feel like pursuit, not pacing.
 *   • Each round has at least one set-piece — train, stampede, river,
 *     or machine-arm corridor — that breaks the pit-deco-enemy template.
 *   • Hazards are TELEGRAPHED before they fire. Audio cues + visual
 *     warning banners let the player react fairly.
 *   • Audio is synthesized via Web Audio API at runtime (no asset
 *     files, keeps the GitHub Pages deploy lightweight).
 * ════════════════════════════════════════════════════════════════ */

(function(){
'use strict';

// ── INTEGRATION HOOKS ───────────────────────────────────────────
// engine.js declares G with `let`, so it's NOT on window. To observe
// G's mutations we patch freshGameState() (which IS on window because
// it's a top-level function declaration) so it mirrors each new state
// object to window.G. After that, both engine.js's internal `G` and
// our window.G point at the same object — mutations are bidirectional.
//
// To run our per-frame AI ticks, we wrap window.loop. Engine declares
// loop() at top level so it's also on window. Our wrapper runs our
// tick BEFORE delegating to the original, so enemy AI updates worldX
// before the engine's patrol pass reads them.

const _origFreshGameState = window.freshGameState;
if(typeof _origFreshGameState === 'function'){
  window.freshGameState = function deFreshGameState(){
    const state = _origFreshGameState.apply(this, arguments);
    window.G = state;
    return state;
  };
} else {
  console.warn('[dynamic-enemies] window.freshGameState not found. Custom AI will not run.');
}

const _origLoop = window.loop;
if(typeof _origLoop === 'function'){
  window.loop = function deLoop(refs, myLoopId){
    try { deTickAll(refs); }
    catch(err){ console.error('[dynamic-enemies] tick error', err); }
    return _origLoop(refs, myLoopId);
  };
} else {
  console.warn('[dynamic-enemies] window.loop not found. Custom AI will not run.');
}

function getG(){ return window.G || null; }

// Constants from engine.js
const PLAYER_LEFT = 120;
const GROUND_HEIGHT = 130;

// ── AUDIO SYSTEM ────────────────────────────────────────────────
// All sound effects synthesized at runtime with Web Audio API.
const Audio = (function(){
  let ctx = null;
  let unlocked = false;
  let muted = (localStorage.getItem('civitas_audio_muted') === '1');

  function ensureCtx(){
    if(!ctx){
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ ctx = null; }
    }
    return ctx;
  }

  function unlock(){
    if(unlocked) return;
    const c = ensureCtx();
    if(!c) return;
    if(c.state === 'suspended'){ c.resume().catch(()=>{}); }
    unlocked = true;
  }
  document.addEventListener('keydown', unlock);
  document.addEventListener('pointerdown', unlock);

  function tone(opts){
    if(muted) return;
    const c = ensureCtx();
    if(!c || c.state !== 'running') return;
    const {
      type='sine', freq=440, freqEnd=null,
      attack=0.01, decay=0.05, sustain=1.0, release=0.08,
      volume=0.18, duration=0.15, when=0,
    } = opts;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if(freqEnd != null){
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    }
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.linearRampToValueAtTime(volume * sustain, t0 + attack + decay);
    gain.gain.linearRampToValueAtTime(0, t0 + duration + release);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + release + 0.05);
  }

  function noise(opts){
    if(muted) return;
    const c = ensureCtx();
    if(!c || c.state !== 'running') return;
    const {
      duration=0.4, volume=0.18, lowpass=600, highpass=80, when=0,
    } = opts;
    const t0 = c.currentTime + when;
    const len = Math.max(1, Math.floor(c.sampleRate * duration));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for(let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lowpass;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = highpass;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
    gain.gain.linearRampToValueAtTime(0, t0 + duration);
    src.connect(hp).connect(lp).connect(gain).connect(c.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  return {
    unlock,
    setMuted(v){ muted = !!v; localStorage.setItem('civitas_audio_muted', v ? '1' : '0'); },
    isMuted(){ return muted; },

    trainWhistle(){
      tone({ type:'sawtooth', freq:880, freqEnd:760, duration:0.55, attack:0.03, release:0.18, volume:0.12 });
      tone({ type:'square',   freq:660, freqEnd:600, duration:0.55, attack:0.04, release:0.20, volume:0.08 });
      tone({ type:'sawtooth', freq:760,             duration:0.7,  attack:0.04, release:0.30, volume:0.10, when:0.42 });
    },
    trainPass(){
      noise({ duration:0.9, volume:0.20, lowpass:380, highpass:60 });
      tone({ type:'sawtooth', freq:90, freqEnd:55, duration:0.9, volume:0.14, attack:0.05, release:0.15 });
    },
    stampedeRumble(){
      noise({ duration:1.6, volume:0.22, lowpass:240, highpass:40 });
      tone({ type:'triangle', freq:55, freqEnd:38, duration:1.6, volume:0.10, attack:0.10, release:0.30 });
    },
    tornadoHowl(){
      noise({ duration:1.0, volume:0.14, lowpass:900, highpass:200 });
      tone({ type:'sine', freq:280, freqEnd:200, duration:1.0, volume:0.06, attack:0.15, release:0.20 });
    },
    chargeRoar(){
      tone({ type:'sawtooth', freq:160, freqEnd:340, duration:0.32, volume:0.14, attack:0.02, release:0.06 });
      noise({ duration:0.32, volume:0.08, lowpass:800, highpass:200 });
    },
    projectileFire(){
      tone({ type:'square', freq:420, freqEnd:280, duration:0.10, volume:0.10, attack:0.005, release:0.04 });
    },
    machineClang(){
      tone({ type:'square', freq:1100, freqEnd:380, duration:0.18, volume:0.13, attack:0.005, release:0.06 });
      noise({ duration:0.10, volume:0.12, lowpass:3200, highpass:800 });
    },
  };
})();

// ── TELEGRAPH BANNER ────────────────────────────────────────────
function ensureTelegraphEl(){
  let el = document.getElementById('deTelegraph');
  if(!el){
    const area = document.getElementById('gameArea');
    if(!area) return null;
    el = document.createElement('div');
    el.id = 'deTelegraph';
    el.className = 'de-telegraph';
    area.appendChild(el);
  }
  return el;
}
function showTelegraph(text, ms){
  const el = ensureTelegraphEl();
  if(!el) return;
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), ms || 1500);
}

// ── DE RUNTIME (per-round) ──────────────────────────────────────
const DE = {
  enemies: [],
  trains: [],
  stampedes: [],
  arms: [],
  cleanup: [],
  active: false,
};
window.__DE = DE;

function deResetForRound(){
  for(const fn of DE.cleanup) try { fn(); } catch(e){}
  DE.enemies.length = 0;
  DE.trains.length = 0;
  DE.stampedes.length = 0;
  DE.arms.length = 0;
  DE.cleanup.length = 0;
  DE.active = true;
  ensureTelegraphEl();
}

function getCam(G){
  return (G && G.cameraX != null) ? G.cameraX : (G && G.distance ? Math.max(0, G.distance - 200) : 0);
}

function deSpawnProjectile(area, G, opts){
  const {
    worldX, y = 24, vx = -3.0, height = 'low', cls = 'bond',
  } = opts;
  if(!area || !G || !Array.isArray(G.cannonballs)) return;
  const el = document.createElement('div');
  el.className = 'cannonball ' + height + ' de-projectile ' + cls;
  area.appendChild(el);
  G.cannonballs.push({
    el, worldX, y, height, vx,
    spawnedAt: Date.now(), lastTrailAt: Date.now(),
  });
  Audio.projectileFire();
}

function deHurtPlayer(refs, reason){
  const G = getG();
  if(!G) return;
  if(Date.now() < (G.invincibleUntil || 0)) return;
  if(typeof window.loseLife === 'function'){
    window.loseLife(refs, reason);
  }
}

// ── MASTER PER-FRAME TICK ───────────────────────────────────────
function deTickAll(refs){
  const G = getG();
  if(!G || !G.running || G.questionInProgress || G.over || G.finished) return;
  if(!DE.active) return;

  const now = Date.now();
  const playerWX = (G.distance || 0) + PLAYER_LEFT;
  const playerCX = playerWX + 24;
  const cam = getCam(G);

  for(const reg of DE.enemies){
    if(!reg.enemy || reg.enemy.dead) continue;
    try { reg.tick(reg.enemy, playerWX, playerCX, now, G, refs); }
    catch(err){ /* swallow per-enemy errors */ }
  }

  for(let i = DE.trains.length - 1; i >= 0; i--){
    const tr = DE.trains[i];
    if(!deTickTrain(tr, playerWX, playerCX, now, G, refs, cam)){
      DE.trains.splice(i, 1);
    }
  }
  for(let i = DE.stampedes.length - 1; i >= 0; i--){
    const st = DE.stampedes[i];
    if(!deTickStampede(st, playerWX, playerCX, now, G, refs, cam)){
      DE.stampedes.splice(i, 1);
    }
  }
  for(const ar of DE.arms){
    deTickArm(ar, playerWX, playerCX, now, G, refs, cam);
  }
}

// ════════════════════════════════════════════════════════════════
// ENEMY AI TICKS
// ════════════════════════════════════════════════════════════════

// Charger — patrols slowly until player gets within sight, then
// accelerates toward them for ~1.8s. Cooldown after each charge.
function tickCharger(e, playerWX, playerCX, now, G, refs){
  e.state = e.state || 'patrol';
  e.nextDecisionAt = e.nextDecisionAt || 0;

  const dist = playerWX - e.worldX;
  const inSight = Math.abs(dist) < 460 && Math.abs(dist) > 30;

  if(e.state === 'patrol'){
    e.worldX += e.vx;
    if(e.worldX <= e.patrolMin){ e.worldX = e.patrolMin; e.vx = Math.abs(e.vx); }
    if(e.worldX >= e.patrolMax){ e.worldX = e.patrolMax; e.vx = -Math.abs(e.vx); }

    if(inSight && now >= e.nextDecisionAt){
      e.state = 'charging';
      e.chargeUntil = now + 1800;
      e.vx = (dist < 0 ? -3.6 : 3.6);
      if(e.el) e.el.classList.add('de-charging');
      Audio.chargeRoar();
    }
  } else if(e.state === 'charging'){
    e.worldX += e.vx;
    const chaseMin = e.patrolMin - 400;
    const chaseMax = e.patrolMax + 400;
    if(e.worldX < chaseMin){ e.worldX = chaseMin; }
    if(e.worldX > chaseMax){ e.worldX = chaseMax; }
    if(now >= e.chargeUntil){
      e.state = 'cooldown';
      e.cooldownUntil = now + 1400;
      e.vx = (e.vx > 0 ? 1.0 : -1.0);
      if(e.el) e.el.classList.remove('de-charging');
    }
  } else if(e.state === 'cooldown'){
    const center = (e.patrolMin + e.patrolMax) / 2;
    const drift = e.worldX < center ? 0.6 : -0.6;
    e.worldX += drift;
    if(now >= e.cooldownUntil){
      e.state = 'patrol';
      e.nextDecisionAt = now + 800;
      const speed = e.basePatrolSpeed || 1.2;
      e.vx = (e.worldX > center ? -speed : speed);
    }
  }
}

// Shooter — paces normally but stops periodically and fires a
// projectile at the player. Uses engine's cannonball pipeline.
function tickShooter(e, playerWX, playerCX, now, G, refs){
  e.nextShotAt = e.nextShotAt || (now + (e.firstShotDelay || 1800));
  e.shotInterval = e.shotInterval || 2600;
  e.state = e.state || 'walk';

  const dist = playerWX - e.worldX;
  const inRange = dist < 0 && Math.abs(dist) < 1100;

  if(e.state === 'walk'){
    e.worldX += e.vx;
    if(e.worldX <= e.patrolMin){ e.worldX = e.patrolMin; e.vx = Math.abs(e.vx); }
    if(e.worldX >= e.patrolMax){ e.worldX = e.patrolMax; e.vx = -Math.abs(e.vx); }

    if(inRange && now >= e.nextShotAt){
      e.state = 'aim';
      e.aimUntil = now + 380;
      e.vx_saved = e.vx;
      e.vx = 0;
    }
  } else if(e.state === 'aim'){
    if(now >= e.aimUntil){
      const refsArea = refs && refs.area;
      if(refsArea){
        deSpawnProjectile(refsArea, G, {
          worldX: e.worldX - 4,
          y: e.shotY != null ? e.shotY : 28,
          vx: e.shotVx != null ? e.shotVx : -3.4,
          height: 'low',
          cls: e.projectileCls || 'bond',
        });
      }
      e.state = 'walk';
      e.vx = e.vx_saved || -1.0;
      e.nextShotAt = now + e.shotInterval + Math.random() * 800;
    }
  }
}

// Big tornado — replaces the wimpy dust-devil. Drifts steadily
// across a wide range with a real ground-level hitbox.
function tickBigTornado(e, playerWX, playerCX, now, G, refs){
  e.nextHowlAt = e.nextHowlAt || (now + 2500);
  e.worldX += e.vx;
  if(e.worldX <= e.patrolMin){ e.worldX = e.patrolMin; e.vx = Math.abs(e.vx); }
  if(e.worldX >= e.patrolMax){ e.worldX = e.patrolMax; e.vx = -Math.abs(e.vx); }

  const cam = getCam(G);
  const onScreen = (e.worldX - cam) > -200 && (e.worldX - cam) < 1400;
  if(onScreen && now >= e.nextHowlAt){
    Audio.tornadoHowl();
    e.nextHowlAt = now + 4500;
  }

  if(Date.now() < (G.invincibleUntil || 0)) return;
  const dx = playerCX - (e.worldX + 60);
  if(Math.abs(dx) < 48 && (G.y || 0) < 130){
    deHurtPlayer(refs, 'swept up by a tornado');
  }
}

// Soot cloud — industrial-themed roaming hazard. Bobs at floating
// height (engine handles e.y for biasbat type). We just enforce a
// wider patrol and a slightly different visual.
function tickSootCloud(e, playerWX, playerCX, now, G, refs){
  e.worldX += e.vx;
  if(e.worldX <= e.patrolMin){ e.worldX = e.patrolMin; e.vx = Math.abs(e.vx); }
  if(e.worldX >= e.patrolMax){ e.worldX = e.patrolMax; e.vx = -Math.abs(e.vx); }
  // The engine's biasbat branch will set e.y based on baseY/amp/phase.
  // We don't override that — collision is handled by the engine's
  // standard biasbat collision, which is fine for our soot cloud.
}

// ════════════════════════════════════════════════════════════════
// SET-PIECE: LOCOMOTIVE TRAIN
// ════════════════════════════════════════════════════════════════

function deTickTrain(tr, playerWX, playerCX, now, G, refs, cam){
  if(!tr.armed && playerWX > tr.triggerX){
    tr.armed = true;
    tr.nextRunAt = now + 200;
  }
  if(!tr.armed) return true;

  if(tr.trackEl){
    tr.trackEl.style.left = (tr.trackStartX - cam) + 'px';
    tr.trackEl.style.width = (tr.trackEndX - tr.trackStartX) + 'px';
  }

  const playerNearTrack = Math.abs(playerWX - (tr.trackStartX + tr.trackEndX) / 2) < 2400;

  if(tr.state === 'idle'){
    if(tr.trackEl) tr.trackEl.style.opacity = '0';
    if(playerNearTrack && now >= tr.nextRunAt){
      tr.state = 'warning';
      tr.warningEndAt = now + 1600;
      if(tr.trackEl) tr.trackEl.style.opacity = '1';
      Audio.trainWhistle();
      showTelegraph('TRAIN INCOMING!', 1500);
    }
  } else if(tr.state === 'warning'){
    if(tr.trackEl) tr.trackEl.style.opacity = '1';
    if(now >= tr.warningEndAt){
      tr.state = 'charging';
      const area = refs && refs.area;
      if(area){
        const loco = document.createElement('div');
        loco.className = 'de-locomotive';
        loco.innerHTML = LOCO_SVG +
          '<div class="smoke s1"></div>' +
          '<div class="smoke s2"></div>' +
          '<div class="smoke s3"></div>';
        area.appendChild(loco);
        tr.locoEl = loco;
        tr.locoX = tr.trackEndX + 50;
        tr.locoVx = -14;
      }
      Audio.trainPass();
    }
  } else if(tr.state === 'charging'){
    tr.locoX += tr.locoVx;
    if(tr.locoEl){
      tr.locoEl.style.left = (tr.locoX - cam) + 'px';
      tr.locoEl.style.bottom = (GROUND_HEIGHT + 30) + 'px';
    }
    if(Date.now() >= (G.invincibleUntil || 0)){
      const trainLeft  = tr.locoX + 6;
      const trainRight = tr.locoX + 224;
      const pCX = playerCX;
      const pY  = G.y || 0;
      const hit = pCX > trainLeft && pCX < trainRight && pY < 110;
      if(hit){
        deHurtPlayer(refs, 'hit by a locomotive');
      }
    }
    if(tr.locoX < tr.trackStartX - 280){
      if(tr.locoEl && tr.locoEl.parentNode) tr.locoEl.remove();
      tr.locoEl = null;
      tr.state = 'idle';
      if(tr.trackEl) tr.trackEl.style.opacity = '0';
      tr.nextRunAt = now + (tr.cycleMs || 9000);
    }
  }
  return true;
}

const LOCO_SVG = `<svg width="230" height="90" viewBox="0 0 230 90" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;">
  <ellipse cx="115" cy="86" rx="100" ry="4" fill="rgba(0,0,0,.35)"/>
  <polygon points="0,76 22,52 22,80" fill="#1a0e08" stroke="#000" stroke-width="1.5"/>
  <polygon points="3,76 22,58 22,76" fill="#7a2820"/>
  <rect x="22" y="32" width="130" height="44" rx="4" fill="#2a1a14" stroke="#000" stroke-width="1.5"/>
  <line x1="42" y1="32" x2="42" y2="76" stroke="#0a0604" stroke-width="2"/>
  <line x1="72" y1="32" x2="72" y2="76" stroke="#0a0604" stroke-width="2"/>
  <line x1="102" y1="32" x2="102" y2="76" stroke="#0a0604" stroke-width="2"/>
  <rect x="36" y="14" width="14" height="22" rx="1" fill="#1a0e08"/>
  <rect x="32" y="10" width="22" height="6" rx="1" fill="#2a1810"/>
  <ellipse cx="80" cy="28" rx="8" ry="6" fill="#c08820" stroke="#5a3a18" stroke-width="1"/>
  <ellipse cx="110" cy="28" rx="10" ry="7" fill="#3a2818" stroke="#000" stroke-width="1"/>
  <circle cx="14" cy="58" r="6" fill="#fce598" stroke="#5a3a18" stroke-width="1.2"/>
  <circle cx="14" cy="58" r="2.5" fill="#fff8d8"/>
  <rect x="152" y="22" width="50" height="54" rx="3" fill="#3a2418" stroke="#000" stroke-width="1.5"/>
  <rect x="160" y="32" width="34" height="20" rx="2" fill="#a87830" stroke="#1a0e08" stroke-width="1"/>
  <line x1="177" y1="32" x2="177" y2="52" stroke="#1a0e08" stroke-width="1"/>
  <rect x="202" y="60" width="22" height="10" fill="#1a0e08"/>
  <circle cx="40" cy="78" r="9" fill="#1a0e08" stroke="#000" stroke-width="1"/>
  <circle cx="40" cy="78" r="4" fill="#5a3a18"/>
  <circle cx="74" cy="78" r="11" fill="#1a0e08" stroke="#000" stroke-width="1"/>
  <circle cx="74" cy="78" r="5" fill="#5a3a18"/>
  <circle cx="108" cy="78" r="11" fill="#1a0e08" stroke="#000" stroke-width="1"/>
  <circle cx="108" cy="78" r="5" fill="#5a3a18"/>
  <circle cx="170" cy="78" r="9" fill="#1a0e08" stroke="#000" stroke-width="1"/>
  <circle cx="170" cy="78" r="4" fill="#5a3a18"/>
  <rect x="38" y="76" width="74" height="3" fill="#5a3a18"/>
</svg>`;

// ════════════════════════════════════════════════════════════════
// SET-PIECE: BUFFALO STAMPEDE
// ════════════════════════════════════════════════════════════════

const BUFFALO_SVG = `<svg width="70" height="54" viewBox="0 0 70 54" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;">
  <ellipse cx="35" cy="51" rx="28" ry="2.5" fill="rgba(0,0,0,.35)"/>
  <path d="M5 30 Q4 18 14 14 Q22 8 30 12 Q44 8 56 18 Q66 22 64 32 L62 44 Q60 48 56 48 L10 48 Q5 48 5 44 Z"
        fill="#3a2414" stroke="#1a0e08" stroke-width="1.5"/>
  <path d="M14 14 Q18 8 24 10 M22 10 Q26 6 30 8 M16 18 Q12 14 8 18"
        stroke="#5a3a20" stroke-width="2" fill="none" opacity=".7"/>
  <path d="M28 14 L24 9 L28 11 Z" fill="#d8c898" stroke="#5a3a18" stroke-width="0.8"/>
  <path d="M44 14 L48 8 L44 12 Z" fill="#d8c898" stroke="#5a3a18" stroke-width="0.8"/>
  <circle cx="20" cy="22" r="1.4" fill="#000"/>
  <rect x="14" y="40" width="6" height="12" fill="#1a0e08"/>
  <rect x="28" y="40" width="6" height="12" fill="#1a0e08"/>
  <rect x="42" y="40" width="6" height="12" fill="#1a0e08"/>
  <rect x="54" y="40" width="6" height="12" fill="#1a0e08"/>
  <ellipse cx="35" cy="38" rx="22" ry="6" fill="#5a3a20" opacity=".4"/>
</svg>`;

function deTickStampede(st, playerWX, playerCX, now, G, refs, cam){
  if(!st.armed && playerWX > st.triggerX){
    st.armed = true;
    st.nextRunAt = now + 400;
  }
  if(!st.armed) return true;

  if(st.rumbleEl){
    st.rumbleEl.style.left = (st.rumbleStartX - cam) + 'px';
    st.rumbleEl.style.width = (st.rumbleEndX - st.rumbleStartX) + 'px';
  }

  const playerNear = Math.abs(playerWX - (st.rumbleStartX + st.rumbleEndX) / 2) < 2600;

  if(st.state === 'idle'){
    if(st.rumbleEl) st.rumbleEl.style.opacity = '0';
    if(playerNear && now >= st.nextRunAt){
      st.state = 'warning';
      st.warningEndAt = now + 1400;
      if(st.rumbleEl) st.rumbleEl.style.opacity = '1';
      Audio.stampedeRumble();
      showTelegraph('STAMPEDE!', 1300);
    }
  } else if(st.state === 'warning'){
    if(st.rumbleEl) st.rumbleEl.style.opacity = '1';
    if(now >= st.warningEndAt){
      st.state = 'charging';
      const area = refs && refs.area;
      st.buffalo = [];
      const count = st.count || 4;
      for(let i = 0; i < count; i++){
        const el = document.createElement('div');
        el.className = 'de-buffalo';
        el.innerHTML = BUFFALO_SVG + '<div class="dust"></div>';
        if(area) area.appendChild(el);
        st.buffalo.push({
          el,
          worldX: st.rumbleEndX + i * 84 + Math.random() * 18,
          vx: -10 - Math.random() * 1.5,
        });
      }
    }
  } else if(st.state === 'charging'){
    let allOff = true;
    for(const b of st.buffalo){
      b.worldX += b.vx;
      if(b.el){
        b.el.style.left = (b.worldX - cam) + 'px';
        b.el.style.bottom = (GROUND_HEIGHT - 4) + 'px';
      }
      if(b.worldX > st.rumbleStartX - 120) allOff = false;
      if(Date.now() >= (G.invincibleUntil || 0)){
        const left = b.worldX + 6, right = b.worldX + 64;
        if(playerCX > left && playerCX < right && (G.y || 0) < 48){
          deHurtPlayer(refs, 'trampled in a stampede');
          break;
        }
      }
    }
    if(allOff){
      for(const b of st.buffalo) if(b.el && b.el.parentNode) b.el.remove();
      st.buffalo = [];
      st.state = 'idle';
      if(st.rumbleEl) st.rumbleEl.style.opacity = '0';
      st.nextRunAt = now + (st.cycleMs || 12000);
    }
  }
  return true;
}

// ════════════════════════════════════════════════════════════════
// SET-PIECE: SWINGING MACHINE ARM
// ════════════════════════════════════════════════════════════════

function deTickArm(ar, playerWX, playerCX, now, G, refs, cam){
  ar.phase = ((ar.phase || 0) + (ar.speed || 0.018));
  const angleRad = Math.sin(ar.phase) * (ar.swingAmp || 1.0);
  const angleDeg = angleRad * (180 / Math.PI);

  const armLength = ar.armLength || 130;
  const headWorldX = ar.pivotX + Math.sin(angleRad) * armLength;
  const headWorldY = ar.pivotY - Math.cos(angleRad) * armLength;

  if(ar.armEl){
    ar.armEl.style.left = (ar.pivotX - cam - 25) + 'px';
    ar.armEl.style.bottom = (GROUND_HEIGHT + ar.pivotY - 4) + 'px';
    ar.armEl.style.width = '50px';
    ar.armEl.style.height = (armLength + 50) + 'px';
    ar.armEl.style.transform = 'rotate(' + angleDeg.toFixed(1) + 'deg)';
    if(!ar._shaftSized && ar.shaftEl){
      ar.shaftEl.style.height = armLength + 'px';
      ar.shaftEl.style.top = '0';
      ar._shaftSized = true;
    }
  }

  if(Math.abs(angleRad) > (ar.swingAmp || 1.0) * 0.92 && now - (ar.lastClangAt || 0) > 600){
    ar.lastClangAt = now;
    Audio.machineClang();
  }

  if(Date.now() >= (G.invincibleUntil || 0)){
    const headLeft = headWorldX - 22, headRight = headWorldX + 22;
    const headBottom = headWorldY - 24, headTop = headWorldY + 24;
    const pBottom = (G.y || 0) + 4;
    const pTop = (G.y || 0) + (G.ducking ? 32 : 56);
    const pLeft = playerCX - 18, pRight = playerCX + 18;
    if(pRight > headLeft && pLeft < headRight && pTop > headBottom && pBottom < headTop){
      deHurtPlayer(refs, 'hit by a factory arm');
    }
  }
}

// ════════════════════════════════════════════════════════════════
// FACTORY METHODS — for round builders to use
// ════════════════════════════════════════════════════════════════

function withCharger(enemy, opts){
  if(!enemy) return enemy;
  const { patrolMin, patrolMax, baseSpeed = 1.2 } = opts || {};
  if(patrolMin != null) enemy.patrolMin = patrolMin;
  if(patrolMax != null) enemy.patrolMax = patrolMax;
  enemy.basePatrolSpeed = baseSpeed;
  enemy.vx = (enemy.vx > 0 ? baseSpeed : -baseSpeed);
  DE.enemies.push({ enemy, tick: tickCharger });
  return enemy;
}
function withShooter(enemy, opts){
  if(!enemy) return enemy;
  const {
    patrolMin, patrolMax, shotInterval = 2400, shotY = 28, shotVx = -3.4,
    projectileCls = 'bond', firstShotDelay = 1800,
  } = opts || {};
  if(patrolMin != null) enemy.patrolMin = patrolMin;
  if(patrolMax != null) enemy.patrolMax = patrolMax;
  enemy.shotInterval = shotInterval;
  enemy.shotY = shotY;
  enemy.shotVx = shotVx;
  enemy.projectileCls = projectileCls;
  enemy.firstShotDelay = firstShotDelay;
  DE.enemies.push({ enemy, tick: tickShooter });
  return enemy;
}
function withBigTornado(enemy, opts){
  if(!enemy) return enemy;
  const { patrolMin, patrolMax } = opts || {};
  if(patrolMin != null) enemy.patrolMin = patrolMin;
  if(patrolMax != null) enemy.patrolMax = patrolMax;
  if(enemy.el){
    enemy.el.classList.add('de-big-tornado');
    enemy.el.classList.remove('dust-devil');
    enemy.el.innerHTML = '<div class="funnel b"></div><div class="funnel"></div><div class="ring"></div>';
  }
  DE.enemies.push({ enemy, tick: tickBigTornado });
  return enemy;
}
function withSootCloud(enemy, opts){
  if(!enemy) return enemy;
  const { patrolMin, patrolMax } = opts || {};
  if(patrolMin != null) enemy.patrolMin = patrolMin;
  if(patrolMax != null) enemy.patrolMax = patrolMax;
  if(enemy.el){
    enemy.el.classList.add('de-soot-cloud');
    enemy.el.innerHTML = '<div class="body"></div><div class="ember e1"></div><div class="ember e2"></div><div class="ember e3"></div>';
  }
  DE.enemies.push({ enemy, tick: tickSootCloud });
  return enemy;
}

function makeTrain(refs, opts){
  const {
    trackStartX, trackEndX, triggerX = trackStartX - 1200, cycleMs = 9000,
  } = opts || {};
  const area = refs && refs.area;
  if(!area) return null;
  const trackEl = document.createElement('div');
  trackEl.className = 'de-track-warning';
  trackEl.style.opacity = '0';
  area.appendChild(trackEl);
  const tr = {
    trackStartX, trackEndX, triggerX, cycleMs,
    armed: false, state: 'idle',
    nextRunAt: 0,
    trackEl, locoEl: null,
  };
  DE.trains.push(tr);
  DE.cleanup.push(() => {
    if(trackEl.parentNode) trackEl.remove();
    if(tr.locoEl && tr.locoEl.parentNode) tr.locoEl.remove();
  });
  return tr;
}

function makeStampede(refs, opts){
  const {
    rumbleStartX, rumbleEndX, triggerX = rumbleStartX - 1100,
    cycleMs = 12000, count = 4,
  } = opts || {};
  const area = refs && refs.area;
  if(!area) return null;
  const rumbleEl = document.createElement('div');
  rumbleEl.className = 'de-rumble-warning';
  rumbleEl.style.opacity = '0';
  area.appendChild(rumbleEl);
  const st = {
    rumbleStartX, rumbleEndX, triggerX, cycleMs, count,
    armed: false, state: 'idle',
    nextRunAt: 0,
    rumbleEl, buffalo: [],
  };
  DE.stampedes.push(st);
  DE.cleanup.push(() => {
    if(rumbleEl.parentNode) rumbleEl.remove();
    for(const b of st.buffalo) if(b.el && b.el.parentNode) b.el.remove();
  });
  return st;
}

function makeMachineArm(refs, opts){
  const {
    pivotX, pivotY = 200, armLength = 130, swingAmp = 1.05, speed = 0.022,
    phase = 0,
  } = opts || {};
  const area = refs && refs.area;
  if(!area) return null;
  const armEl = document.createElement('div');
  armEl.className = 'de-machine-arm';
  const shaftEl = document.createElement('div'); shaftEl.className = 'shaft';
  const headEl = document.createElement('div'); headEl.className = 'head';
  armEl.appendChild(shaftEl);
  armEl.appendChild(headEl);
  area.appendChild(armEl);
  const ar = {
    pivotX, pivotY, armLength, swingAmp, speed, phase,
    armEl, shaftEl, headEl,
  };
  DE.arms.push(ar);
  DE.cleanup.push(() => { if(armEl.parentNode) armEl.remove(); });
  return ar;
}

window.__DE_FACT = {
  withCharger, withShooter, withBigTornado, withSootCloud,
  makeTrain, makeStampede, makeMachineArm,
  Audio, showTelegraph, deResetForRound,
};

})();
