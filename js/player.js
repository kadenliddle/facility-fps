import * as THREE from 'three';
import { CONFIG } from './config.js';
import { resolveCollision } from './world.js';
import {
  WeaponController,
  createViewmodel,
  setViewmodelWeapon,
  hitscan,
} from './weapons.js';

export class Player {
  constructor(camera, colliders) {
    this.camera = camera;
    this.colliders = colliders;
    this.yaw = Math.PI; // face +Z into Sector K
    this.pitch = 0;
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocityY = 0;
    this.onGround = true;
    this.hp = CONFIG.maxHp;
    this.alive = true;
    this.keys = new Set();
    this.mouseDown = false;
    this.firePress = false;
    this.weapons = new WeaponController();
    this.vm = createViewmodel(camera);
    setViewmodelWeapon(this.vm, 'pistol');
    this.bob = 0;
    this.damageFlash = 0;
  }

  reset(spawn) {
    this.position.copy(spawn);
    this.yaw = Math.PI; // face +Z into Sector K
    this.pitch = 0;
    this.velocityY = 0;
    this.hp = CONFIG.maxHp;
    this.alive = true;
    this.weapons.reset();
    setViewmodelWeapon(this.vm, 'pistol');
    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.set(
      this.position.x,
      this.position.y + CONFIG.playerHeight,
      this.position.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  onKey(code, down) {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
    if (down && code === 'Digit1') {
      this.weapons.switchTo('pistol');
      setViewmodelWeapon(this.vm, 'pistol');
    }
    if (down && code === 'Digit2') {
      this.weapons.switchTo('smg');
      setViewmodelWeapon(this.vm, 'smg');
    }
    if (down && code === 'KeyR') this.weapons.tryReload();
  }

  onMouseDown(button) {
    if (button === 0) {
      this.mouseDown = true;
      this.firePress = true;
    }
  }

  onMouseUp(button) {
    if (button === 0) this.mouseDown = false;
  }

  onMouseMove(dx, dy) {
    this.yaw -= dx * CONFIG.mouseSens;
    this.pitch -= dy * CONFIG.mouseSens;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlash = 0.25;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  update(dt, enemies, tracers) {
    if (!this.alive) return;

    this.weapons.update(dt);
    if (this.damageFlash > 0) this.damageFlash -= dt;

    // Movement
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(forward);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (wish.lengthSq() > 0) {
      wish.normalize();
      let speed = CONFIG.moveSpeed;
      if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) speed *= CONFIG.sprintMul;
      this.position.addScaledVector(wish, speed * dt);
      this.bob += dt * 10;
    }

    // Jump
    if ((this.keys.has('Space')) && this.onGround) {
      this.velocityY = CONFIG.jumpSpeed;
      this.onGround = false;
    }
    this.velocityY -= CONFIG.gravity * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocityY = 0;
      this.onGround = true;
    }

    resolveCollision(
      this.position,
      CONFIG.playerRadius,
      CONFIG.playerHeight + 0.2,
      this.colliders
    );

    this.syncCamera();
    // subtle viewmodel bob
    const bobAmt = wish.lengthSq() > 0 ? Math.sin(this.bob) * 0.012 : 0;
    this.vm.group.position.y = bobAmt;
    this.vm.group.position.x = bobAmt * 0.5;

    // Fire
    let mode = null;
    if (this.firePress) mode = 'press';
    else if (this.mouseDown) mode = 'hold';
    const shot = this.weapons.tryFire(mode);
    this.firePress = false;

    this.vm.flash.visible = this.weapons.muzzleFlash > 0;

    if (shot) {
      const origin = this.camera.getWorldPosition(new THREE.Vector3());
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      // spread
      dir.x += (Math.random() - 0.5) * shot.spread;
      dir.y += (Math.random() - 0.5) * shot.spread;
      dir.z += (Math.random() - 0.5) * shot.spread;
      dir.normalize();

      const hit = hitscan(origin, dir, shot.range, enemies, this.colliders);
      const end = hit
        ? hit.point
        : origin.clone().addScaledVector(dir, shot.range * 0.6);
      tracers.push({ start: origin.clone(), end, life: 0.06 });

      if (hit && hit.type === 'enemy') {
        hit.enemy.takeDamage(shot.damage);
      }
    }
  }
}
