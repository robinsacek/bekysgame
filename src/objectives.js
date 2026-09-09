const { Vector } = require('matter-js');

class CoastObjectives {
  constructor(island) {
    this.island = island;
      const picnicGuests = ['tortoise', 'bird'].map(species => island.wildlife.residents.find(resident => resident.species === species).name).join(' and ');
      this.entries = [
        { id: 'wander', title: 'Far-shore wander', detail: 'A quiet moment at the lookout', target: 'far', goal: 1, progress: 0, complete: false, dwell: 0 },
        { id: 'shells', title: 'Two shells for Pebble', detail: 'Shell corner', target: 'nook', goal: 2, progress: 0, complete: false, dwell: 0 },
        { id: 'picnic', title: 'A coconut picnic', detail: `${picnicGuests}, together`, target: 'picnic', goal: 1, progress: 0, complete: false, dwell: 0 },
        { id: 'friends', title: 'Friends beneath the waves', detail: 'Three curious reef species', target: 'reef', goal: 3, progress: 0, complete: false, dwell: 0 },
      ];
    this.shellDwell = new Map();
    this.acceptedShells = new Set();
    this.reefFriends = new Set();
    this.flourishes = [];
  }

  held(body) { return [...this.island.drags.values()].some(drag => drag.body === body); }

  isDelivered(prop, location, radius) {
    return prop.playerHandled && !this.held(prop.body) && (prop.depth || 0) < 24 && Math.abs(prop.body.position.x - location.x) < radius
      && Math.abs(prop.body.position.y - location.y) < 45 && Vector.magnitude(prop.body.velocity) < 1.5;
  }

  observeEncounter(kind, first, second) {
    if (kind !== 'blob-curiosity' || second.id !== 'blob' || !this.island.blobHandled) return;
    const entry = this.entries.find(item => item.id === 'friends');
    const resident = this.island.wildlife.residents.find(item => item.id === first.id);
    const point = this.island.blobPosition();
    if (entry.complete || !resident || this.held(resident.body) || !['fish', 'jellyfish', 'octopus', 'starfish', 'shark'].includes(resident.species)) return;
    if (point.y < this.island.layout.water + 30 || Math.hypot(point.x - resident.body.position.x, point.y - resident.body.position.y) > 180 || Vector.magnitude(this.island.blob.center.velocity) > 3) return;
    this.reefFriends.add(resident.species);
    entry.progress = Math.min(entry.goal, this.reefFriends.size);
    if (entry.progress === entry.goal) this.finish(entry);
  }

  finish(entry) {
    if (entry.complete) return;
    entry.complete = true;
    entry.progress = entry.goal;
    entry.completedAt = this.island.time;
    const target = this.island.landmarks[entry.target];
    this.flourishes.push({ id: entry.id, x: target.x, y: target.y - 35, time: this.island.time });
    this.island.queueSound('achievement', 3, target.x);
  }

  step() {
    const stepSeconds = 1 / 60;
    const { landmarks, wildlife } = this.island;
    const [wander, shells, picnic] = this.entries;
    if (!wander.complete) {
      const center = this.island.blobPosition();
      const held = [...this.island.drags.values()].some(drag => drag.kind === 'blob');
      const settled = this.island.blobHandled && !held && Math.abs(center.x - landmarks.far.x) < landmarks.far.radius
        && Math.abs(center.y - landmarks.far.y) < 65 && Vector.magnitude(this.island.blob.center.velocity) < 2;
      wander.dwell = settled ? wander.dwell + stepSeconds : 0;
      if (wander.dwell >= 1.2) this.finish(wander);
    }
    if (!shells.complete) {
      const candidates = this.island.props.filter(prop => prop.kind === 'shell');
      for (const shell of candidates) {
        const valid = this.isDelivered(shell, landmarks.nook, landmarks.nook.radius);
        this.shellDwell.set(shell.body.id, valid ? (this.shellDwell.get(shell.body.id) || 0) + stepSeconds : 0);
        if (this.shellDwell.get(shell.body.id) > 1.1) this.acceptedShells.add(shell.body.id);
      }
      shells.progress = Math.min(shells.goal, this.acceptedShells.size);
      if (shells.progress === shells.goal) this.finish(shells);
    }
    if (!picnic.complete) {
      const food = this.island.props.find(prop => prop.kind === 'coconut' && this.isDelivered(prop, landmarks.picnic, landmarks.picnic.radius));
      const tortoise = wildlife.residents.find(resident => resident.species === 'tortoise');
      const bird = wildlife.residents.find(resident => resident.species === 'bird');
      const visit = food && !this.held(tortoise.body) && !this.held(bird.body) && tortoise.depth < 12 && tortoise.state === 'snacking' && bird.state === 'visiting'
        && Math.abs(tortoise.body.position.x - landmarks.picnic.x) < 100 && Math.abs(bird.body.position.x - landmarks.picnic.x) < 100;
      picnic.dwell = visit ? picnic.dwell + stepSeconds : 0;
      if (picnic.dwell >= 1.5) this.finish(picnic);
    }
  }

  snapshot() {
    return { completed: this.entries.filter(entry => entry.complete).length, total: this.entries.length,
      entries: this.entries.map(entry => ({ id: entry.id, title: entry.title, detail: entry.detail, target: { ...this.island.landmarks[entry.target] }, goal: entry.goal,
        progress: entry.progress, complete: entry.complete, completedAt: entry.completedAt })) };
  }
}

module.exports = { CoastObjectives };