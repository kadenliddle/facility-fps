import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { createGuards } from './enemies.js';

const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const deathEl = document.getElementById('death');
const hud = document.getElementById('hud');
const toast = document.getElementById('toast');
const promptEl = document.getElementById('prompt');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  CONFIG.fov,
  window.innerWidth / window.innerHeight,
  CONFIG.near,
  CONFIG.far
);

const world = createWorld(scene);
const player = new Player(camera, world.colliders);
let enemies = createGuards(world.guardSpawns, world.colliders, scene);
const tracers = [];
const tracerGroup = new THREE.Group();
scene.add(tracerGroup);

let running = false;
let locked = false;
let objectiveDone = false;
let clearedToastShown = false;
let toastTimer = 0;
let last = performance.now();

player.reset(world.spawn);

function showToast(msg, seconds = 3) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toastTimer = seconds;
}

function updateHud() {
  const hpFill = document.getElementById('hp-fill');
  const hpNum = document.getElementById('hp-num');
  const mag = document.getElementById('mag');
  const reserve = document.getElementById('reserve');
  const weaponName = document.getElementById('weapon-name');
  const pct = Math.max(0, player.hp / CONFIG.maxHp);
  hpFill.style.width = `${pct * 100}%`;
  hpNum.textContent = String(Math.ceil(player.hp));
  mag.textContent = String(player.weapons.w.mag);
  reserve.textContent = player.weapons.reloading ? '…' : String(player.weapons.w.reserve);
  weaponName.textContent = player.weapons.reloading
    ? `${player.weapons.w.name} REL`
    : player.weapons.w.name;

  // Exit prompt
  if (!objectiveDone && player.alive && world.exitZone.containsPoint(
    new THREE.Vector3(player.position.x, 1, player.position.z)
  )) {
    const alive = enemies.some((e) => e.alive);
    if (alive) {
      promptEl.textContent = 'CLEAR GUARDS TO SECURE EXIT';
      promptEl.classList.remove('hidden');
    } else {
      promptEl.classList.add('hidden');
    }
  } else {
    promptEl.classList.add('hidden');
  }
}

function checkObjective() {
  if (objectiveDone || !player.alive) return;
  const anyAlive = enemies.some((e) => e.alive);
  const atExit = world.exitZone.containsPoint(
    new THREE.Vector3(player.position.x, 1, player.position.z)
  );
  if (!anyAlive && atExit) {
    objectiveDone = true;
    showToast('OBJECTIVE COMPLETE — SECTOR K SECURE', 5);
    world.door.material.emissiveIntensity = 0.7;
  } else if (!anyAlive && !objectiveDone && !clearedToastShown) {
    clearedToastShown = true;
    showToast('GUARDS DOWN — REACH EXIT HATCH', 2.5);
  }
}

function clearTracers() {
  while (tracerGroup.children.length) {
    const m = tracerGroup.children[0];
    tracerGroup.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  }
}

function drawTracers(dt) {
  clearTracers();
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      tracers.splice(i, 1);
      continue;
    }
    const geo = new THREE.BufferGeometry().setFromPoints([t.start, t.end]);
    const mat = new THREE.LineBasicMaterial({
      color: t.enemy ? 0xc87868 : 0xc8e8e0,
      transparent: true,
      opacity: Math.min(1, t.life * 12),
    });
    tracerGroup.add(new THREE.Line(geo, mat));
  }
}

function resetGame() {
  // remove enemy meshes
  for (const e of enemies) {
    scene.remove(e.mesh);
  }
  enemies = createGuards(world.guardSpawns, world.colliders, scene);
  player.reset(world.spawn);
  objectiveDone = false;
  clearedToastShown = false;
  tracers.length = 0;
  clearTracers();
  world.door.material.emissiveIntensity = 0.25;
  deathEl.classList.add('hidden');
  toast.classList.add('hidden');
  updateHud();
}

function startGame() {
  overlay.classList.add('hidden');
  hud.classList.remove('hidden');
  resetGame();
  running = true;
  canvas.requestPointerLock();
}

function onDeath() {
  running = false;
  document.exitPointerLock();
  deathEl.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
  deathEl.classList.add('hidden');
  startGame();
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && running && player.alive) {
    // paused visually via overlay? keep running but no look — show hint via toast briefly
  }
});

document.addEventListener('mousemove', (e) => {
  if (!locked || !running || !player.alive) return;
  player.onMouseMove(e.movementX, e.movementY);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') return;
  if (!running) return;
  player.onKey(e.code, true);
  // Re-lock if unlocked and player clicks keys? skip
  if (['Space', 'KeyR'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  player.onKey(e.code, false);
});

canvas.addEventListener('mousedown', (e) => {
  if (!running) return;
  if (!locked) {
    canvas.requestPointerLock();
    return;
  }
  player.onMouseDown(e.button);
});
window.addEventListener('mouseup', (e) => player.onMouseUp(e.button));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (running && player.alive) {
    player.update(dt, enemies, tracers);
    for (const e of enemies) e.update(dt, player, tracers);
    checkObjective();
    if (!player.alive) onDeath();
  }

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) toast.classList.add('hidden');
  }

  drawTracers(dt);
  updateHud();

  // Damage vignette via renderer clear? skip — optional red overlay
  if (player.damageFlash > 0) {
    document.body.style.boxShadow = `inset 0 0 ${80 * player.damageFlash}px rgba(180,40,30,${0.55 * player.damageFlash})`;
  } else {
    document.body.style.boxShadow = '';
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
updateHud();
