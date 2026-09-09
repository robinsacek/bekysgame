function projectShadow(island, { x, y, width, height, depth = 0, floating = false, aquatic = false }) {
  const surface = floating ? island.surfaceAt(x) : island.floorAt(x);
  const elevation = Math.max(0, surface - y - height * 0.42);
  const reach = floating ? 95 : aquatic ? 180 : 330;
  const sun = island.environment?.sun;
  const extent = sun ? Math.min(65, elevation * 0.28 / Math.tan(sun.elevation)) : Math.min(36, elevation * 0.11);
  return { x: x + (sun ? -Math.cos(sun.azimuth) * extent : extent), y: surface + depth + 2 + Math.min(10, elevation * 0.035),
    radiusX: Math.max(3, width * 0.42 * (1 + depth * 0.0018) * (1 - Math.min(0.65, elevation / 600))),
    radiusY: (floating ? 1.7 : 2.7) + depth * 0.013 + Math.min(4, elevation * 0.015),
    softness: 1.2 + Math.min(0.8, elevation / 240),
    alpha: (floating ? 0.08 : 0.13) * Math.max(0, 1 - elevation / reach) };
}

module.exports = { projectShadow };