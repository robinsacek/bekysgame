const PROP_SOUNDS = {
  crate: 'wood', raft: 'wood', log: 'wood', driftwood: 'wood', coconut: 'wood', seesaw: 'wood', buoy: 'wood',
  bottle: 'glass', shell: 'shell', conch: 'shell', stone: 'shell', pumice: 'shell',
  seedpod: 'rustle', swing: 'rustle', tree: 'rustle', bell: 'chime', ball: 'bounce', jelly: 'bounce',
};

function propSound(kind, body, behavior = 'grab', speed = 2) {
  const sound = PROP_SOUNDS[kind] || (behavior === 'impact' ? 'wood' : 'grab');
  return { kind: sound, material: kind === 'stone' || kind === 'pumice' ? kind : sound, sourceKind: kind,
    mass: Number.isFinite(body?.mass) ? body.mass : 1, speed, behavior };
}

function residentSound(resident, behavior = resident.state) {
  return { characterId: resident.id, species: resident.species,
    size: Math.sqrt((resident.width || 80) * (resident.height || 80)), behavior };
}

module.exports = { propSound, residentSound };