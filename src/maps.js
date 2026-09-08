const MAPS = [
  {
    id: 'lagoon', name: 'Little Lagoon', caption: 'THE QUIET COAST', temperature: 28, horizon: 0.405, warmth: 0,
    ground: 0.70, water: 0.725, bottom: 0.935, shore: 0.40, toe: 0.62, palmHeight: 325, palmLean: 93,
    toys: [
      { kind: 'ball', x: 0.60, elevation: 48, radius: 26, mass: 0.48, density: 0.20 },
      { kind: 'raft', x: 0.79, elevation: 23, width: 122, height: 20, mass: 2.6, density: 0.42 },
      { kind: 'coconut', x: 0.94, elevation: 58, radius: 19, mass: 0.75, density: 0.73 },
      { kind: 'bottle', x: 0.51, elevation: 77, width: 18, height: 43, mass: 0.30, density: 0.46 },
      { kind: 'ring', x: 0.70, elevation: 100, radius: 36, mass: 0.52, density: 0.24 },
      { kind: 'crate', x: 0.22, elevation: 78, width: 35, height: 35, mass: 1.2, density: 0.56, onLand: true },
    ],
    rocks: [],
  },
  {
    id: 'pools', name: 'Tide Pools', caption: 'THE ROCKY SHALLOWS', temperature: 26, horizon: 0.37, warmth: 0.04,
    ground: 0.69, water: 0.755, bottom: 0.925, shore: 0.36, toe: 0.63, palmHeight: 285, palmLean: 65,
    toys: [
      { kind: 'ball', x: 0.45, elevation: 95, radius: 24, mass: 0.45, density: 0.22 },
      { kind: 'crate', x: 0.82, elevation: 75, width: 39, height: 39, mass: 1.3, density: 0.56 },
      { kind: 'shell', x: 0.49, elevation: 50, radius: 22, mass: 1.1, density: 1.7 },
      { kind: 'shell', x: 0.70, elevation: 100, radius: 17, mass: 0.8, density: 1.5 },
      { kind: 'raft', x: 0.91, elevation: 34, width: 95, height: 18, mass: 2.1, density: 0.46 },
      { kind: 'coconut', x: 0.95, elevation: 90, radius: 19, mass: 0.75, density: 0.73 },
      { kind: 'bottle', x: 0.28, elevation: 65, width: 18, height: 43, mass: 0.3, density: 0.46, onLand: true },
    ],
    rocks: [{ x: 0.60, width: 60, height: 36, elevation: -34 }, { x: 0.78, width: 74, height: 62, elevation: -31 }],
  },
  {
    id: 'sunset', name: 'Sunset Cove', caption: 'THE GOLDEN HOUR', temperature: 27, horizon: 0.43, warmth: 0.30,
    ground: 0.70, water: 0.74, bottom: 0.93, shore: 0.44, toe: 0.69, palmHeight: 350, palmLean: 78,
    toys: [
      { kind: 'seesaw', x: 0.31, elevation: 27, width: 125, height: 13, mass: 2.9, density: 0.65, onLand: true, hinged: true },
      { kind: 'ball', x: 0.61, elevation: 85, radius: 29, mass: 0.45, density: 0.18 },
      { kind: 'ring', x: 0.87, elevation: 90, radius: 38, mass: 0.5, density: 0.24 },
      { kind: 'crate', x: 0.20, elevation: 74, width: 32, height: 32, mass: 1.1, density: 0.58, onLand: true },
      { kind: 'coconut', x: 0.74, elevation: 72, radius: 18, mass: 0.7, density: 0.74 },
      { kind: 'bottle', x: 0.54, elevation: 67, width: 18, height: 43, mass: 0.3, density: 0.46 },
      { kind: 'raft', x: 0.97, elevation: 32, width: 80, height: 18, mass: 1.8, density: 0.45 },
    ],
    rocks: [],
  },
];

module.exports = { MAPS };