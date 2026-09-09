const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 900;
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));

class CoastCamera {
  constructor(worldWidth = WORLD_WIDTH, viewWidth = 1440) {
    this.worldWidth = worldWidth;
    this.viewWidth = viewWidth;
    this.x = 0;
    this.follow = true;
  }

  get maximum() { return Math.max(0, this.worldWidth - this.viewWidth); }

  resize(viewWidth) {
    const middle = this.x + this.viewWidth / 2;
    this.viewWidth = viewWidth;
    this.x = clamp(middle - viewWidth / 2, 0, this.maximum);
  }

  toWorld(point, bounds) {
    return { x: this.x + point.x / bounds.width * this.viewWidth, y: point.y / bounds.height * WORLD_HEIGHT };
  }

  toScreen(point, bounds) {
    return { x: (point.x - this.x) / this.viewWidth * bounds.width, y: point.y / WORLD_HEIGHT * bounds.height };
  }

  pan(distance) {
    this.follow = false;
    this.x = clamp(this.x + distance, 0, this.maximum);
  }

  seek(worldX) {
    this.follow = false;
    this.x = clamp(worldX - this.viewWidth / 2, 0, this.maximum);
  }

  find(worldX) {
    this.follow = true;
    this.x = clamp(worldX - this.viewWidth * 0.45, 0, this.maximum);
  }

  step(worldX, elapsed, grips = []) {
    const seconds = Math.min(0.05, Math.max(0, elapsed / 1000));
    if (grips.length) {
      const firstEdge = grips.some(fraction => fraction < 0.075);
      const lastEdge = grips.some(fraction => fraction > 0.925);
      if (firstEdge !== lastEdge) this.x = clamp(this.x + (lastEdge ? 1 : -1) * 540 * seconds, 0, this.maximum);
      return;
    }
    if (!this.follow) return;
    const left = this.x + this.viewWidth * 0.28;
    const right = this.x + this.viewWidth * 0.70;
    const target = worldX < left ? worldX - this.viewWidth * 0.28 : worldX > right ? worldX - this.viewWidth * 0.70 : this.x;
    this.x = clamp(this.x + (target - this.x) * (1 - Math.exp(-seconds * 7)), 0, this.maximum);
  }

  snapshot() {
    return { x: this.x, width: this.viewWidth, worldWidth: this.worldWidth, maximum: this.maximum, follow: this.follow };
  }
}

module.exports = { CoastCamera, WORLD_WIDTH, WORLD_HEIGHT };