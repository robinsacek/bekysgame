const { comicPose } = require('./antics.js');

const REFERENCE_SIZES = {
  fish: [34, 20], crab: [36, 23], tortoise: [56, 37], bird: [34, 27], jellyfish: [40, 54],
  shark: [98, 38], octopus: [54, 46], lizard: [49, 24], starfish: [38, 33], rabbit: [40, 37], monkey: [48, 52], frog: [34, 30],
};
const FEEDING_RHYTHMS = {
  fish: [420, 0.48], shark: [1050, 0.72], jellyfish: [1200, 0.92], octopus: [720, 0.62],
  crab: [380, 0.45], tortoise: [820, 0.68], bird: [560, 0.52], lizard: [740, 0.50], starfish: [1100, 0.85], rabbit: [330, 0.56], monkey: [480, 0.64], frog: [610, 0.62],
};
const FACE_PRIORITY = new Set(['held', 'startled', 'fleeing', 'returning', 'stalking', 'lunging', 'foraging', 'snacking', 'visiting', 'visiting-flight', 'inspecting']);

function feedingPose(resident, time) {
  const blocked = resident.held || resident.frown || resident.recovery || FACE_PRIORITY.has(resident.state)
    || resident.ewwUntil > time || resident.tingleUntil > time || resident.anticUntil > time;
  const eating = !blocked && resident.state === 'feeding' && resident.feedingSince != null && resident.biteAt != null && time - resident.biteAt < 60;
  const [period, active] = FEEDING_RHYTHMS[resident.species] || [700, 0.6];
  const elapsed = Math.max(0, time - (resident.feedingSince ?? time));
  const cycle = elapsed % period / period;
  const envelope = eating ? Math.min(1, elapsed / 130) : 0;
  const opening = cycle < active ? Math.sin(cycle / active * Math.PI) ** 2 : 0;
  const smile = !blocked && !eating && resident.satisfiedUntil > time ? Math.min(1, (resident.satisfiedUntil - time) / 600) : 0;
  return { eating, open: opening * envelope, chew: eating ? Math.sin(elapsed / period * Math.PI * 4) * envelope : 0,
    nod: opening * envelope * (resident.species === 'bird' ? 2.4 : 0.55),
    tongue: ['lizard', 'frog'].includes(resident.species) && eating ? Math.max(0, Math.sin(Math.min(1, cycle / 0.38) * Math.PI)) * envelope : 0,
    smile, heart: smile > 0 && resident.mealHeartUntil > time };
}

function drawingSize(resident) {
  return resident.id === 'pip' ? [27, 17] : REFERENCE_SIZES[resident.species];
}

function eyeGaze(resident) {
  if (!resident.lookAt || resident.held) return { x: 0, y: 0 };
  return { x: Math.max(-1, Math.min(1, (resident.lookAt.x - resident.body.position.x) / 90)) * (resident.direction || 1),
    y: Math.max(-0.7, Math.min(0.7, (resident.lookAt.y - resident.body.position.y) / 100)) };
}

function frogJumpPose(resident, time) {
  const blocked = resident.held || resident.recovery || resident.frown || resident.state === 'feeding';
  const airborne = !blocked && !resident.grounded;
  const flipping = airborne && resident.flipAt != null && time - resident.flipAt < 850;
  const progress = flipping ? Math.max(0, Math.min(1, (time - resident.flipAt) / 600)) : 0;
  return { airborne, rotation: progress * Math.PI * 2, tuck: flipping ? Math.sin(progress * Math.PI) : 0,
    extension: airborne && !flipping ? Math.min(1, Math.abs(resident.body.velocity.y) / 3.8) : 0,
    crouch: !blocked && resident.hopPrepareUntil > time ? Math.max(0, 1 - (resident.hopPrepareUntil - time) / 150) : 0 };
}

function applyCreaturePose(context, resident, time) {
  const depth = resident.depth || 0;
  const [width, height] = drawingSize(resident);
  const depthScale = 1 + depth * 0.0018;
  context.translate(resident.body.position.x, resident.body.position.y + depth);
  context.scale(depthScale * resident.width / width, depthScale * resident.height / height);
  if (resident.recovery && resident.grounded) context.rotate(Math.sin((resident.motionPhase || 0) + resident.phase) * 0.13);
  const smooth = ['bird', 'shark'].includes(resident.species);
  if (smooth) context.rotate((resident.bank || 0) * (resident.facing < 0 ? -1 : 1));
  const facing = resident.facing ?? resident.direction;
  context.scale(Math.sign(facing || 1) * Math.max(0.26, Math.abs(facing)), 1);
  const feeding = feedingPose(resident, time);
  if (feeding.eating) { context.translate(feeding.chew * 0.25, feeding.nod); context.rotate(feeding.nod * 0.008); }
  if (!resident.held && (resident.anticUntil > time || resident.fidgetUntil > time)) {
    const moment = resident.anticUntil > time;
    const start = moment ? resident.anticStart ?? resident.anticUntil - 2500 : resident.fidgetStart;
    const duration = moment ? 2500 : resident.fidgetUntil - start;
    const pose = comicPose(moment ? resident.antic : resident.fidget, Math.max(0, (time - start) / duration), moment ? resident.anticIntensity || 1 : 0.4);
    context.translate(0, pose.lift); context.rotate(pose.rotation); context.scale(pose.scaleX, pose.scaleY);
  }
  if (!resident.held && ['resting', 'basking', 'grazing', 'snacking', 'hiding', 'feeding'].includes(resident.state)) {
    const breath = Math.sin(time * 0.002 + resident.phase) * 0.008;
    context.scale(1 + breath, 1 - breath);
  }
  if (resident.tingleUntil > time) context.rotate(Math.sin(time * 0.028) * 0.05);
  if (resident.species === 'frog') {
    const jump = frogJumpPose(resident, time);
    context.rotate(jump.rotation);
    context.scale(1 + jump.crouch * 0.14 + jump.tuck * 0.16 - jump.extension * 0.08,
      1 - jump.crouch * 0.22 - jump.tuck * 0.17 + jump.extension * 0.15);
  } else if (!resident.held && resident.hopPrepareUntil > time) context.scale(1.06, 0.91);
  if (!resident.held && resident.comicReactionUntil > time) context.rotate(Math.sin(time * 0.015) * (resident.comicReaction === 'startle' ? 0.07 : 0.025));
}

module.exports = { drawingSize, applyCreaturePose, eyeGaze, feedingPose, frogJumpPose };