const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const PROFILES = {
  lagoon: { wind: 0.15, gust: 0.12, gustPeriod: 24000, elevation: 1.15, azimuth: 2.96, swell: 0.7, period: 7800, retention: 0.95 },
  pools: { wind: 0.55, gust: 0.28, gustPeriod: 8500, elevation: 0.88, azimuth: -0.25, swell: 1.65, period: 3200, retention: 0.958 },
  sunset: { wind: 0.30, gust: 0.18, gustPeriod: 18000, elevation: 0.36, azimuth: 0.42, swell: 1.15, period: 12500, retention: 0.954 },
};
const RHYTHMS = { lagoon: { kind: 'seedpod-drift', first: 24000, period: 45000, duration: 6500 },
  pools: { kind: 'spray-set', first: 18000, period: 40000, duration: 6000 },
  sunset: { kind: 'firefly-gust', first: 28000, period: 60000, duration: 9500 } };

function noise(position, seed) {
  const lower = Math.floor(position);
  const hash = value => {
    let mixed = Math.imul(value ^ seed, 1597334677);
    mixed = Math.imul(mixed ^ mixed >>> 16, 2246822507);
    return (mixed >>> 0) / 4294967296 * 2 - 1;
  };
  const fraction = position - lower;
  const blend = fraction * fraction * (3 - 2 * fraction);
  return hash(lower) * (1 - blend) + hash(lower + 1) * blend;
}

class IslandEnvironment {
  constructor(island) {
    this.island = island;
    this.profile = PROFILES[island.map.id];
    this.seed = [...island.map.id].reduce((total, character) => Math.imul(total, 31) + character.charCodeAt(0) | 0, 317);
    this.sun = { elevation: this.profile.elevation, azimuth: this.profile.azimuth };
    this.wind = this.profile.wind;
    this.energy = 0;
    this.particles = [];
    this.serial = 0;
    this.rhythm = RHYTHMS[island.map.id];
    this.eventCycle = -1;
    this.event = null;
    this.eventCounts = {};
    this.ambienceAt = 9000;
    this.shoreline = Array.from({ length: Math.ceil(island.width / 12) + 1 }, (_, index) => ({ x: Math.min(island.width, index * 12), wetness: 0, foam: 0, mark: 0, depth: 0 }));
    this.step(0);
  }

  step(delta) {
    const { time } = this.island;
    const phase = time / this.profile.gustPeriod;
    this.wind = this.windOverride ?? clamp(this.profile.wind + this.profile.gust * (noise(phase, this.seed) * 0.7 + noise(phase * 2.3, this.seed + 17) * 0.3), 0, 1);
    const cycle = !this.island.expedition || time < this.rhythm.first ? -1 : Math.floor((time - this.rhythm.first) / this.rhythm.period);
    if (cycle > this.eventCycle) {
      this.eventCycle = cycle;
      this.event = { kind: this.rhythm.kind, time, until: time + this.rhythm.duration, cycle };
      this.eventCounts[this.event.kind] = (this.eventCounts[this.event.kind] || 0) + 1;
      const positionX = this.island.layout.waterStart + 40;
      this.island.queueSound(this.island.map.id === 'pools' ? 'spray' : this.island.map.id === 'sunset' ? 'chime' : 'rustle', 1.2,
        this.island.map.id === 'sunset' ? this.island.width * 0.955 : positionX, { behavior: this.event.kind });
      for (const resident of this.island.wildlife?.residents || []) {
        if (resident.held || resident.recovery || ['foraging', 'snacking', 'visiting', 'visiting-flight', 'feeding', 'returning'].includes(resident.state)) continue;
        if (Math.abs(resident.body.position.x - positionX) > 230) continue;
        resident.comicReaction = this.island.map.id === 'pools' ? 'startle' : 'amused';
        resident.comicReactionUntil = time + 1800; resident.comicGeneration = 1;
        resident.lookAt = { x: positionX, y: this.island.layout.water };
      }
    }
    if (this.event?.until <= time) this.event = null;
    const eventStrength = this.event ? Math.sin((time - this.event.time) / this.rhythm.duration * Math.PI) ** 2 : 0;
    if (this.windOverride === undefined) this.wind = clamp(this.wind + eventStrength * (this.island.map.id === 'sunset' ? 0.3 : 0.12), 0, 1);
    if (this.island.expedition && time >= this.ambienceAt) {
      this.ambienceAt = time + 14000 + (noise(cycle + time / 10000, this.seed) + 1) * 6000;
      this.island.queueSound(`ambience-${this.island.map.id}`, 0.7, this.island.layout.shore * 0.65, { behavior: 'ambience' });
    }
    this.particles = this.particles.filter(particle => time - particle.time < particle.life);
    for (const point of this.shoreline) point.mark = Math.max(0, point.mark - delta / 5000);
  }

  updateShoreline(delta) {
    const island = this.island;
    this.energy = clamp(Math.sqrt(island.waves.reduce((total, wave) => total + wave.offset ** 2 + wave.velocity ** 2 * 8, 0) / island.waves.length) / 8, 0, 1);
    for (const point of this.shoreline) {
      const floor = island.floorAt(point.x);
      const surface = island.surfaceAt(point.x);
      const nearWater = Math.abs(floor - island.layout.water) < 26;
      const washed = nearWater && floor >= surface - 3;
      point.wetness = washed ? 1 : Math.max(0, point.wetness - delta / 4000);
      const foam = nearWater ? clamp(1 - Math.abs(floor - surface) / 7, 0, 1) : 0;
      point.foam += (foam - point.foam) * Math.min(1, delta / (foam > point.foam ? 100 : 600));
    }
  }

  currentAt(positionX, positionY) {
    const island = this.island;
    const end = island.layout.waterEnd || island.width;
    if (positionX <= island.layout.waterStart || positionX >= end) return 0;
    const surface = island.surfaceAt(positionX);
    const depth = clamp((positionY - surface) / Math.max(1, island.floorAt(positionX) - surface), 0, 1);
    const channel = 0.7 + Math.sin((positionX - island.layout.waterStart) / (end - island.layout.waterStart) * Math.PI) * 0.3;
    return island.map.ecology.current * (1 - depth) ** 2 * channel * (0.85 + this.wind * 0.3);
  }

  lilyPads() {
    const island = this.island;
    const start = island.layout.waterStart;
    const end = island.layout.waterEnd || island.width;
    return [0.08, 0.14, 0.205, 0.48, 0.54, 0.81, 0.87, 0.925].map((portion, index) => {
      const radius = 26 + index * 7 % 18;
      const positionX = start + (end - start) * portion + Math.sin(island.time * 0.00045 + index * 1.7) * 3;
      return { id: `lily-${index}`, x: positionX, y: island.surfaceAt(positionX), radius, flower: index % 3 === 1,
        angle: Math.atan2(island.surfaceAt(positionX + radius) - island.surfaceAt(positionX - radius), radius * 2) };
    });
  }

  swellAt(index) {
    const portion = index / (this.island.waves.length - 1);
    const eventStrength = this.event?.kind === 'spray-set' ? Math.sin((this.island.time - this.event.time) / this.rhythm.duration * Math.PI) ** 2 : 0;
    const amplitude = this.swellOverride ?? this.profile.swell * (1 + eventStrength * 0.75);
    return amplitude * (0.7 + this.wind * 0.3) * Math.sin(portion * Math.PI)
      * Math.sin(this.island.time / this.profile.period * Math.PI * 2 - index * (this.island.map.id === 'pools' ? 0.44 : 0.20));
  }

  mark(positionX, depth = 0) {
    const point = this.shoreline[Math.round(clamp(positionX / 12, 0, this.shoreline.length - 1))];
    point.mark = 1; point.depth = depth;
  }

  impact(positionX, positionY, speed) {
    if (this.island.floorAt(positionX) > this.island.layout.water || speed < 3) return;
    for (let index = 0; index < Math.min(8, Math.ceil(speed)); index += 1) {
      const variation = noise(++this.serial * 1.7, this.seed);
      this.particles.push({ x: positionX, y: positionY, velocityX: variation * 65, velocityY: -20 - Math.abs(variation) * 60,
        time: this.island.time, life: 500 + Math.abs(variation) * 300, radius: 1.5 + Math.abs(variation) * 2 });
    }
    this.particles = this.particles.slice(-48);
  }

  snapshot() {
    return { wind: this.wind, energy: this.energy, sun: { ...this.sun }, particles: this.particles.length,
      lilyPads: this.lilyPads(),
      event: this.event ? { ...this.event } : null, eventCounts: { ...this.eventCounts },
      wetSamples: this.shoreline.filter(point => point.wetness > 0).length, marks: this.shoreline.filter(point => point.mark > 0).length };
  }
}

module.exports = { IslandEnvironment, PROFILES, RHYTHMS, noise };