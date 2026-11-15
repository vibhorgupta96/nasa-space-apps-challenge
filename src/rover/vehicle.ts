import type { WorldId } from '../core/types';
import type { Terrain } from '../data/loaders';
import { worldProfile } from '../core/worlds';
import { METRES_PER_CELL, terrainHeight, type TerrainRock } from './terrain3d';

export interface DriveInput { throttle: number; steer: number; brake: boolean }
export interface VehiclePose { x: number; y: number; z: number; vx: number; vy: number; vz: number; heading: number }
export const STOP_INPUT: DriveInput = { throttle: 0, steer: 0, brake: true };
export const PHYSICS_MS = 1000 / 60;

/** Pure fixed-step arcade dynamics; x/y are cells, all velocity and height values are metres. */
export function stepVehicle(p: VehiclePose, input: DriveInput, world: WorldId, t: Terrain, rocks: TerrainRock[], dt: number): VehiclePose {
  const n = { ...p };
  const ground = terrainHeight(world, t, p.x, p.y);
  const grounded = p.z <= ground + 0.045;
  const initialForward = p.vx * Math.cos(p.heading) + p.vy * Math.sin(p.heading);
  const steerGrip = grounded ? 1 : 0.12;
  n.heading += input.steer * Math.min(1, Math.abs(initialForward) / 1.2) * Math.sign(initialForward) * 1.7 * steerGrip * dt;
  let forward = p.vx * Math.cos(n.heading) + p.vy * Math.sin(n.heading);
  let lateral = -p.vx * Math.sin(n.heading) + p.vy * Math.cos(n.heading);
  if (grounded) {
    const slope = (terrainHeight(world, t, p.x + Math.cos(p.heading) * 0.04, p.y + Math.sin(p.heading) * 0.04) - ground) / (0.04 * METRES_PER_CELL);
    forward += (input.throttle * 2.6 - slope * worldProfile(world).gravityMs2) * dt;
    forward *= Math.exp(-(input.brake ? 8 : input.throttle ? 0.15 : 1.4) * dt);
    lateral *= Math.exp(-(world === 'moon' ? 3 : 7) * dt);
  }
  forward = Math.max(-2, Math.min(4.2, forward));
  n.vx = Math.cos(n.heading) * forward - Math.sin(n.heading) * lateral;
  n.vy = Math.sin(n.heading) * forward + Math.cos(n.heading) * lateral;
  n.x = Math.max(0, Math.min(t.width - 1, p.x + n.vx * dt / METRES_PER_CELL));
  n.y = Math.max(0, Math.min(t.height - 1, p.y + n.vy * dt / METRES_PER_CELL));
  if (n.x === 0 || n.x === t.width - 1) n.vx = 0;
  if (n.y === 0 || n.y === t.height - 1) n.vy = 0;
  for (const rock of rocks) {
    if (Math.hypot(n.x - rock.x, n.y - rock.y) * METRES_PER_CELL < rock.radius + 0.65 && p.z < terrainHeight(world, t, rock.x, rock.y) + rock.radius * 1.6) {
      n.x = p.x; n.y = p.y; n.vx *= -0.15; n.vy *= -0.15;
    }
  }
  const nextGround = terrainHeight(world, t, n.x, n.y);
  const surfaceVelocity = (nextGround - ground) / dt;
  n.vz = (grounded ? Math.max(0, surfaceVelocity) : p.vz) - worldProfile(world).gravityMs2 * dt;
  n.z = Math.max(nextGround, p.z + n.vz * dt);
  if (n.z <= nextGround) n.vz = 0;
  return n;
}
