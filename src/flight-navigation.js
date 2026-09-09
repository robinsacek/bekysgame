const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
const inside = (point, bounds) => point.x > bounds.min.x && point.x < bounds.max.x && point.y > bounds.min.y && point.y < bounds.max.y;

function intersects(first, second, bounds) {
  let entry = 0;
  let exit = 1;
  for (const axis of ['x', 'y']) {
    const delta = second[axis] - first[axis];
    if (Math.abs(delta) < 0.0001) {
      if (first[axis] <= bounds.min[axis] || first[axis] >= bounds.max[axis]) return false;
    } else {
      const lower = (bounds.min[axis] - first[axis]) / delta;
      const upper = (bounds.max[axis] - first[axis]) / delta;
      entry = Math.max(entry, Math.min(lower, upper));
      exit = Math.min(exit, Math.max(lower, upper));
      if (entry >= exit) return false;
    }
  }
  return entry < 0.9999 && exit > 0.0001;
}

function corridorClear(first, second, obstacles, validPoint) {
  if (obstacles.some(bounds => inside(first, bounds) || intersects(first, second, bounds))) return false;
  const steps = Math.max(2, Math.ceil(distance(first, second) / 35));
  for (let step = 1; step <= steps; step += 1) {
    const portion = step / steps;
    if (!validPoint({ x: first.x + (second.x - first.x) * portion, y: first.y + (second.y - first.y) * portion })) return false;
  }
  return true;
}

function planFlightPath(start, goal, obstacles, validPoint = () => true) {
  const containing = obstacles.filter(bounds => inside(start, bounds));
  if (containing.length) {
    const exits = [
      { x: Math.min(...containing.map(bounds => bounds.min.x)) - 6, y: start.y },
      { x: Math.max(...containing.map(bounds => bounds.max.x)) + 6, y: start.y },
      { x: start.x, y: Math.min(...containing.map(bounds => bounds.min.y)) - 6 },
      { x: start.x, y: Math.max(...containing.map(bounds => bounds.max.y)) + 6 },
    ].filter(point => validPoint(point) && !obstacles.some(bounds => inside(point, bounds))
      && containing.every(bounds => point.x !== start.x
        ? (start.x - (bounds.min.x + bounds.max.x) / 2) * (point.x - start.x) >= 0
        : (start.y - (bounds.min.y + bounds.max.y) / 2) * (point.y - start.y) >= 0))
      .sort((first, second) => distance(start, first) - distance(start, second));
    const surrounding = obstacles.filter(bounds => !inside(start, bounds));
    for (const exit of exits) {
      if (!corridorClear(start, exit, surrounding, validPoint)) continue;
      const onward = planFlightPath(exit, goal, obstacles, validPoint);
      if (onward.length) return [exit, ...onward];
    }
    return [];
  }
  if (corridorClear(start, goal, obstacles, validPoint)) return [{ ...goal }];
  const nodes = [{ ...start }, { ...goal }];
  for (const bounds of obstacles) {
    for (const positionX of [bounds.min.x - 3, bounds.max.x + 3]) for (const positionY of [bounds.min.y - 3, bounds.max.y + 3]) {
      const point = { x: positionX, y: positionY };
      if (validPoint(point) && !obstacles.some(obstacle => inside(point, obstacle))) nodes.push(point);
    }
  }
  const costs = nodes.map(() => Infinity);
  const parents = nodes.map(() => -1);
  const visited = new Set();
  costs[0] = 0;
  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1) if (!visited.has(index) && (current < 0 || costs[index] < costs[current])) current = index;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) {
      const path = [];
      for (let index = 1; index > 0; index = parents[index]) path.unshift(nodes[index]);
      return path;
    }
    visited.add(current);
    for (let index = 1; index < nodes.length; index += 1) {
      if (visited.has(index) || !corridorClear(nodes[current], nodes[index], obstacles, validPoint)) continue;
      const cost = costs[current] + distance(nodes[current], nodes[index]);
      if (cost < costs[index]) { costs[index] = cost; parents[index] = current; }
    }
  }
  return [];
}

class FlightNavigation {
  constructor(island) {
    this.island = island;
    this.route = null;
  }

  target(resident, destination) {
    const { body } = resident;
    const { time } = this.island;
    const halfWidth = resident.width * 0.41;
    const halfHeight = resident.height * 0.41;
    const validPoint = point => point.x > 60 && point.x < this.island.width - 60 && point.y > 125 && point.y < this.island.floorAt(point.x) - halfHeight - 1;
    const bodies = this.island.props.filter(prop => (prop.depth || 0) <= 18).map(prop => prop.body);
    const movable = new Set(this.island.props.filter(prop => !prop.anchor && !prop.ropes).map(prop => prop.body.id));
    bodies.push(...(this.island.tree.body.parts.length > 1 ? this.island.tree.body.parts.slice(1) : [this.island.tree.body]));
    if (this.island.dock) bodies.push(this.island.dock);
    const obstacles = bodies.map(obstacle => ({ movable: movable.has(obstacle.id), min: { x: obstacle.bounds.min.x - halfWidth - 4, y: obstacle.bounds.min.y - halfHeight - 4 },
      max: { x: obstacle.bounds.max.x + halfWidth + 4, y: obstacle.bounds.max.y + halfHeight + 4 } }));
    if (this.island.blob.depth <= 18) {
      const particles = this.island.blob.particles;
      obstacles.push({ movable: true, min: { x: Math.min(...particles.map(particle => particle.bounds.min.x)) - halfWidth - 4, y: Math.min(...particles.map(particle => particle.bounds.min.y)) - halfHeight - 4 },
        max: { x: Math.max(...particles.map(particle => particle.bounds.max.x)) + halfWidth + 4, y: Math.max(...particles.map(particle => particle.bounds.max.y)) + halfHeight + 4 } });
    }
    const open = point => validPoint(point) && !obstacles.some(bounds => inside(point, bounds));
    const arrivals = [{ ...destination }, { x: destination.x, y: destination.y - 20 }, { x: destination.x, y: destination.y - 34 },
      { x: destination.x - 28, y: destination.y - 16 }, { x: destination.x + 28, y: destination.y - 16 }];
    const goal = arrivals.find(open) || { x: destination.x, y: Math.min(destination.y, this.island.layout.ground - 150) };
    let route = this.route;
    while (route?.points.length > 1 && distance(body.position, route.points[0]) < 8 && open(body.position)) route.points.shift();
    const needsRoute = !route || distance(route.destination, destination) > 70 || time > route.checkAt &&
      (!corridorClear(body.position, route.points[0] || goal, obstacles, validPoint) || time - route.progressAt > 2000 && distance(body.position, route.position) < 8);
    if (needsRoute) {
      const cruise = Math.abs(goal.x - body.position.x) > 110 ? { x: goal.x, y: Math.min(goal.y, this.island.layout.ground - 150) } : goal;
      const plan = barriers => {
        const outward = planFlightPath(body.position, cruise, barriers, validPoint);
        if (!outward.length || distance(cruise, goal) <= 1) return outward;
        const arrival = planFlightPath(cruise, goal, barriers, validPoint);
        return arrival.length ? [...outward, ...arrival] : [];
      };
      let points = plan(obstacles);
      resident.flightClearing = !points.length;
      if (!points.length) points = plan(obstacles.filter(bounds => !bounds.movable));
      if (!points.length) points = [{ ...body.position }];
      route = { destination: { ...destination }, points, checkAt: time + 650, progressAt: time, position: { ...body.position } };
      this.route = route;
    } else if (distance(body.position, route.position) > 20) { route.position = { ...body.position }; route.progressAt = time; }
    const target = route.points[0] || goal;
    if (route.points.length === 1 && distance(body.position, target) < 12 && distance(target, goal) > 12) {
      this.route = null;
    }
    resident.flightRoute = route.points.map(point => ({ ...point }));
    return target;
  }
}

module.exports = { FlightNavigation, planFlightPath, corridorClear };