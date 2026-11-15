import * as THREE from 'three';
import type { Terrain, Find } from '../data/loaders';
import type { ManualExpedition, WorldId } from '../core/types';
import { settings } from '../core/settings';
import { METRES_PER_CELL as M, terrainHeight, terrainRocks } from './terrain3d';

/** A render-only adapter. The store owns every simulation value and reward. */
export class DrivingView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1280 / 548, 0.1, 650);
  private rover = new THREE.Group();
  private shadow!: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];
  private markers: THREE.Mesh[] = [];
  private finds = new Map<string, THREE.Mesh>();
  private initialized = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private world: WorldId, private terrain: Terrain, route: [number, number][], checkpoints: [number, number][], finds: Find[]) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    try {
      this.renderer.setSize(1280, 548, false);
      this.renderer.setPixelRatio(1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.scene.background = new THREE.Color(world === 'mars' ? 0xb98068 : 0x050914);
      this.scene.fog = new THREE.Fog(world === 'mars' ? 0xb98068 : 0x050914, 85, 300);
      this.scene.add(new THREE.HemisphereLight(world === 'mars' ? 0xffe0bb : 0xcedfff, world === 'mars' ? 0x5f332b : 0x242538, 2));
      const sun = new THREE.DirectionalLight(0xfff2de, world === 'moon' ? 3 : 2.2);
      sun.position.set(-40, 60, -25); this.scene.add(sun);
      this.buildGround();
      this.buildRover();
      const line = new THREE.BufferGeometry().setFromPoints(route.map(([x, y]) => new THREE.Vector3(x * M, this.height(x, y) + 0.08, y * M)));
      this.scene.add(new THREE.Line(line, new THREE.LineBasicMaterial({ color: 0xe8ba65, transparent: true, opacity: 0.6 })));
      for (const [x, y] of checkpoints) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.12, 6, 36), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
        ring.rotation.x = Math.PI / 2; ring.position.set(x * M, this.height(x, y) + 0.22, y * M);
        this.markers.push(ring); this.scene.add(ring);
      }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa5d9db, metalness: 0.25, roughness: 0.4 }));
      // Put the habitat beside its docking pad so it never encloses the rover at spawn.
      dome.position.set(terrain.dome[0] * M - 6, this.height(terrain.dome[0] - 0.75, terrain.dome[1] - 0.75), terrain.dome[1] * M - 6); this.scene.add(dome);
      const pad = new THREE.Mesh(new THREE.RingGeometry(2.8, 3.2, 40), new THREE.MeshBasicMaterial({ color: 0x8fe9df, side: THREE.DoubleSide }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(terrain.dome[0] * M, this.height(...terrain.dome) + 0.05, terrain.dome[1] * M); this.scene.add(pad);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1), new THREE.MeshStandardMaterial({ color: 0x315d67 }));
      door.position.copy(dome.position).add(new THREE.Vector3(0, 1, 3)); this.scene.add(door);
      for (const f of finds) {
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(f.egg ? 0.8 : 0.55), new THREE.MeshStandardMaterial({ color: f.item === 'ice' ? 0x98e4ff : f.item === 'sample' ? 0xcd9cff : 0xffdb78, emissive: 0x332b15 }));
        mesh.position.set(f.x * M, this.height(f.x, f.y) + 0.8, f.y * M); this.scene.add(mesh); this.finds.set(f.id, mesh);
      }
    } catch (error) { this.dispose(); throw error; }
  }

  private height(x: number, y: number) { return terrainHeight(this.world, this.terrain, x, y); }

  private buildGround() {
    const t = this.terrain, nx = (t.width - 1) * 4, ny = (t.height - 1) * 4;
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = i / 4, y = j / 4, h = this.height(x, y);
      positions.push(x * M, h, y * M);
      const rough = t.cost[Math.round(y)][Math.round(x)];
      const color = new THREE.Color(this.world === 'mars' ? 0xa95f42 : 0x85858e);
      color.multiplyScalar(0.9 + 0.1 * Math.sin(x * 7 + y * 11) + (rough - 1) * 0.05);
      colors.push(color.r, color.g, color.b);
      if (i < nx && j < ny) { const a = j * (nx + 1) + i; indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    this.scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: this.world === 'mars' ? 0x724c3e : 0x51545f, roughness: 1, flatShading: true });
    for (const rock of terrainRocks(t)) {
      const mesh = new THREE.Mesh(rockGeometry, rockMaterial);
      mesh.position.set(rock.x * M, this.height(rock.x, rock.y) + rock.radius * 0.4, rock.y * M);
      mesh.scale.set(rock.radius, rock.radius * 0.8, rock.radius); mesh.rotation.y = rock.x * 7; this.scene.add(mesh);
    }
  }

  private buildRover() {
    const white = new THREE.MeshStandardMaterial({ color: 0xe5e3d9, metalness: 0.25, roughness: 0.65 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x252e3a, roughness: 0.9 });
    const panel = new THREE.MeshStandardMaterial({ color: 0x32689c, metalness: 0.5, roughness: 0.3 });
    const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); this.rover.add(mesh); return mesh;
    };
    box(2.1, 0.5, 1.4, white, 0, 0.85, 0);
    box(1.6, 0.08, 1.9, panel, -0.4, 1.17, 0);
    box(0.12, 1.15, 0.12, white, 0.65, 1.65, 0);
    box(0.5, 0.28, 0.55, white, 0.65, 2.2, 0);
    box(0.06, 0.14, 0.36, dark, 0.92, 2.2, 0);
    const wheelGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    for (const x of [-0.8, 0, 0.8]) for (const z of [-0.9, 0.9]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark); wheel.rotation.x = Math.PI / 2; wheel.position.set(x, 0.43, z); this.rover.add(wheel); this.wheels.push(wheel);
    }
    this.scene.add(this.rover);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: 0x12121a, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
  }

  render(m: ManualExpedition, collected: string[]) {
    const p = m.vehicle, forward = new THREE.Vector3(Math.cos(p.heading), 0, Math.sin(p.heading));
    this.rover.position.set(p.x * M, p.z, p.y * M);
    this.rover.rotation.set(0, -p.heading, 0);
    const slope = (this.height(p.x + Math.cos(p.heading) * 0.1, p.y + Math.sin(p.heading) * 0.1) - this.height(p.x - Math.cos(p.heading) * 0.1, p.y - Math.sin(p.heading) * 0.1)) / (0.2 * M);
    this.rover.rotation.z = Math.atan(slope);
    const distance = this.initialized ? Math.hypot(p.x - this.lastX, p.y - this.lastY) * M : 0;
    for (const wheel of this.wheels) wheel.rotation.y += distance / 0.42;
    this.lastX = p.x; this.lastY = p.y;
    this.shadow.position.set(p.x * M, this.height(p.x, p.y) + 0.04, p.y * M);
    this.shadow.scale.setScalar(Math.max(0.5, 1 - (p.z - this.height(p.x, p.y)) * 0.1));
    const target = this.rover.position.clone().addScaledVector(forward, -10);
    target.y += settings.reducedMotion ? 6 : 4.8;
    target.x = Math.max(0, Math.min((this.terrain.width - 1) * M, target.x));
    target.z = Math.max(0, Math.min((this.terrain.height - 1) * M, target.z));
    target.y = Math.max(target.y, this.height(target.x / M, target.z / M) + 2);
    if (!this.initialized) this.camera.position.copy(target);
    else this.camera.position.lerp(target, settings.reducedMotion ? 0.08 : 0.16);
    this.camera.lookAt(this.rover.position.clone().addScaledVector(forward, 3).add(new THREE.Vector3(0, 1, 0)));
    this.initialized = true;
    this.markers.forEach((marker, i) => { marker.visible = i >= m.nextCheckpoint; (marker.material as THREE.MeshBasicMaterial).color.setHex(i === m.nextCheckpoint ? 0x78ffe3 : 0xffd166); });
    for (const [id, mesh] of this.finds) mesh.visible = !collected.includes(id);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
