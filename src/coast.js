const { Bodies, Body, Composite, Constraint, Vertices } = require('matter-js');

function buildCoast(island) {
  const { width, height, layout } = island;
  const farToe = width * island.map.coast.farToe;
  const farShore = width * island.map.coast.farShore;
  const farGround = layout.ground + 6;
  Object.assign(layout, { farToe, farShore, farGround });
  const relief = island.map.id === 'pools' ? 46 : island.map.id === 'sunset' ? 38 : 34;
  const phase = island.map.id === 'pools' ? 1.8 : island.map.id === 'sunset' ? 3.1 : 0.4;
  layout.seabed = Array.from({ length: 65 }, (_, index) => {
    const portion = index / 64;
    const envelope = Math.sin(portion * Math.PI) ** 2;
    const ridges = 0.24 + 0.32 * (1 + Math.sin(portion * Math.PI * 6 + phase)) + 0.18 * (1 + Math.sin(portion * Math.PI * 14 + phase * 0.65));
    return { x: layout.toe + (farToe - layout.toe) * portion, y: layout.bottom - relief * envelope * ridges };
  });
  const options = { isStatic: true, friction: 0.7, restitution: 0.08, label: 'sand' };
  layout.curved = true;
  const crossing = (lower, upper, descending) => {
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const middle = (lower + upper) / 2;
      if ((floorAt(island, middle) < layout.water) === descending) lower = middle; else upper = middle;
    }
    return (lower + upper) / 2;
  };
  layout.waterStart = crossing(layout.shore, layout.toe, true);
  layout.waterEnd = crossing(farToe, farShore, false);
  const oldBank = island.terrain[1];
  Composite.remove(island.engine.world, oldBank);
  island.terrain.splice(1, 1);
  island.bankSegments = [];
  for (const [start, end] of [[layout.shore, layout.toe], [farToe, farShore]]) {
    for (let index = 0; index < 24; index += 1) {
      const firstX = start + (end - start) * index / 24;
      const lastX = start + (end - start) * (index + 1) / 24;
      const vertices = [{ x: firstX, y: floorAt(island, firstX) }, { x: lastX, y: floorAt(island, lastX) }, { x: lastX, y: layout.bottom + 45 }, { x: firstX, y: layout.bottom + 45 }];
      const center = Vertices.centre(vertices);
      const bank = Bodies.fromVertices(center.x, center.y, [vertices], options);
      island.bankSegments.push(bank); island.terrain.push(bank);
    }
  }
  const farBeach = Bodies.rectangle((farShore + width + 100) / 2, (farGround + height + 150) / 2, width + 100 - farShore, height + 150 - farGround, options);
  island.seabedSegments = layout.seabed.slice(0, -1).map((point, index) => {
    const next = layout.seabed[index + 1];
    const vertices = [point, next, { x: next.x, y: layout.bottom + 45 }, { x: point.x, y: layout.bottom + 45 }];
    const center = Vertices.centre(vertices);
    return Bodies.fromVertices(center.x, center.y, [vertices], options);
  });
  island.terrain.push(...island.seabedSegments);
  island.terrain.push(farBeach);
  Composite.add(island.engine.world, [...island.bankSegments, ...island.seabedSegments, farBeach]);
  for (const rock of island.rocks) Body.setPosition(rock, { x: rock.position.x, y: floorAt(island, rock.position.x) - (rock.bounds.max.y - rock.bounds.min.y) / 2 + 4 });
  for (const prop of island.props.filter(item => !item.onLand && !item.anchor)) {
    const margin = (prop.radius || prop.width / 2) + 15;
    if (prop.body.position.x < layout.waterStart + margin) Body.setPosition(prop.body, { x: layout.waterStart + margin, y: prop.body.position.y });
  }
  island.landmarks = {
    picnic: { x: width * 0.22, y: layout.ground, radius: 78, name: 'Coconut clearing' },
    nook: { x: Math.max(layout.shore * 0.84, width * 0.22 + 150), y: layout.ground, radius: 68, name: 'Shell corner' },
    reef: { x: (layout.toe + farToe) / 2, y: floorAt(island, (layout.toe + farToe) / 2), radius: 110, name: 'Reef garden' },
    far: { x: width * 0.955, y: farGround, radius: 85, name: 'Far-shore lookout' },
  };
  const extras = [
    { kind: 'shell', x: width * 0.185, y: layout.ground - 60, radius: 20, mass: 0.7, density: 1.5, expeditionId: 'shell-one' },
    { kind: 'shell', x: Math.min(width * 0.29, layout.shore - 100), y: layout.ground - 55, radius: 23, mass: 0.9, density: 1.6, expeditionId: 'shell-two' },
    { kind: 'crate', x: width * 0.943, y: farGround - 62, width: 40, height: 40, mass: 1.1, density: 0.54, expeditionId: 'far-crate' },
    { kind: 'stone', x: layout.shore - 135, y: layout.ground - 45, radius: 12, mass: 0.50, density: 2.2, expeditionId: 'skipping-stone-one' },
    { kind: 'stone', x: layout.shore - 94, y: layout.ground - 43, radius: 15, mass: 0.7, density: 2.3, expeditionId: 'skipping-stone-two' },
  ];
  for (const extra of extras) island.addProp(extra.kind, extra.x, extra.y, extra);
  const swingX = width * 0.19;
  const swing = island.addProp('swing', swingX, layout.ground - 68, { width: 96, height: 14, mass: 1.3, density: 0.7, expeditionId: 'leaf-swing' });
  swing.ropeAnchors = [{ x: swingX - 35, y: layout.ground - 233 }, { x: swingX + 35, y: layout.ground - 233 }];
  swing.ropes = swing.ropeAnchors.map((anchor, index) => Constraint.create({ pointA: { ...anchor }, bodyB: swing.body, pointB: { x: index ? 35 : -35, y: -3 }, stiffness: 0.82, damping: 0.03 }));
  Composite.add(island.engine.world, swing.ropes);
  if (island.map.id === 'lagoon') {
    island.dock = Bodies.rectangle(layout.shore + 88, layout.water - 14, 212, 14, { ...options, label: 'dock' });
    island.terrain.push(island.dock);
    Composite.add(island.engine.world, island.dock);
    const positionX = layout.toe + 160;
    const buoy = island.addProp('buoy', positionX, layout.water - 15, { radius: 19, mass: 0.8, density: 0.2, expeditionId: 'lagoon-buoy' });
    buoy.ropeAnchors = [{ x: positionX, y: floorAt(island, positionX) - 4 }];
    buoy.ropes = [Constraint.create({ pointA: buoy.ropeAnchors[0], bodyB: buoy.body, pointB: { x: 0, y: 14 }, length: buoy.ropeAnchors[0].y - layout.water + 2, stiffness: 0.025, damping: 0.07 })];
    Composite.add(island.engine.world, buoy.ropes);
  } else if (island.map.id === 'sunset') {
    for (let index = 0; index < 3; index += 1) {
      const positionX = width * 0.955 + (index - 1) * 30;
      const bell = island.addProp('bell', positionX, farGround - 85 + index * 13, { radius: 10 + index, mass: 0.27, density: 1.2, expeditionId: `cove-chime-${index}` });
      bell.ropeAnchors = [{ x: positionX, y: farGround - 163 }];
      bell.ropes = [Constraint.create({ pointA: bell.ropeAnchors[0], bodyB: bell.body, pointB: { x: 0, y: -8 }, stiffness: 0.7, damping: 0.015 })];
      Composite.add(island.engine.world, bell.ropes);
    }
  }
}

function floorAt(island, positionX) {
  const { ground, bottom, shore, toe, farToe, farShore, farGround } = island.layout;
  if (positionX <= shore) return ground;
  const profile = amount => {
    if (!island.layout.curved) return amount;
    if (island.map.coast.bank === 'terraced') {
      const terraces = [[0, 0], [0.18, 0.065], [0.36, 0.07], [0.55, 0.32], [0.70, 0.33], [1, 1]];
      const upper = terraces.findIndex(point => point[0] >= amount);
      if (upper <= 0) return 0;
      const start = terraces[upper - 1], end = terraces[upper];
      const portion = (amount - start[0]) / (end[0] - start[0]);
      return start[1] + portion * portion * (3 - 2 * portion) * (end[1] - start[1]);
    }
    return amount * amount * (3 - 2 * amount) + 0.012 * Math.sin(amount * Math.PI * 3) * Math.sin(amount * Math.PI) ** 2;
  };
  if (positionX < toe) return ground + profile((positionX - shore) / (toe - shore)) * (bottom - ground);
  if (island.layout.seabed && positionX <= farToe) {
    const points = island.layout.seabed;
    const portion = (positionX - toe) / (farToe - toe) * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(portion));
    return points[index].y + (points[index + 1].y - points[index].y) * (portion - index);
  }
  if (!farToe || positionX <= farToe) return bottom;
  if (positionX < farShore) return bottom + profile((positionX - farToe) / (farShore - farToe)) * (farGround - bottom);
  return farGround;
}

module.exports = { buildCoast, floorAt };