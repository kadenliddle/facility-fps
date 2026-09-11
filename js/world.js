import * as THREE from 'three';
import { CONFIG } from './config.js';

const P = CONFIG.palette;

/** Axis-aligned solid boxes used for collision (world space). */
export function createWorld(scene) {
  const colliders = [];
  const solids = new THREE.Group();
  solids.name = 'solids';
  scene.add(solids);

  const mat = (color) => new THREE.MeshLambertMaterial({ color });

  const mats = {
    wall: mat(P.concrete),
    wallDark: mat(P.concreteDark),
    floor: mat(P.floor),
    ceiling: mat(P.ceiling),
    teal: mat(P.teal),
    rust: mat(P.rust),
    metal: mat(P.metal),
  };

  function box(x, y, z, w, h, d, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    solids.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(w, h, d)
      ));
    }
    return mesh;
  }

  // —— Floor / ceiling slabs ——
  // Layout (top-down, +Z forward from spawn facing +Z):
  // Spawn corridor (z -2..10), T-junction room, east wing, west wing, north exit hall
  const floorY = 0;
  const ceilY = 3.2;
  const thick = 0.4;

  // Main corridor floor
  box(0, floorY - thick / 2, 8, 6, thick, 24, mats.floor, false);
  // Junction room
  box(0, floorY - thick / 2, 22, 18, thick, 10, mats.floor, false);
  // Exit hall
  box(0, floorY - thick / 2, 32, 5, thick, 12, mats.floor, false);
  // West wing
  box(-10, floorY - thick / 2, 22, 8, thick, 8, mats.floor, false);
  // East wing
  box(10, floorY - thick / 2, 22, 8, thick, 8, mats.floor, false);

  // Ceilings
  box(0, ceilY + thick / 2, 8, 6, thick, 24, mats.ceiling, false);
  box(0, ceilY + thick / 2, 22, 18, thick, 10, mats.ceiling, false);
  box(0, ceilY + thick / 2, 32, 5, thick, 12, mats.ceiling, false);
  box(-10, ceilY + thick / 2, 22, 8, thick, 8, mats.ceiling, false);
  box(10, ceilY + thick / 2, 22, 8, thick, 8, mats.ceiling, false);

  // —— Walls (outer shell) ——
  // Spawn corridor sides
  box(-3.2, 1.6, 8, 0.4, 3.2, 24, mats.wall);
  box(3.2, 1.6, 8, 0.4, 3.2, 24, mats.wall);
  // Spawn back wall
  box(0, 1.6, -4.2, 6.8, 3.2, 0.4, mats.wallDark);

  // Junction outer walls
  box(-9.2, 1.6, 17.2, 12, 3.2, 0.4, mats.wall); // south of west-ish
  box(9.2, 1.6, 17.2, 12, 3.2, 0.4, mats.wall);
  // Opening from corridor into junction is at z~17, x -3..3 — leave gap
  // Patch south walls only outside corridor mouth:
  // (already covered by corridor walls ending)

  // Junction north wall with exit opening (-2.5..2.5)
  box(-6.5, 1.6, 27.2, 7, 3.2, 0.4, mats.wall);
  box(6.5, 1.6, 27.2, 7, 3.2, 0.4, mats.wall);

  // Junction west/east outer
  box(-14.2, 1.6, 22, 0.4, 3.2, 10.4, mats.wall);
  box(14.2, 1.6, 22, 0.4, 3.2, 10.4, mats.wall);

  // West wing walls
  box(-10, 1.6, 17.8, 8.4, 3.2, 0.4, mats.wall);
  box(-10, 1.6, 26.2, 8.4, 3.2, 0.4, mats.wall);
  // East wing walls
  box(10, 1.6, 17.8, 8.4, 3.2, 0.4, mats.wall);
  box(10, 1.6, 26.2, 8.4, 3.2, 0.4, mats.wall);

  // Corridor-to-junction side pillars / partial walls
  box(-3.2, 1.6, 17.2, 0.4, 3.2, 0.4, mats.metal);
  box(3.2, 1.6, 17.2, 0.4, 3.2, 0.4, mats.metal);

  // Exit hall walls
  box(-2.7, 1.6, 32, 0.4, 3.2, 12, mats.wall);
  box(2.7, 1.6, 32, 0.4, 3.2, 12, mats.wall);
  // Exit end wall (door frame later)
  box(-1.8, 1.6, 38.2, 1.4, 3.2, 0.4, mats.wallDark);
  box(1.8, 1.6, 38.2, 1.4, 3.2, 0.4, mats.wallDark);
  box(0, 2.9, 38.2, 2.2, 0.6, 0.4, mats.wallDark); // lintel

  // Interior cover crates
  box(-1.5, 0.5, 6, 1.2, 1.0, 1.2, mats.rust);
  box(1.6, 0.4, 11, 1.0, 0.8, 1.0, mats.metal);
  box(-8, 0.6, 22, 1.4, 1.2, 1.4, mats.rust);
  box(8.5, 0.5, 21, 1.2, 1.0, 1.2, mats.metal);
  box(0, 0.55, 24.5, 2.0, 1.1, 0.8, mats.wallDark);

  // Accent strips (non-collide visual)
  box(0, 2.4, 8, 5.6, 0.08, 0.2, mats.teal, false);
  box(0, 2.4, 14, 5.6, 0.08, 0.2, mats.teal, false);
  box(0, 0.05, 22, 16, 0.06, 0.3, mats.rust, false);

  // Teal wall lights (emissive boxes)
  function lamp(x, y, z) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.18, 0.12),
      new THREE.MeshBasicMaterial({ color: P.tealBright })
    );
    g.position.set(x, y, z);
    solids.add(g);
    const light = new THREE.PointLight(P.tealBright, 1.1, 10, 2);
    light.position.set(x, y - 0.1, z);
    scene.add(light);
  }
  lamp(-2.9, 2.5, 2);
  lamp(2.9, 2.5, 8);
  lamp(-2.9, 2.5, 14);
  lamp(-13.5, 2.5, 22);
  lamp(13.5, 2.5, 22);
  lamp(-2.4, 2.5, 32);
  lamp(2.4, 2.5, 35);

  // Exit door (visual + trigger zone)
  const doorMat = new THREE.MeshLambertMaterial({
    color: P.teal,
    emissive: P.teal,
    emissiveIntensity: 0.25,
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 0.15), doorMat);
  door.position.set(0, 1.2, 38.05);
  door.name = 'exitDoor';
  solids.add(door);

  const exitZone = new THREE.Box3(
    new THREE.Vector3(-1.0, 0, 36.5),
    new THREE.Vector3(1.0, 2.5, 38.5)
  );

  // Ambient + fill
  scene.add(new THREE.AmbientLight(0x6a7a82, 0.55));
  const key = new THREE.DirectionalLight(0xb8c8c8, 0.35);
  key.position.set(4, 10, 2);
  scene.add(key);

  // Fog
  scene.fog = new THREE.Fog(CONFIG.fogColor, CONFIG.fogNear, CONFIG.fogFar);
  scene.background = new THREE.Color(CONFIG.fogColor);

  // Spawn + guard waypoints
  const spawn = new THREE.Vector3(0, 0, 0);

  const guardSpawns = [
    {
      position: new THREE.Vector3(0, 0, 12),
      waypoints: [
        new THREE.Vector3(-1.5, 0, 10),
        new THREE.Vector3(1.5, 0, 14),
        new THREE.Vector3(-1.2, 0, 16),
      ],
    },
    {
      position: new THREE.Vector3(-9, 0, 22),
      waypoints: [
        new THREE.Vector3(-11, 0, 20),
        new THREE.Vector3(-7, 0, 24),
        new THREE.Vector3(-11, 0, 24),
      ],
    },
    {
      position: new THREE.Vector3(9, 0, 22),
      waypoints: [
        new THREE.Vector3(11, 0, 20),
        new THREE.Vector3(7, 0, 24),
        new THREE.Vector3(11, 0, 23),
      ],
    },
    {
      position: new THREE.Vector3(0, 0, 30),
      waypoints: [
        new THREE.Vector3(-1.2, 0, 28),
        new THREE.Vector3(1.2, 0, 33),
        new THREE.Vector3(0, 0, 30),
      ],
    },
  ];

  return { colliders, spawn, guardSpawns, exitZone, door, solids };
}

/** Move a horizontal capsule (cylinder approx) against AABB colliders. */
export function resolveCollision(pos, radius, height, colliders) {
  const feet = pos.y;
  const head = pos.y + height;
  for (const box of colliders) {
    // Expand box by radius in XZ
    const minX = box.min.x - radius;
    const maxX = box.max.x + radius;
    const minZ = box.min.z - radius;
    const maxZ = box.max.z + radius;
    const minY = box.min.y;
    const maxY = box.max.y;

    if (head <= minY || feet >= maxY) continue;
    if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue;

    // Push out on smallest overlap axis (XZ only)
    const overlapX = Math.min(pos.x - minX, maxX - pos.x);
    const overlapZ = Math.min(pos.z - minZ, maxZ - pos.z);
    if (overlapX < overlapZ) {
      pos.x += pos.x - minX < maxX - pos.x ? -overlapX : overlapX;
    } else {
      pos.z += pos.z - minZ < maxZ - pos.z ? -overlapZ : overlapZ;
    }
  }
  // Keep above floor
  if (pos.y < 0) pos.y = 0;
  return pos;
}
