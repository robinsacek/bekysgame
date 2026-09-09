function projectShadow(island, { x, y, width, height, depth = 0, floating = false, aquatic = false }) {
  const surface = floating ? island.surfaceAt(x) : island.floorAt(x);
  const elevation = Math.max(0, surface - y - height * 0.42);
  const reach = floating ? 95 : aquatic ? 180 : 330;
  return { x: x + Math.min(36, elevation * 0.11), y: surface + depth + 2 + Math.min(10, elevation * 0.035),
    radiusX: Math.max(3, width * 0.42 * (1 + depth * 0.0018) * (1 - Math.min(0.65, elevation / 600))),
    radiusY: (floating ? 1.7 : 2.7) + depth * 0.013 + Math.min(4, elevation * 0.015),
    alpha: (floating ? 0.08 : 0.13) * Math.max(0, 1 - elevation / reach) };
}

module.exports = { projectShadow };