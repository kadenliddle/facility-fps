import * as THREE from 'three';
import { CONFIG } from './config.js';
import { resolveCollision } from './world.js';

const P = CONFIG.palette;

let nextId = 1;

export class Guard {
  constructor(spawn, waypoints, colliders) {
    this.id = nextId++;
    this.colliders = colliders;
    this.waypoints = waypoints.map((v) => v.clone());
    this.wpIndex = 0;
    this.position = spawn.clone();
    this.yaw = 0;
    this.hp = 100;
    this.alive = true;
    this.state = 'patrol'; // patrol | aggro
    this.fireCooldown = 1 + Math.random();
    this.speed = 2.1;
    this.aggroRange = 14;
    this.aggroCone = Math.cos((52 * Math.PI) / 180); // ~52° half? actually full cone ~104°, half 52
    this.loseRange = 20;
    this.damage = 12;
    this.mesh = this._buildMesh();
    this.mesh.userData.enemyId = this.id;
    this.mesh.traverse((c) => { c.userData.enemyId = this.id; });
    this._place();
  }

  _buildMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: P.guard });
    const trimMat = new THREE.MeshLambertMaterial({ color: P.guardTrim });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x2a3238 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.35), bodyMat);
    torso.position.y = 1.05;
    g.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), headMat);
    head.position.y = 1.7;
    g.add(head);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.06),
      new THREE.MeshBasicMaterial({ color: P.tealBright })
    );
    visor.position.set(0, 1.72, 0.16);
    g.add(visor);

    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), trimMat);
    gun.position.set(0.28, 1.1, 0.25);
    g.add(gun);

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.28), bodyMat);
    legs.position.y = 0.35;
    g.add(legs);

    return g;
  }

  _place() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.y = this.yaw;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.state = 'aggro';
    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
    } else {
      // hit flash
      this.mesh.traverse((c) => {
        if (c.isMesh && c.material && c.material.emissive) {
          c.material.emissive.setHex(0x442222);
          setTimeout(() => {
            if (c.material) c.material.emissive.setHex(0x000000);
          }, 80);
        }
      });
    }
  }

  update(dt, player, tracers) {
    if (!this.alive) return;

    const toPlayer = new THREE.Vector3().subVectors(player.position, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const facing = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const dirToPlayer = dist > 0.01 ? toPlayer.clone().normalize() : facing;
    const inCone = facing.dot(dirToPlayer) >= this.aggroCone;
    const canSee = dist < this.aggroRange && inCone;

    if (this.state === 'patrol' && canSee) this.state = 'aggro';
    if (this.state === 'aggro' && dist > this.loseRange) this.state = 'patrol';

    if (this.state === 'patrol') {
      const target = this.waypoints[this.wpIndex];
      const to = new THREE.Vector3().subVectors(target, this.position);
      to.y = 0;
      if (to.length() < 0.35) {
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      } else {
        to.normalize();
        this.yaw = Math.atan2(-to.x, -to.z);
        this.position.addScaledVector(to, this.speed * dt);
        resolveCollision(this.position, 0.3, 1.8, this.colliders);
      }
    } else {
      // Aggro: face player, slowly close if far, shoot
      if (dist > 0.05) {
        this.yaw = Math.atan2(-dirToPlayer.x, -dirToPlayer.z);
      }
      if (dist > 5) {
        this.position.addScaledVector(dirToPlayer, this.speed * 0.85 * dt);
        resolveCollision(this.position, 0.3, 1.8, this.colliders);
      }

      this.fireCooldown -= dt;
      if (this.fireCooldown <= 0 && dist < this.aggroRange && player.alive) {
        this.fireCooldown = 0.85 + Math.random() * 0.55;
        // Slow hitscan with miss chance
        const origin = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        const aim = player.position.clone().add(new THREE.Vector3(0, CONFIG.playerHeight * 0.7, 0));
        const shotDir = aim.sub(origin).normalize();
        // inaccuracy
        shotDir.x += (Math.random() - 0.5) * 0.08;
        shotDir.y += (Math.random() - 0.5) * 0.05;
        shotDir.z += (Math.random() - 0.5) * 0.08;
        shotDir.normalize();
        const end = origin.clone().addScaledVector(shotDir, Math.min(dist + 1, 30));
        tracers.push({ start: origin.clone(), end, life: 0.07, enemy: true });

        // Hit player if roughly aimed (simple cone + distance)
        const toP = new THREE.Vector3().subVectors(
          player.position.clone().setY(origin.y),
          origin
        );
        const hitChance = Math.max(0.25, 1 - dist / 18);
        if (shotDir.dot(toP.normalize()) > 0.96 && Math.random() < hitChance) {
          player.takeDamage(this.damage);
        }
      }
    }

    this._place();
  }
}

export function createGuards(spawns, colliders, scene) {
  const guards = spawns.map(
    (s) => new Guard(s.position, s.waypoints, colliders)
  );
  for (const g of guards) scene.add(g.mesh);
  return guards;
}
