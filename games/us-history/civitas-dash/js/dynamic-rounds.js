/* ════════════════════════════════════════════════════════════════
 * DYNAMIC ROUNDS — Override ROUND_BUILDERS for Unit 2 and Unit 3.
 *
 * Strategy: each new builder calls the existing builder (which sets
 * up platforms, pits, deco, base enemies, coins) and THEN:
 *   1. Resets DE runtime for this round.
 *   2. Upgrades selected enemies in G.enemies with new AI behaviors
 *      (charger, shooter, big tornado, soot cloud).
 *   3. Adds set-pieces (locomotive trains, buffalo stampedes,
 *      machine arms) at chosen world coordinates.
 *   4. Widens patrol ranges so enemies actually pursue.
 *
 * Loaded AFTER dynamic-enemies.js. Both files are pure additive.
 * ════════════════════════════════════════════════════════════════ */

(function(){
'use strict';

if(typeof ROUND_BUILDERS === 'undefined'){
  console.warn('[dynamic-rounds] ROUND_BUILDERS not found — engine.js may not have loaded.');
  return;
}

const FACT = window.__DE_FACT;
if(!FACT){
  console.warn('[dynamic-rounds] dynamic-enemies factories not found.');
  return;
}
const { withCharger, withShooter, withBigTornado, withSootCloud,
        makeTrain, makeStampede, makeMachineArm, deResetForRound } = FACT;

const FIRST_X = 820;       // matches buildWestRound's FIRST_X
const FIRST_X_GILD = 850;  // matches gilded prototype FIRST_X
const SPACING = 1540;      // matches the *_enemySpacing builders

// Snapshot the prior builders so we can call through to them.
const PRIOR = {};
['2-1','2-2','2-3','2-4','3-1','3-2','3-3','3-4'].forEach(id => {
  if(ROUND_BUILDERS[id]) PRIOR[id] = ROUND_BUILDERS[id];
});

// Helper: classify enemies in G.enemies by their type and visual class
// so we can selectively upgrade them. The base builders use:
//   prairie wolf  → .enemy.prairie-wolf
//   rail baron    → .enemy.rail-baron
//   debt beetle   → .enemy.debt-beetle
//   dust devil    → .enemy.dust-devil
//   trust goblin  → .enemy.trust-goblin
//   pinkerton     → .enemy.pinkerton
//   smoke cloud   → .enemy.smoke-cloud
function findEnemiesByCls(G, cls){
  if(!G || !Array.isArray(G.enemies)) return [];
  return G.enemies.filter(e => e && e.el && e.el.classList && e.el.classList.contains(cls));
}

// Wider patrol — given an enemy's current position, expand its patrol
// range outward by `expand` px on each side (clamped to safe ground).
function expandPatrol(e, expand){
  e.patrolMin = Math.max(0, e.patrolMin - expand);
  e.patrolMax = e.patrolMax + expand;
}

// ════════════════════════════════════════════════════════════════
// UNIT 2 — WESTWARD EXPANSION
// ════════════════════════════════════════════════════════════════

// 2-1: Trails Across the Plains
// Set-pieces: 1 buffalo stampede zone in the middle stretch.
// AI upgrades: prairie wolves → chargers; dust devils → big tornadoes.
function buildRound2_1_dynamic(refs){
  if(PRIOR['2-1']) PRIOR['2-1'](refs);
  deResetForRound();
  const G = window.G;
  if(!G) return;

  // Upgrade all wolves to chargers — they now pursue when player is near.
  findEnemiesByCls(G, 'prairie-wolf').forEach((e, i) => {
    expandPatrol(e, 380);
    withCharger(e, { baseSpeed: 1.15 });
  });
  // Upgrade dust devils to big tornadoes — wider patrol, real hitbox.
  findEnemiesByCls(G, 'dust-devil').forEach((e) => {
    expandPatrol(e, 280);
    e.baseY = 0; e.amp = 0; // pin to ground; tornado is grounded
    withBigTornado(e);
  });

  // Add a buffalo stampede in the middle of the level.
  // Triggered when player passes ~5500 (roughly halfway through).
  makeStampede(refs, {
    rumbleStartX: 5300,
    rumbleEndX: 7800,
    triggerX: 4400,
    cycleMs: 11000,
    count: 4,
  });

  // One bonus tornado set-piece near the end (between sources 6-7).
  // The original builder may not have placed an enemy here; add one.
  // (Keep it sparse — we don't want to overwhelm 2-1, the introductory round.)
}

// 2-2: Plains Under Pressure
// Set-pieces: locomotive train through one stretch + a buffalo zone.
// AI upgrades: rail barons → shooters firing debt-bond projectiles.
function buildRound2_2_dynamic(refs){
  if(PRIOR['2-2']) PRIOR['2-2'](refs);
  deResetForRound();
  const G = window.G;
  if(!G) return;

  findEnemiesByCls(G, 'prairie-wolf').forEach(e => {
    expandPatrol(e, 360);
    withCharger(e, { baseSpeed: 1.2 });
  });
  findEnemiesByCls(G, 'dust-devil').forEach(e => {
    expandPatrol(e, 260);
    e.baseY = 0; e.amp = 0;
    withBigTornado(e);
  });
  // Rail baron(s) become shooters
  findEnemiesByCls(G, 'rail-baron').forEach(e => {
    expandPatrol(e, 320);
    withShooter(e, { shotInterval: 2300, shotY: 28, shotVx: -3.4, projectileCls: 'bond' });
  });

  // Locomotive across the back-half of the level (post halfway).
  // Trigger at ~4800, track from 4900 to 9200 (covers ~3 sections).
  makeTrain(refs, {
    trackStartX: 4900,
    trackEndX: 9200,
    triggerX: 4500,
    cycleMs: 9500,
  });

  // A small buffalo wave earlier in the level.
  makeStampede(refs, {
    rumbleStartX: 1900,
    rumbleEndX: 3800,
    triggerX: 1100,
    cycleMs: 13000,
    count: 3,
  });
}

// 2-3: Farmers and Populists (hardest pre-boss West round)
// Set-pieces: long buffalo stampede + ONE shorter train + a tornado corridor.
// AI: debt beetles → faster chargers; rail barons → shooters; dust → big tornado.
function buildRound2_3_dynamic(refs){
  if(PRIOR['2-3']) PRIOR['2-3'](refs);
  deResetForRound();
  const G = window.G;
  if(!G) return;

  findEnemiesByCls(G, 'debt-beetle').forEach(e => {
    expandPatrol(e, 420);
    withCharger(e, { baseSpeed: 1.6 });
  });
  findEnemiesByCls(G, 'rail-baron').forEach(e => {
    expandPatrol(e, 360);
    withShooter(e, { shotInterval: 2100, shotY: 28, shotVx: -3.6, projectileCls: 'bond' });
  });
  findEnemiesByCls(G, 'dust-devil').forEach(e => {
    expandPatrol(e, 320);
    e.baseY = 0; e.amp = 0;
    withBigTornado(e);
  });
  findEnemiesByCls(G, 'prairie-wolf').forEach(e => {
    expandPatrol(e, 320);
    withCharger(e, { baseSpeed: 1.3 });
  });

  // Long stampede zone covering the open prairie middle.
  makeStampede(refs, {
    rumbleStartX: 3200,
    rumbleEndX: 6800,
    triggerX: 2400,
    cycleMs: 10500,
    count: 5,
  });

  // Train across the late-level rail-trestle stretch.
  makeTrain(refs, {
    trackStartX: 7200,
    trackEndX: 10600,
    triggerX: 6800,
    cycleMs: 8500,
  });
}

// 2-4: The Cross of Gold (boss arena keeps its boss; enrich the run-up)
// AI upgrades on enemies before the boss arena. No new trains/stampedes
// in the boss arena itself (would interfere with boss positioning).
function buildRound2_4_dynamic(refs){
  if(PRIOR['2-4']) PRIOR['2-4'](refs);
  deResetForRound();
  const G = window.G;
  if(!G) return;

  // Boss arena starts around ~10880 (BOSS_X) - 690 = ~10190.
  // We only upgrade enemies whose worldX is well before that.
  const BOSS_GATE = 10000;

  findEnemiesByCls(G, 'debt-beetle').forEach(e => {
    if(e.worldX > BOSS_GATE) return;
    expandPatrol(e, 380);
    withCharger(e, { baseSpeed: 1.5 });
  });
  findEnemiesByCls(G, 'rail-baron').forEach(e => {
    if(e.worldX > BOSS_GATE) return;
    expandPatrol(e, 320);
    withShooter(e, { shotInterval: 2200, shotY: 28, shotVx: -3.5, projectileCls: 'bond' });
  });
  findEnemiesByCls(G, 'dust-devil').forEach(e => {
    if(e.worldX > BOSS_GATE) return;
    expandPatrol(e, 280);
    e.baseY = 0; e.amp = 0;
    withBigTornado(e);
  });

  // One stampede in the early-mid gauntlet leading to the boss
  makeStampede(refs, {
    rumbleStartX: 2800,
    rumbleEndX: 5600,
    triggerX: 2000,
    cycleMs: 11500,
    count: 4,
  });

  // One train mid-level
  makeTrain(refs, {
    trackStartX: 5800,
    trackEndX: 9600,
    triggerX: 5400,
    cycleMs: 9000,
  });
}

// ════════════════════════════════════════════════════════════════
// UNIT 3 — INDUSTRIAL REVOLUTION
// ════════════════════════════════════════════════════════════════

// 3-1: Boomtown Frontier
// Set-pieces: 2 swinging machine arms.
// AI upgrades: trust goblins → slow chargers; pinkertons → fast chargers;
//              smoke clouds → soot clouds.
function buildRound3_1_dynamic(refs){
  if(PRIOR['3-1']) PRIOR['3-1'](refs);
  deResetForRound();
  const G = window.G;
  if(!G) return;

  findEnemiesByCls(G, 'trust-goblin').forEach(e => {
    expandPatrol(e, 360);
    withCharger(e, { baseSpeed: 1.05 });
  });
  findEnemiesByCls(G, 'pinkerton-guard').forEach(e => {
    expandPatrol(e, 320);
    withCharger(e, { baseSpeed: 1.7 });
  });
  findEnemiesByCls(G, 'smoke-cloud').forEach(e => {
    expandPatrol(e, 240);
    withSootCloud(e);
  });

  // Two machine arms — one mid-level, one near the end.
  // SPACING in gilded prototype is 1280, FIRST_X = 850, so:
  //   Source 4 ≈ 850 + 3*1280 = 4690
  //   Source 6 ≈ 850 + 5*1280 = 7250
  makeMachineArm(refs, {
    pivotX: 4900, pivotY: 240, armLength: 140, swingAmp: 1.0, speed: 0.022,
  });
  makeMachineArm(refs, {
    pivotX: 7500, pivotY: 220, armLength: 130, swingAmp: 1.05, speed: 0.025, phase: Math.PI/2,
  });
}

// 3-2: Labor Unrest
// Set-pieces: 1 factory train + 2 machine arms.
function buildRound3_2_dynamic(refs){
  if(PRIOR['3-2']) PRIOR['3-2'](refs);
  deResetForRound();
  const G = window.G;
  if(!G) return;

  findEnemiesByCls(G, 'trust-goblin').forEach(e => {
    expandPatrol(e, 360);
    withCharger(e, { baseSpeed: 1.1 });
  });
  findEnemiesByCls(G, 'pinkerton-guard').forEach(e => {
    expandPatrol(e, 360);
    withCharger(e, { baseSpeed: 1.85 });
  });
  findEnemiesByCls(G, 'smoke-cloud').forEach(e => {
    expandPatrol(e, 280);
    withSootCloud(e);
  });

  // Factory train (themed, but uses the same locomotive sprite — the
  // sound and danger are what matter).
  makeTrain(refs, {
    trackStartX: 5400,
    trackEndX: 9000,
    triggerX: 4800,
    cycleMs: 9500,
  });

  makeMachineArm(refs, {
    pivotX: 3500, pivotY: 230, armLength: 135, swingAmp: 1.05, speed: 0.024,
  });
  makeMachineArm(refs, {
    pivotX: 8200, pivotY: 220, armLength: 130, swingAmp: 1.0, speed: 0.026, phase: Math.PI,
  });
}

// 3-3: City Life
function buildRound3_3_dynamic(refs){
  if(PRIOR['3-3']) PRIOR['3-3'](refs);
  deResetForRound();
  const G = window.G;
  if(!G) return;

  findEnemiesByCls(G, 'trust-goblin').forEach(e => {
    expandPatrol(e, 380);
    withCharger(e, { baseSpeed: 1.15 });
  });
  findEnemiesByCls(G, 'pinkerton-guard').forEach(e => {
    expandPatrol(e, 360);
    withCharger(e, { baseSpeed: 1.95 });
  });
  findEnemiesByCls(G, 'smoke-cloud').forEach(e => {
    expandPatrol(e, 280);
    withSootCloud(e);
  });

  // Three arms across the level + one short train run
  makeMachineArm(refs, {
    pivotX: 2600, pivotY: 220, armLength: 130, swingAmp: 1.05, speed: 0.024,
  });
  makeMachineArm(refs, {
    pivotX: 5400, pivotY: 230, armLength: 138, swingAmp: 1.05, speed: 0.026, phase: Math.PI/3,
  });
  makeMachineArm(refs, {
    pivotX: 8400, pivotY: 220, armLength: 130, swingAmp: 1.0, speed: 0.025, phase: Math.PI/2,
  });
  makeTrain(refs, {
    trackStartX: 6400,
    trackEndX: 9000,
    triggerX: 6000,
    cycleMs: 10500,
  });
}

// 3-4: Iron Gold (boss)
function buildRound3_4_dynamic(refs){
  if(PRIOR['3-4']) PRIOR['3-4'](refs);
  deResetForRound();
  const G = window.G;
  if(!G) return;

  const BOSS_GATE = 10000;

  findEnemiesByCls(G, 'trust-goblin').forEach(e => {
    if(e.worldX > BOSS_GATE) return;
    expandPatrol(e, 360);
    withCharger(e, { baseSpeed: 1.2 });
  });
  findEnemiesByCls(G, 'pinkerton-guard').forEach(e => {
    if(e.worldX > BOSS_GATE) return;
    expandPatrol(e, 360);
    withCharger(e, { baseSpeed: 2.0 });
  });
  findEnemiesByCls(G, 'smoke-cloud').forEach(e => {
    if(e.worldX > BOSS_GATE) return;
    expandPatrol(e, 280);
    withSootCloud(e);
  });

  // Two arms before the boss arena
  makeMachineArm(refs, {
    pivotX: 3200, pivotY: 230, armLength: 135, swingAmp: 1.0, speed: 0.024,
  });
  makeMachineArm(refs, {
    pivotX: 6600, pivotY: 220, armLength: 130, swingAmp: 1.05, speed: 0.026,
  });
  // One train run in the middle
  makeTrain(refs, {
    trackStartX: 4600,
    trackEndX: 8400,
    triggerX: 4200,
    cycleMs: 9500,
  });
}

// ── Install all overrides ───────────────────────────────────────
ROUND_BUILDERS['2-1'] = buildRound2_1_dynamic;
ROUND_BUILDERS['2-2'] = buildRound2_2_dynamic;
ROUND_BUILDERS['2-3'] = buildRound2_3_dynamic;
ROUND_BUILDERS['2-4'] = buildRound2_4_dynamic;
ROUND_BUILDERS['3-1'] = buildRound3_1_dynamic;
ROUND_BUILDERS['3-2'] = buildRound3_2_dynamic;
ROUND_BUILDERS['3-3'] = buildRound3_3_dynamic;
ROUND_BUILDERS['3-4'] = buildRound3_4_dynamic;

console.log('[dynamic-rounds] Unit 2 + Unit 3 round builders installed.');

})();
