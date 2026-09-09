const { comicPose } = require('./antics.js');

const REFERENCE_SIZES = {
  fish: [34, 20], crab: [36, 23], tortoise: [56, 37], bird: [34, 27], jellyfish: [40, 54],
  shark: [98, 38], octopus: [54, 46], lizard: [49, 24], starfish: [38, 33], rabbit: [40, 37],
};
function drawingSize(resident) {
  return resident.id === 'pip' ? [27, 17] : REFERENCE_SIZES[resident.species];
}

function eyeGaze(resident) {
  if (!resident.lookAt || resident.held) return { x: 0, y: 0 };
  return { x: Math.max(-1, Math.min(1, (resident.lookAt.x - resident.body.position.x) / 90)) * (resident.direction || 1),
    y: Math.max(-0.7, Math.min(0.7, (resident.lookAt.y - resident.body.position.y) / 100)) };
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
  if (!resident.held && resident.hopPrepareUntil > time) context.scale(1.06, 0.91);
  if (!resident.held && resident.comicReactionUntil > time) context.rotate(Math.sin(time * 0.015) * (resident.comicReaction === 'startle' ? 0.07 : 0.025));
}

module.exports = { drawingSize, applyCreaturePose, eyeGaze };