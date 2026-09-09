import { applyCreaturePose, drawingSize, eyeGaze, feedingPose } from './creature-pose.js';
import { comicPose } from './antics.js';

const TAU = Math.PI * 2;

function polygon(context, points, color) {
  context.fillStyle = color; context.beginPath(); context.moveTo(...points[0]);
  for (const point of points.slice(1)) context.lineTo(...point);
  context.closePath(); context.fill();
}

export function drawLocalResident(art, context, resident, time) {
  if (!['lizard', 'starfish', 'rabbit'].includes(resident.species)) return false;
  const { paint, mix, oval, colors } = art;
  const { paper, ink, green, yellow, pink, wood } = colors;
  const gaze = eyeGaze(resident);
  const feeding = feedingPose(resident, time);
  const comic = resident.anticUntil > time && time - (resident.anticStart ?? resident.anticUntil - 2500) >= 350 ? resident.antic : resident.fidgetUntil > time ? resident.fidget : null;
  const motion = Math.sin(resident.motionPhase + resident.phase) * Math.min(1, Math.abs(resident.body.velocity.x) + Math.abs(resident.depthVelocity));
  context.save(); applyCreaturePose(context, resident, time);
  if (resident.species === 'starfish') {
    polygon(context, Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + index / 10 * TAU;
      const radius = index % 2 ? 9 : 24;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    }), paint(mix(yellow, pink, 0.31)));
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI / 2 + index / 5 * TAU;
      for (const radius of [9, 15]) oval(context, Math.cos(angle) * radius, Math.sin(angle) * radius, 1.5, 1.5, paint(paper, 0.4));
    }
    for (const offset of [-4, 4]) { oval(context, offset, -3, 3, 3.5, paint(paper)); oval(context, offset + 0.5 + gaze.x * 0.5, -2.5 + gaze.y, 1.4, 2, paint(ink)); }
  } else if (resident.species === 'lizard') {
    context.strokeStyle = paint(mix(green, yellow, 0.28)); context.lineWidth = 6; context.lineCap = 'round';
    context.beginPath(); context.moveTo(-16, 3); context.bezierCurveTo(-30, 0, -36, 16, -52, 5 + motion * 4); context.stroke();
    context.lineWidth = 3;
    for (const offset of [-10, 11]) { context.beginPath(); context.moveTo(offset, 3); context.lineTo(offset - 6, 12 + motion * 2); context.lineTo(offset + 2, 12); context.stroke(); }
    oval(context, -2, 0, 23, 9, paint(mix(green, yellow, 0.33))); oval(context, 20, -3, 10, 8, paint(mix(green, paper, 0.22)));
    for (let scale = 0; scale < 15; scale += 1) oval(context, -17 + scale % 5 * 7, -4 + Math.floor(scale / 5) * 3, 1.1, 0.7, paint(scale % 2 ? paper : ink, 0.14));
    for (let index = -3; index < 3; index += 1) polygon(context, [[index * 6, -6], [index * 6 + 2, -13], [index * 6 + 5, -7]], paint(mix(yellow, green, 0.2)));
    context.strokeStyle = paint(paper, 0.25); context.lineWidth = 2; context.beginPath(); context.moveTo(-19, 1); context.lineTo(15, 1); context.stroke();
    oval(context, 24, -6, 4, 4.3, paint(paper)); oval(context, 25 + gaze.x, -6 + gaze.y, 1.8, 2.6, paint(ink));
    if (comic === 'tongue-flick') {
      context.strokeStyle = paint(pink); context.lineWidth = 1.8; context.beginPath(); context.moveTo(29, 0); context.lineTo(45 + Math.abs(Math.sin(time * 0.022)) * 17, -2); context.stroke();
      oval(context, 61, -4, 2.2, 1.8, paint(ink, 0.7)); oval(context, 61, -7, 3, 2, paint(paper, 0.4));
    }
    if (feeding.tongue > 0 && resident.feedingPoint) {
      const foodX = (resident.feedingPoint.x - resident.body.position.x) * resident.direction * 49 / resident.width;
      const foodY = (resident.feedingPoint.y - resident.body.position.y) * 24 / resident.height;
      context.strokeStyle = paint(pink); context.lineWidth = 1.8; context.beginPath(); context.moveTo(29, 0);
      context.quadraticCurveTo(31 + (foodX - 29) * feeding.tongue * 0.55, 2, 29 + (foodX - 29) * feeding.tongue, foodY * feeding.tongue); context.stroke();
    }
  } else {
    const fur = mix(paper, wood, 0.10);
    oval(context, -18, 2, 7, 7, paint(paper));
    for (const offset of [-9, 8]) oval(context, offset + motion * 2, 13, 8, 4, paint(mix(fur, ink, 0.08)));
    oval(context, -1, 0, 18, 14, paint(fur)); oval(context, 13, -7, 12, 12, paint(fur));
    for (const offset of [8, 17]) {
      const earAngle = (offset === 8 ? -0.24 : 0.13) + motion * 0.08 + (comic === 'ear-flick' ? Math.sin(time * 0.021 + offset) * 0.35 : 0);
      oval(context, offset, -26, 4.5, 17, paint(fur), earAngle);
      oval(context, offset, -27, 2, 11, paint(mix(pink, paper, 0.7)), earAngle);
    }
    oval(context, 18, -9, 3.4, 4, paint(paper)); oval(context, 19 + gaze.x, -8.5 + gaze.y, 1.7, 2.5, paint(ink));
    oval(context, 25, -3, 2.6, 1.8, paint(mix(pink, paper, 0.4)));
    context.strokeStyle = paint(mix(ink, paper, 0.35), 0.55); context.lineWidth = 0.6;
    for (const offset of [-1, 1]) { context.beginPath(); context.moveTo(20, -1); context.lineTo(29, offset * 3); context.moveTo(19, 1); context.lineTo(27, 3 + offset * 2); context.stroke(); }
  }
  context.restore();
  return true;
}

function drawGagDetail(art, context, resident, time) {
  if (resident.held) return;
  const moment = resident.anticUntil > time;
  const kind = moment ? resident.antic : resident.fidgetUntil > time ? resident.fidget : null;
  if (!kind) return;
  const start = moment ? resident.anticStart : resident.fidgetStart;
  const duration = moment ? 2500 : resident.fidgetUntil - start;
  const pose = comicPose(kind, (time - start) / duration);
  if (pose.active <= 0) return;
  const { paint, mix, oval, colors } = art;
  const pulse = pose.pulse;
  context.save(); applyCreaturePose(context, resident, time);
  context.lineCap = 'round';
  if (/throat-fan|sun-salute/.test(kind)) {
    polygon(context, [[12, 1], [29, 0], [21, 4 + pulse * 20]], paint(mix(colors.yellow, colors.pink, kind === 'sun-salute' ? 0.4 : 0.22), 0.85));
  } else if (/polish|juggle/.test(kind)) {
    for (let item = 0; item < (kind === 'shell-juggle' ? 3 : 1); item += 1) {
      const phase = pose.active * Math.PI * 3 + item * 2;
      const positionX = kind === 'shell-juggle' ? Math.cos(phase) * 23 : 17;
      const positionY = kind === 'shell-juggle' ? -17 - Math.abs(Math.sin(phase)) * 27 : 5;
      oval(context, positionX, positionY, 5, 4, paint(mix(colors.pink, colors.paper, 0.65), pulse));
      context.strokeStyle = paint(colors.paper, pulse * 0.8); context.lineWidth = 1;
      context.beginPath(); context.moveTo(positionX - 7, positionY - 7); context.lineTo(positionX - 7, positionY - 13); context.moveTo(positionX - 10, positionY - 10); context.lineTo(positionX - 4, positionY - 10); context.stroke();
    }
  } else if (/arm-knot|tentacle-twist|peekaboo-wave|arm-wave/.test(kind)) {
    context.strokeStyle = paint(mix(colors.pink, colors.paper, 0.25), 0.8); context.lineWidth = 3;
    context.beginPath(); context.moveTo(-15, 8); context.bezierCurveTo(-32, 8 - pulse * 35, 32, 8 - pulse * 35, 15, 8); context.stroke();
    if (kind === 'arm-knot') { context.beginPath(); context.ellipse(0, -7, 10, 6, pose.active * 3, 0, TAU); context.stroke(); }
  } else if (/nose-twitch|toothy-grin|eyestalk-spin|sleepy-nod/.test(kind)) {
    const mouthX = resident.species === 'shark' ? 39 : resident.species === 'tortoise' ? 31 : 20;
    context.strokeStyle = paint(colors.ink, pulse * 0.7); context.lineWidth = 1.2;
    context.beginPath(); context.arc(mouthX, 2, 3 + pulse * 2, 0.2, Math.PI - 0.2); context.stroke();
    if (kind === 'eyestalk-spin') for (const eye of [9, 18]) { context.beginPath(); context.arc(eye, -8, 5, pose.active * 8, pose.active * 8 + Math.PI); context.stroke(); }
  } else if (/fin-fan|bell-flare/.test(kind)) {
    context.strokeStyle = paint(mix(colors.paper, colors.blue, 0.18), pulse * 0.85); context.lineWidth = 1.2;
    for (let ray = 0; ray < 5; ray += 1) {
      const angle = -Math.PI + ray * Math.PI / 4;
      context.beginPath(); context.moveTo(-4, 0); context.lineTo(-4 + Math.cos(angle) * (10 + pulse * 8), Math.sin(angle) * (10 + pulse * 8)); context.stroke();
    }
  } else if (/wing-settle|landing-flare/.test(kind)) {
    context.strokeStyle = paint(colors.paper, pulse * 0.75); context.lineWidth = 2;
    for (let feather = 0; feather < 3; feather += 1) {
      context.beginPath(); context.moveTo(-12, 1); context.lineTo(-25 - feather * 4, -5 - pulse * (10 + feather * 5)); context.stroke();
    }
  } else if (/sand|thump/.test(kind)) {
    for (let grain = 0; grain < 7; grain += 1) oval(context, (grain - 3) * (3 + pulse * 5), 13 - Math.sin(grain * 1.7) ** 2 * pulse * 10, 1.2, 0.8, paint(colors.wood, pulse * 0.35));
  }
  context.restore();
}

export function drawReaction(art, context, resident, time) {
  const { paint, mix, oval, colors } = art;
  drawGagDetail(art, context, resident, time);
  const comic = resident.anticUntil > time ? resident.antic : null;
  const feeding = feedingPose(resident, time);
  const face = { fish: [drawingSize(resident)[0] * 0.45, 2], jellyfish: [0, 4], shark: [39, 7], octopus: [0, 4], starfish: [0, 5], tortoise: [31, 5], crab: [15, 8], bird: [17, 0], lizard: [26, 2], rabbit: [23, 2] }[resident.species];
  context.save(); applyCreaturePose(context, resident, time);
  if (resident.species === 'shark' && (resident.snapUntil > time || comic === 'yawn' || feeding.eating)) {
    const snapping = resident.snapUntil > time;
    const progress = snapping ? 1 - (resident.snapUntil - time) / 600 : 1 - (resident.anticUntil - time) / 2500;
    const opening = feeding.eating ? feeding.open : Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
    const gape = 2 + opening * (snapping ? 8 : 6);
    const skin = mix(colors.blue, mix(colors.ink, colors.paper, 0.60), 0.76);
    context.fillStyle = paint(mix(colors.paper, skin, 0.24));
    context.beginPath(); context.moveTo(27, 5);
    context.quadraticCurveTo(37, 10 + gape, 49, 3 + gape);
    context.quadraticCurveTo(45, 14 + gape, 33, 11 + gape);
    context.quadraticCurveTo(29, 9 + gape, 27, 5); context.fill();
    const mouth = context.createLinearGradient(29, 4, 46, 12 + gape);
    mouth.addColorStop(0, paint(mix(colors.ink, colors.pink, 0.16)));
    mouth.addColorStop(1, paint(mix(colors.ink, colors.pink, 0.43)));
    context.save(); context.beginPath(); context.moveTo(29, 5);
    context.quadraticCurveTo(41, 7, 49, 1);
    context.quadraticCurveTo(48, 6 + gape, 40, 9 + gape);
    context.quadraticCurveTo(32, 10 + gape, 29, 5);
    context.fillStyle = mouth; context.fill(); context.clip();
    context.strokeStyle = paint(mix(colors.pink, colors.paper, 0.45)); context.lineWidth = 1.4;
    context.beginPath(); context.moveTo(29, 5); context.quadraticCurveTo(41, 7, 49, 1); context.stroke();
    context.beginPath(); context.moveTo(29, 5); context.quadraticCurveTo(33, 12 + gape, 46, 7 + gape); context.stroke();
    context.fillStyle = paint(mix(colors.pink, colors.paper, 0.27));
    context.beginPath(); context.moveTo(32, 9 + gape); context.quadraticCurveTo(37, 5 + gape, 42, 8 + gape); context.lineTo(41, 12 + gape); context.closePath(); context.fill();
    for (let index = 0; index < 5; index += 1) {
      const positionX = 32 + index * 3.2;
      const top = 5.6 - (index / 4) ** 2 * 3.2;
      const tooth = 1.2 + opening * 1.1;
      polygon(context, [[positionX - 1.1, top], [positionX + 0.5, top + tooth], [positionX + 1.2, top - 0.1]], paint(colors.paper));
      const lower = 8.5 + gape - (index / 4) ** 2 * 2.5;
      polygon(context, [[positionX - 0.9, lower], [positionX - 0.2, lower - tooth * 0.85], [positionX + 1.1, lower]], paint(mix(colors.paper, skin, 0.15)));
    }
    context.restore();
    context.strokeStyle = paint(mix(skin, colors.ink, 0.16), 0.75); context.lineWidth = 0.8;
    context.beginPath(); context.moveTo(29, 5); context.quadraticCurveTo(41, 7, 49, 1); context.stroke();
  } else if (resident.frown) {
    context.strokeStyle = paint(colors.ink, 0.85); context.lineWidth = 1.6; context.lineCap = 'round';
    context.beginPath(); context.moveTo(face[0] - 4, face[1] + 2); context.quadraticCurveTo(face[0], face[1] - 4, face[0] + 4, face[1] + 2); context.stroke();
    context.beginPath(); context.moveTo(face[0] - 7, face[1] - 12); context.lineTo(face[0] - 1, face[1] - 15); context.moveTo(face[0] + 1, face[1] - 15); context.lineTo(face[0] + 7, face[1] - 12); context.stroke();
  } else if (feeding.eating && resident.species !== 'bird') {
    const nibbling = ['rabbit', 'crab', 'fish'].includes(resident.species);
    const mouthWidth = resident.species === 'fish' ? 2.1 : resident.species === 'lizard' ? 3.8 : nibbling ? 2.8 : 3.5;
    const mouthHeight = 0.5 + feeding.open * (nibbling ? 2.6 : resident.species === 'jellyfish' ? 3.2 : 3.7);
    oval(context, face[0] + feeding.chew * (resident.species === 'rabbit' ? 0.55 : 0.15), face[1] + mouthHeight * 0.3,
      mouthWidth, mouthHeight, paint(colors.ink, 0.82));
    if (feeding.open > 0.3 && ['rabbit', 'tortoise', 'lizard', 'octopus'].includes(resident.species)) {
      oval(context, face[0] + 0.5, face[1] + mouthHeight * 0.8, mouthWidth * 0.55, mouthHeight * 0.25, paint(mix(colors.pink, colors.paper, 0.32)));
      if (resident.species === 'rabbit') { context.fillStyle = paint(colors.paper); context.fillRect(face[0] - 1.4, face[1] - mouthHeight * 0.45, 2.8, 1.8); }
    }
    if (resident.species === 'crab') {
      context.strokeStyle = paint(mix(colors.pink, colors.yellow, 0.42)); context.lineWidth = 2.7; context.lineCap = 'round';
      context.beginPath(); context.moveTo(25, 4); context.quadraticCurveTo(24, 10, 19 - feeding.open * 3, 8 - feeding.open); context.stroke();
    }
  } else if (feeding.smile) {
    const halfWidth = resident.species === 'shark' ? 6 : resident.species === 'fish' ? 2.8 : resident.species === 'rabbit' ? 3.4 : 4.5;
    context.strokeStyle = paint(colors.ink, 0.85); context.lineWidth = 1.4; context.lineCap = 'round';
    context.beginPath(); context.moveTo(face[0] - halfWidth, face[1] - 1);
    context.bezierCurveTo(face[0] - halfWidth * 0.6, face[1] + 4.8 * feeding.smile, face[0] + halfWidth * 0.65, face[1] + 4.8 * feeding.smile, face[0] + halfWidth, face[1] - 1); context.stroke();
    for (const side of [-1, 1]) oval(context, face[0] + side * (halfWidth + 1.5), face[1] - 1.5, 1.8, 1, paint(colors.pink, 0.25 * feeding.smile));
  }
  context.restore();
  if (resident.comicReactionUntil > time && !resident.held) {
    const position = { x: resident.body.position.x, y: resident.body.position.y + resident.depth - resident.height * 0.7 };
    context.strokeStyle = paint(resident.comicReaction === 'startle' ? colors.pink : colors.paper, 0.7); context.lineWidth = 1.5;
    for (const side of [-1, 1]) { context.beginPath(); context.moveTo(position.x + side * 8, position.y); context.lineTo(position.x + side * 12, position.y - 5); context.stroke(); }
  }
  if (resident.rescue) {
    const radius = Math.max(resident.width, resident.height) * 0.72;
    const point = { x: resident.body.position.x, y: resident.body.position.y + resident.depth };
    const bubble = context.createRadialGradient(point.x - radius * 0.3, point.y - radius * 0.3, radius * 0.25, point.x, point.y, radius);
    bubble.addColorStop(0, paint(colors.paper, 0)); bubble.addColorStop(0.83, paint(colors.paper, 0.015)); bubble.addColorStop(1, paint(colors.blue, 0.15));
    oval(context, point.x, point.y, radius, radius * 0.94, bubble);
    context.strokeStyle = paint(colors.paper, 0.76); context.lineWidth = 1.4; context.beginPath(); context.ellipse(point.x, point.y, radius, radius * 0.94, 0, 0, TAU); context.stroke();
    context.beginPath(); context.ellipse(point.x, point.y, radius * 0.85, radius * 0.80, 0, Math.PI * 1.15, Math.PI * 1.6); context.stroke();
  } else if (resident.wetness > 0.15 && resident.medium !== 'water' && (resident.held || resident.recovery)) {
    for (let index = 0; index < 3; index += 1) {
      const fall = (time * 0.002 + index * 0.37) % 1;
      oval(context, resident.body.position.x + Math.sin(index * 2.1) * resident.width * 0.35, resident.body.position.y + resident.depth + resident.height * 0.22 + fall * 24, 1.3, 2.3, paint(colors.blue, resident.wetness * (1 - fall) * 0.4));
    }
  }
}

export function drawComicEffects(art, context, island, time) {
  if (!island.wildlife) return;
  const { paint, oval, colors } = art;
  for (const drop of island.wildlife.comedy.droppings) {
    oval(context, drop.body.position.x, drop.body.position.y, 3.3, 4.5, paint(colors.paper, 0.9));
    oval(context, drop.body.position.x, drop.body.position.y - 1, 1.3, 1.5, paint(colors.wood, 0.4));
  }
  for (const event of [...island.wildlife.comedy.events, ...island.wildlife.interactions.effects]) {
    const age = (time - event.time - (event.character ? 350 : 0)) / 1000;
    if (age < 0 || age > 4.3) continue;
    if (event.kind === 'tingle') {
      context.strokeStyle = paint(colors.yellow, Math.max(0, 1 - age)); context.lineWidth = 1.7;
      for (let ray = 0; ray < 6; ray += 1) {
        const angle = ray / 6 * TAU;
        context.beginPath(); context.moveTo(event.x + Math.cos(angle) * (12 + age * 12), event.y + Math.sin(angle) * (12 + age * 12));
        context.lineTo(event.x + Math.cos(angle) * (20 + age * 20), event.y + Math.sin(angle) * (20 + age * 20)); context.stroke();
      }
    } else if (event.kind === 'splat') {
      for (let index = 0; index < 4; index += 1) oval(context, event.x + index * 3 - 5, event.y + Math.sin(index) * 2, 4, 1.4, paint(colors.paper, Math.max(0, 0.8 - age * 0.18)));
    } else if (/bubble|ring|pearls/.test(event.kind)) {
      context.strokeStyle = paint(colors.paper, Math.max(0, 0.6 - age * 0.15)); context.lineWidth = 1.3;
      context.beginPath(); context.ellipse(event.x, event.y - age * 22, (9 + age * 8) * (event.escalation || 1), 4 + age * 3, 0, 0, event.kind === 'broken-ring' ? Math.PI * 1.4 : TAU); context.stroke();
      if (event.kind === 'pearl-bubbles') for (let bubble = 0; bubble < 3; bubble += 1) oval(context, event.x + (bubble - 1) * 9, event.y - age * (14 + bubble * 9), 2, 3, paint(colors.paper, Math.max(0, 0.35 - age * 0.08)));
    } else if (event.kind === 'ink-puff') oval(context, event.x - age * 8, event.y + 7, 12 + age * 11, 10 + age * 7, paint(colors.ink, Math.max(0, 0.2 - age * 0.05)));
    else if (event.kind === 'sneeze') {
      for (let index = 0; index < 6; index += 1) oval(context, event.x + age * (15 + index * 8), event.y - 8 + age * (index - 3) * 8, 1.5, 1.5, paint(colors.paper, Math.max(0, 0.7 - age * 0.3)));
    }
  }
}