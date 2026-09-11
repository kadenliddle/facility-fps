import * as THREE from 'three';
import { WEAPONS } from './config.js';

export class WeaponController {
  constructor() {
    this.defs = {
      pistol: { ...WEAPONS.pistol, mag: WEAPONS.pistol.magSize, reserve: WEAPONS.pistol.reserve },
      smg: { ...WEAPONS.smg, mag: WEAPONS.smg.magSize, reserve: WEAPONS.smg.reserve },
    };
    this.current = 'pistol';
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.muzzleFlash = 0;
  }

  get w() {
    return this.defs[this.current];
  }

  switchTo(id) {
    if (!this.defs[id] || id === this.current) return;
    this.current = id;
    this.reloading = false;
    this.reloadTimer = 0;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = this.w.magSize - this.w.mag;
        const take = Math.min(need, this.w.reserve);
        this.w.mag += take;
        this.w.reserve -= take;
        this.reloading = false;
      }
    }
  }

  tryReload() {
    if (this.reloading) return false;
    if (this.w.mag >= this.w.magSize) return false;
    if (this.w.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTimer = this.w.reloadTime;
    return true;
  }

  /** Returns shot info or null. */
  tryFire(holding) {
    if (this.reloading) return null;
    if (this.cooldown > 0) return null;
    if (this.w.mag <= 0) {
      this.tryReload();
      return null;
    }
    // Pistol: semi — only on fresh press; SMG: auto while holding
    if (this.current === 'pistol' && holding !== 'press') return null;
    if (this.current === 'smg' && !holding) return null;

    this.w.mag -= 1;
    this.cooldown = 1 / this.w.fireRate;
    this.muzzleFlash = 0.06;
    return {
      damage: this.w.damage,
      spread: this.w.spread,
      range: this.w.range,
    };
  }

  reset() {
    this.defs.pistol.mag = WEAPONS.pistol.magSize;
    this.defs.pistol.reserve = WEAPONS.pistol.reserve;
    this.defs.smg.mag = WEAPONS.smg.magSize;
    this.defs.smg.reserve = WEAPONS.smg.reserve;
    this.current = 'pistol';
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.muzzleFlash = 0;
  }
}

export function createViewmodel(camera) {
  const group = new THREE.Group();
  group.name = 'viewmodel';

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.14, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x3a444a })
  );
  body.position.set(0.22, -0.22, -0.45);
  group.add(body);

  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.28),
    new THREE.MeshLambertMaterial({ color: 0x2a3034 })
  );
  barrel.position.set(0.22, -0.18, -0.72);
  group.add(barrel);

  const flash = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xffeeaa })
  );
  flash.position.set(0.22, -0.18, -0.88);
  flash.visible = false;
  flash.name = 'muzzle';
  group.add(flash);

  camera.add(group);
  return { group, flash, body, barrel };
}

export function setViewmodelWeapon(vm, weaponId) {
  if (weaponId === 'smg') {
    vm.body.scale.set(1.15, 1.1, 1.35);
    vm.barrel.scale.set(1.1, 1.1, 1.5);
    vm.barrel.position.set(0.22, -0.18, -0.82);
  } else {
    vm.body.scale.set(1, 1, 1);
    vm.barrel.scale.set(1, 1, 1);
    vm.barrel.position.set(0.22, -0.18, -0.72);
  }
}

export function hitscan(origin, direction, range, enemies, colliders) {
  const ray = new THREE.Raycaster(origin, direction.clone().normalize(), 0, range);
  // Enemy hitboxes as simple Object3D meshes
  const enemyMeshes = enemies.filter((e) => e.alive).map((e) => e.mesh);
  const hits = ray.intersectObjects(enemyMeshes, true);
  let enemyHit = null;
  let enemyDist = Infinity;
  if (hits.length) {
    // Find owning enemy
    for (const h of hits) {
      let obj = h.object;
      while (obj && !obj.userData.enemyId && obj.parent) obj = obj.parent;
      if (obj && obj.userData.enemyId != null) {
        enemyHit = enemies.find((e) => e.id === obj.userData.enemyId);
        enemyDist = h.distance;
        break;
      }
    }
  }

  // Wall block: check ray vs AABB
  let wallDist = Infinity;
  const dir = direction.clone().normalize();
  for (const box of colliders) {
    const t = rayHitBox(origin, dir, box);
    if (t != null && t > 0 && t < wallDist) wallDist = t;
  }

  if (enemyHit && enemyDist < wallDist && enemyDist <= range) {
    return { type: 'enemy', enemy: enemyHit, distance: enemyDist, point: origin.clone().addScaledVector(dir, enemyDist) };
  }
  if (wallDist < range) {
    return { type: 'wall', distance: wallDist, point: origin.clone().addScaledVector(dir, wallDist) };
  }
  return null;
}

function rayHitBox(origin, dir, box) {
  // Slab method
  let tmin = 0;
  let tmax = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    const o = origin[axis];
    const d = dir[axis];
    const min = box.min[axis];
    const max = box.max[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
}
