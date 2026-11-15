import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundled = await build({
  stdin: { contents: `export { Store } from './src/core/store'; export { collectData } from './src/data/loaders'; export { terrainHeight, terrainRocks } from './src/rover/terrain3d'; export { stepVehicle, PHYSICS_MS } from './src/rover/vehicle'; export { bus, EV } from './src/core/events';`, resolveDir: process.cwd(), loader: 'ts' },
  plugins: [{ name: 'events', setup(b) {
    b.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'shim' }));
    b.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({ contents: `import {EventEmitter} from 'node:events'; export default {Events:{EventEmitter}};` }));
  }}], bundle: true, platform: 'node', format: 'esm', write: false,
});
const { Store, collectData, terrainHeight, terrainRocks, stepVehicle, PHYSICS_MS, bus, EV } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'));
const values = new Map();
for (const world of ['mars','moon']) for (const name of ['storms','weather','crops','delay','photos','trivia','terrain','science']) {
  values.set(`data:${world === 'moon' ? 'moon:' : ''}${name}`, JSON.parse(await readFile(`public/data/${world === 'moon' ? 'moon/' : ''}${name}.json`, 'utf8')));
}
collectData({ cache: { json: { get: key => values.get(key) } } });
const check = r => assert.equal(r.ok, true, r.reason);
function fresh(world = 'mars') {
  const s = new Store(false); s.save = () => {}; s.startCampaign(world);
  check(s.setPowerSplit({ growLights: 0, heater: 0, shelter: 0, rover: 2 })); check(s.startDay()); return s;
}
function launch(s, distance = 1) {
  const [x,y] = s.data.terrain.dome, route = [[x,y]];
  for (let i = 1; i <= distance; i++) route.push([x+i,y]);
  for (let i = distance-1; i >= 0; i--) route.push([x+i,y]);
  check(s.launchManualRover(route, [[x+distance,y],[x,y]]));
}
function tick(s, ms) { for (let left = ms; left > 0; left -= Math.min(left, 100)) s.tick(Math.min(left,100)); }
function reload(s) { const next = new Store(false); next.save = () => {}; assert.equal(next.restore(s.serialize()),true); return next; }
function place(s, x, y) {
  Object.assign(s.state.rover.manual.vehicle, { x,y,z:terrainHeight(s.worldId,s.data.terrain,x,y),vx:0,vy:0,vz:0 });
  tick(s, PHYSICS_MS + 0.01);
}

test('physics accelerates, brakes, reverses, steers and constrains boundaries', () => {
  const s = fresh(), t = s.data.terrain, [x,y] = t.dome;
  let p = {x,y,z:0,vx:0,vy:0,vz:0,heading:0};
  for(let i=0;i<120;i++) p = stepVehicle(p,{throttle:1,steer:0,brake:false},'mars',t,[],1/60);
  assert.ok(p.x > x + 0.3); assert.ok(p.vx > 1);
  const speed = Math.hypot(p.vx,p.vy);
  for(let i=0;i<90;i++) p=stepVehicle(p,{throttle:0,steer:0,brake:true},'mars',t,[],1/60);
  assert.ok(Math.hypot(p.vx,p.vy) < speed * 0.1);
  for(let i=0;i<120;i++) p=stepVehicle(p,{throttle:-1,steer:1,brake:false},'mars',t,[],1/60);
  assert.ok(Math.abs(p.heading)>0.2);
  p=stepVehicle({...p,x:0,y:0,z:0,vx:-4,vy:-4},{throttle:0,steer:0,brake:false},'mars',t,[],1/60);
  assert.ok(p.x>=0 && p.y>=0);
});

test('Moon falls more slowly and retains more lateral slip; terrain is deterministic and distinct', () => {
  const s=fresh(), t=s.data.terrain, [x,y]=t.dome;
  const start={x,y,z:3,vx:2,vy:0,vz:0,heading:0};
  let mars={...start},moon={...start};
  for(let i=0;i<30;i++) {
    mars=stepVehicle(mars,{throttle:0,steer:0,brake:false},'mars',t,[],1/60);
    moon=stepVehicle(moon,{throttle:0,steer:0,brake:false},'moon',t,[],1/60);
  }
  assert.ok(moon.z>mars.z+0.2);
  const slip={...start,z:0,vx:0,vy:2};
  assert.ok(stepVehicle(slip,{throttle:0,steer:0,brake:false},'moon',t,[],1/60).vy > stepVehicle(slip,{throttle:0,steer:0,brake:false},'mars',t,[],1/60).vy);
  assert.equal(terrainHeight('mars',t,3,4),terrainHeight('mars',t,3,4));
  assert.notEqual(terrainHeight('mars',t,3,4),terrainHeight('moon',t,3,4));
  assert.equal(terrainHeight('mars',t,x,y),0);
  assert.ok(terrainRocks(t).every(r=>Math.hypot(r.x-x,r.y-y)>1.6));
});

test('continuous driving completes a route under player input on both worlds', () => {
  for (const world of ['mars','moon']) {
    const s=fresh(world); launch(s);
    for(let i=0;i<1200 && s.state.rover.status==='out';i++) {
      const m=s.state.rover.manual, target=m.checkpoints[m.nextCheckpoint] ?? s.data.terrain.dome;
      const error=(target[0]-m.vehicle.x)*8;
      const desired=Math.max(-1.5,Math.min(2,error*1.6));
      s.setDriveInput({throttle:Math.max(-1,Math.min(1,(desired-m.vehicle.vx)*1.5)),steer:0,brake:false});
      s.tick(PHYSICS_MS);
    }
    assert.equal(s.state.rover.status,'home',world);
    assert.ok(s.state.log.some(line=>line.includes('Manual route complete')));
  }
});

test('ordered checkpoints, off-route collection and 2× delivery are exactly once across reload', () => {
  for(const world of ['mars','moon']) {
    let s=fresh(world); const t=s.data.terrain,[x,y]=t.dome;
    const find={id:'drive-test',x:x+1,y,item:'ice',amount:3}; t.finds.push(find);
    try {
      const before=s.state.inventory.ice; launch(s);
      place(s,x,y); assert.equal(s.state.rover.manual.nextCheckpoint,0);
      place(s,x+1,y); assert.equal(s.state.rover.manual.nextCheckpoint,1); assert.equal(s.state.rover.cargo.ice,3);
      s=reload(s); place(s,x+1,y); assert.equal(s.state.rover.cargo.ice,3);
      place(s,x,y); assert.equal(s.state.rover.status,'home'); assert.equal(s.state.inventory.ice,before+6);
      s=reload(s); tick(s,100); assert.equal(s.state.inventory.ice,before+6);
    } finally { t.finds.splice(t.finds.indexOf(find),1); }
  }
});

test('early docking and autopilot handoff deliver normal cargo and preserve remaining battery', () => {
  let s=fresh(); launch(s,2); const [x,y]=s.data.terrain.dome;
  s.state.rover.cargo.ice=2; place(s,x+1,y); place(s,x,y);
  assert.equal(s.state.inventory.ice,2); assert.doesNotMatch(s.state.log.at(-1),/Manual route complete/);
  s=fresh(); launch(s); place(s,x+1,y); s.state.rover.cargo.ice=2;
  const battery=s.state.rover.batteryCells; check(s.handoffRover());
  assert.equal(s.state.rover.driveMode,'plan'); assert.equal(s.state.rover.manual,undefined);
  assert.ok(s.state.rover.batteryCells<=battery && s.state.rover.batteryCells>battery-0.01);
  tick(s,s.rules.roverMsPerTile+1); assert.equal(s.state.inventory.ice,2);
});

test('distance battery charges survive reload and manual state freezes during pause', () => {
  let s=fresh(); launch(s); s.setDriveInput({throttle:1,steer:0,brake:false}); tick(s,1500);
  const battery=s.state.rover.batteryCells; assert.ok(battery<2 && battery>1.8);
  s=reload(s); assert.equal(s.state.rover.batteryCells,battery);
  const snapshot=s.serialize(); s.pause('test'); tick(s,1000); assert.equal(s.serialize(),snapshot); s.resume('test');
  s.state.rover.batteryCells=0; s.setDriveInput({throttle:1,steer:0,brake:false}); tick(s,100);
  assert.equal(s.state.rover.status,'stranded');
  s=reload(s); assert.equal(s.state.rover.status,'stranded');
});

test('storm at a physics timestamp wins over docking and cargo reward', () => {
  const s=fresh('moon'), hit=s.storms()[0];
  s.state.sol=hit.event.scenario.gameSol; s.state.missionElapsedMs=hit.hitAtMs-PHYSICS_MS;
  launch(s); const m=s.state.rover.manual; m.departed=true; m.nextCheckpoint=m.checkpoints.length;
  s.state.rover.cargo.ice=2; m.nextPhysicsAtMs=hit.hitAtMs;
  tick(s,PHYSICS_MS+0.01); assert.equal(s.state.rover.status,'stranded'); assert.equal(s.state.inventory.ice,0);
});

test('malformed manual saves do not replace live state', () => {
  const s=fresh(); launch(s); const before=s.serialize();
  for (const change of [m=>{m.vehicle.x=-1;},m=>{m.nextCheckpoint=99;},m=>{m.nextPhysicsAtMs=-1;},m=>{m.checkpoints=[[0,0]];},m=>{m.vehicle.vx=100;}]) {
    const raw=JSON.parse(before); change(raw.state.rover.manual); assert.equal(s.restore(JSON.stringify(raw)),false); assert.equal(s.serialize(),before);
  }
});

test('sample cargo doubles without doubling photo awards', () => {
  const s=fresh(); launch(s); const [x,y]=s.data.terrain.dome;
  s.state.rover.cargo.sample=1; const before=s.meta.photosEarned.length;
  place(s,x+1,y); place(s,x,y);
  assert.equal(s.state.inventory.sample,2); assert.equal(s.meta.photosEarned.length,before+1);
});

test('manual docking emits one return event with the delivered amount and bonus', () => {
  const s=fresh(); launch(s); const [x,y]=s.data.terrain.dome; let events=[];
  const onReturn=e=>events.push(e); bus.on(EV.ROVER_RETURN,onReturn);
  try { s.state.rover.cargo.regolith=2; place(s,x+1,y); place(s,x,y); tick(s,100);
    assert.equal(events.length,1); assert.equal(events[0].manualBonus,true); assert.equal(events[0].deliveredItems.regolith,4);
  } finally { bus.off(EV.ROVER_RETURN,onReturn); }
});

test('off-route finds can be collected without skipping the selected checkpoint', () => {
  const s=fresh(),t=s.data.terrain,[x,y]=t.dome;
  const f={id:'off-route',x,y:y+1,item:'parts',amount:2}; t.finds.push(f);
  try { launch(s,2); place(s,x,y+1); assert.equal(s.state.rover.cargo.parts,2); assert.equal(s.state.rover.manual.nextCheckpoint,0);
    place(s,x,y); assert.equal(s.state.inventory.parts,2);
  } finally { t.finds.splice(t.finds.indexOf(f),1); }
});

test('airborne saves resume safely and hidden tabs do not advance the vehicle', () => {
  let s=fresh('moon'); launch(s); s.state.rover.manual.vehicle.z=3; s.state.rover.manual.vehicle.vz=2;
  s=reload(s); assert.equal(s.state.rover.manual.vehicle.z,3); const before=s.serialize();
  s.hidden=true; tick(s,5000); assert.equal(s.serialize(),before); s.hidden=false; tick(s,1000);
  assert.ok(s.state.rover.manual.vehicle.z>3);
});

test('manual expeditions persist across a night and terminal recovery does not double cargo', () => {
  let s=fresh(); s.state.missionElapsedMs=s.dayEndMs()-50; launch(s); s.state.rover.cargo.ice=2;
  tick(s,50); assert.equal(s.state.phase,'planning'); s=reload(s); assert.equal(s.state.rover.cargo.ice,2);
  check(s.startDay()); tick(s,100); assert.ok(s.state.rover.manual);
  s.state.processedStormHits=s.storms().map(st=>st.event.id); s.state.processedWarnings=[...s.state.processedStormHits];
  s.state.sol=10; s.state.missionElapsedMs=s.dayEndMs()-50;
  s.state.rover.manual.nextPhysicsAtMs=s.state.missionElapsedMs+PHYSICS_MS;
  tick(s,50); assert.equal(s.state.rover.manual,undefined); assert.equal(s.state.rover.status,'home'); assert.equal(s.state.inventory.ice,2);
});

test('collisions stop the rover without passing through rocks', () => {
  const s=fresh(),t=s.data.terrain,[x,y]=t.dome;
  const start={x,y,z:0,vx:4,vy:0,vz:0,heading:0};
  const p=stepVehicle(start,{throttle:1,steer:0,brake:false},'mars',t,[{x:x+0.14,y,radius:0.5}],1/60);
  assert.equal(p.x,start.x); assert.ok(p.vx<=0);
});
