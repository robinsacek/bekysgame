import { applyCreaturePose, drawingSize, eyeGaze } from './creature-pose.js';

const TAU = Math.PI * 2;

function shape(context, points, color) {
  context.fillStyle = color; context.beginPath(); context.moveTo(...points[0]);
  for (const point of points.slice(1)) context.lineTo(...point);
  context.closePath(); context.fill();
}

function heart(context, positionX, positionY, size, color) {
  context.save(); context.translate(positionX, positionY); context.scale(size, size);
  context.beginPath(); context.moveTo(0, 0.7);
  context.bezierCurveTo(-1.3, -0.1, -0.8, -1.2, 0, -0.55);
  context.bezierCurveTo(0.8, -1.2, 1.3, -0.1, 0, 0.7);
  context.fillStyle = color; context.fill(); context.restore();
}

export function drawCreature(art, context, resident, time) {
  const { oval, paint, mix } = art;
  const { paper, ink, blue, yellow, pink, green, wood } = art.colors;
  const { body, direction, species, state } = resident;
  const [width, height] = drawingSize(resident);
  const gaze = eyeGaze(resident);
  const moving = Math.abs(body.velocity.x) + Math.abs(body.velocity.y) + Math.abs(resident.depthVelocity) > 0.2;
  const motion = resident.antic === 'claw-dance' && resident.anticUntil > time ? Math.sin(time * 0.04) * 2.5 : moving ? Math.sin(resident.motionPhase + resident.phase) : Math.sin(time * 0.002 + resident.phase) * 0.2;
  const blink = (time + resident.phase * 630) % 6400 > 6260;
  const depth = resident.depth || 0;
  context.save(); applyCreaturePose(context, resident, time);
  if (species === 'fish') {
    const color = resident.appearance === 'silverside' ? mix(paper, blue, 0.22) : resident.appearance === 'striped-fish' ? mix(yellow, wood, 0.25)
      : resident.appearance === 'damselfish' ? mix(blue, green, 0.18) : resident.id === 'fin' ? mix(yellow, paper, 0.2) : mix(blue, paper, 0.36);
    shape(context, [[-width * 0.32, 0], [-width * 0.72, -height * 0.5 + motion * 3], [-width * 0.72, height * 0.5 + motion * 3]], paint(color));
    shape(context, [[-width * 0.1, -height * 0.2], [0, -height * 0.82], [width * 0.17, -height * 0.25]], paint(mix(color, pink, 0.12)));
    oval(context, 0, 0, width * 0.50, height * 0.48, paint(color));
    oval(context, width * 0.02, height * 0.1, width * 0.36, height * 0.25, paint(paper, 0.24));
    if (resident.appearance === 'silverside') { context.strokeStyle = paint(paper, 0.82); context.lineWidth = 1.5; context.beginPath(); context.moveTo(-width * 0.35, -1); context.lineTo(width * 0.24, -1); context.stroke(); }
    if (resident.appearance === 'spotted-fish') for (const offset of [-0.25, -0.05, 0.13]) oval(context, width * offset, -height * 0.15, 1.8, 2.1, paint(ink, 0.4));
    context.strokeStyle = paint(paper, 0.30); context.lineWidth = 0.5;
    for (let scale = 0; scale < 12; scale += 1) {
      const positionX = -width * 0.24 + scale % 4 * width * 0.105;
      const positionY = -height * 0.2 + Math.floor(scale / 4) * height * 0.2;
      context.beginPath(); context.arc(positionX, positionY, 1.6, -0.9, 0.9); context.stroke();
    }
    context.strokeStyle = paint(ink, 0.18); context.lineWidth = 1.5;
    for (let index = 0; index < 3; index += 1) {
      context.beginPath(); context.moveTo(-width * 0.22 + index * 5, -height * 0.32); context.quadraticCurveTo(-width * 0.30 + index * 5, 0, -width * 0.22 + index * 5, height * 0.32); context.stroke();
    }
    oval(context, width * 0.25, -height * 0.12, 4.2, 4.8, paint(paper));
    oval(context, width * 0.29 + gaze.x, -height * 0.10 + gaze.y, 2.2, blink ? 0.6 : 2.8, paint(ink));
    shape(context, [[-2, 1], [6, 2], [-1 + motion * 2, 9]], paint(mix(color, pink, 0.16), 0.8));
  } else if (species === 'jellyfish') {
    const pulse = resident.antic === 'hiccup' && resident.anticUntil > time ? (Math.sin(time * 0.025) + 1) / 2 : resident.pulse || 0;
    const spread = 18 + pulse * 4;
    const bellHeight = 13 + (1 - pulse) * 7;
    context.lineCap = 'round';
    for (let index = 0; index < 7; index += 1) {
      const startX = (index - 3) * spread / 4;
      const sway = Math.sin(time * 0.0027 + index * 0.7) * (5 + index % 3);
      context.strokeStyle = paint(mix(index % 2 ? pink : blue, paper, 0.57), 0.46); context.lineWidth = index % 2 ? 1.6 : 2.5;
      context.beginPath(); context.moveTo(startX, 3);
      context.bezierCurveTo(startX + sway, 13, startX - sway, 24, startX + sway * 0.6, 29 + index % 3 * 3);
      context.stroke();
    }
    const bell = context.createLinearGradient(0, -bellHeight, 0, 7);
    bell.addColorStop(0, paint(mix(pink, paper, 0.66), 0.58)); bell.addColorStop(1, paint(mix(blue, paper, 0.6), 0.24));
    context.fillStyle = bell; context.beginPath(); context.moveTo(-spread, 4);
    context.bezierCurveTo(-spread, -bellHeight - 7, spread, -bellHeight - 7, spread, 4);
    context.quadraticCurveTo(0, 13 - pulse * 3, -spread, 4); context.fill();
    context.strokeStyle = paint(paper, 0.8); context.lineWidth = 1.2; context.stroke();
    context.strokeStyle = paint(paper, 0.25); context.lineWidth = 0.8;
    for (const offset of [-0.5, 0, 0.5]) { context.beginPath(); context.moveTo(offset * 5, -bellHeight); context.quadraticCurveTo(offset * spread * 1.2, -bellHeight * 0.4, offset * spread * 1.4, 5); context.stroke(); }
    for (const offset of [-6, 6]) { oval(context, offset, -4, 2.6, 3.1, paint(paper, 0.8)); oval(context, offset + 0.3 + gaze.x * 0.6, -3.6 + gaze.y, 1.1, blink ? 0.4 : 1.7, paint(ink, 0.7)); }
  } else if (species === 'shark') {
    const skin = mix(blue, mix(ink, paper, 0.60), 0.76);
    const tail = Math.sin(resident.motionPhase * 0.7 + resident.phase) * (4 + Math.min(5, Math.abs(body.velocity.x) * 2));
    shape(context, [[-30, 1], [-62, -24 + tail], [-52, 0 + tail * 0.4], [-58, 20 + tail], [-28, 5]], paint(skin));
    shape(context, [[-11, -9], [-5, -35], [14, -9]], paint(mix(skin, ink, 0.10)));
    context.fillStyle = paint(skin); context.beginPath(); context.moveTo(-39, 0);
    context.bezierCurveTo(-19, -22, 31, -20, 50, -2); context.quadraticCurveTo(38, 16, 10, 16);
    context.quadraticCurveTo(-22, 12, -39, 0); context.fill();
    context.fillStyle = paint(mix(paper, skin, 0.18)); context.beginPath(); context.moveTo(-25, 6);
    context.quadraticCurveTo(10, 11, 47, -1); context.quadraticCurveTo(39, 16, 10, 16); context.quadraticCurveTo(-15, 11, -25, 6); context.fill();
    shape(context, [[2, 8], [-16, 26 + tail * 0.15], [22, 9]], paint(mix(skin, ink, 0.1)));
    oval(context, 32, -5, 3.5, 3.8, paint(paper)); oval(context, 33 + gaze.x, -5 + gaze.y, 1.8, blink ? 0.5 : 2.5, paint(ink));
    context.strokeStyle = paint(ink, 0.46); context.lineWidth = 1.1;
    for (let index = 0; index < 3; index += 1) { context.beginPath(); context.moveTo(12 - index * 4, -4); context.quadraticCurveTo(10 - index * 4, 1, 12 - index * 4, 5); context.stroke(); }
    if (!resident.frown && resident.snapUntil <= time && !(resident.antic === 'yawn' && resident.anticUntil > time)) { context.beginPath(); context.moveTo(34, 6); context.quadraticCurveTo(39, 8, 45, 3); context.stroke(); }
    oval(context, 1, -11, 17, 2.3, paint(paper, 0.15));
    if (resident.appearance === 'blacktip') shape(context, [[-7, -27], [-5, -35], [1, -27]], paint(ink, 0.80));
    if (resident.appearance === 'catshark') for (let spot = 0; spot < 9; spot += 1) oval(context, -22 + spot % 5 * 11, -9 + Math.floor(spot / 5) * 8, 2.1, 1.8, paint(ink, 0.28));
  } else if (species === 'octopus') {
    const hiding = resident.state === 'hiding' || resident.state === 'startled';
    const skin = resident.appearance === 'sand-octopus' ? mix(yellow, paper, hiding ? 0.56 : 0.32)
      : resident.appearance === 'rock-octopus' ? mix(pink, wood, hiding ? 0.48 : 0.27) : mix(pink, yellow, hiding ? 0.50 : 0.18);
    context.lineCap = 'round';
    for (let index = 0; index < 8; index += 1) {
      const side = (index - 3.5) / 3.5;
      const wave = Math.sin(time * 0.004 + index * 1.1) * 5;
      let endX = side * (hiding ? 22 : 36);
      let endY = 17 + Math.sin(index * 1.9) * 4;
      if (resident.reach && index === 6) {
        endX = Math.max(-58, Math.min(58, (resident.reach.x - body.position.x) * direction));
        endY = Math.max(-20, Math.min(30, resident.reach.y - body.position.y));
      }
      context.strokeStyle = paint(mix(skin, ink, index % 2 * 0.11)); context.lineWidth = 5.5;
      context.beginPath(); context.moveTo(side * 10, 5); context.bezierCurveTo(side * 17 + wave, 22, endX - side * 8, endY + 8, endX, endY); context.stroke();
      context.strokeStyle = paint(mix(skin, paper, 0.55), 0.76); context.lineWidth = 1.5;
      context.beginPath(); context.moveTo(side * 12, 11); context.quadraticCurveTo(endX - side * 9, endY + 8, endX, endY); context.stroke();
      for (let cup = 1; cup < 4; cup += 1) {
        const portion = cup / 4;
        oval(context, side * 12 * (1 - portion) + endX * portion, 11 * (1 - portion) + endY * portion + Math.sin(portion * Math.PI) * 4, 1.35, 0.8, paint(paper, 0.42));
      }
    }
    const head = context.createRadialGradient(-7, -17, 1, 0, -7, 25);
    head.addColorStop(0, paint(mix(skin, paper, 0.25))); head.addColorStop(1, paint(skin));
    oval(context, 0, -7, hiding ? 17 : 20, hiding ? 16 : 22, head);
    for (const offset of [-7, 7]) { oval(context, offset, -5, 5, 6, paint(paper)); oval(context, offset + 0.8 + gaze.x, -3.5 + gaze.y, 2.1, blink ? 0.6 : 3.2, paint(ink)); }
    if (!resident.frown) { context.strokeStyle = paint(ink, 0.65); context.lineWidth = 1.1; context.beginPath(); context.arc(0, 2, 3.5, 0.2, 2.9); context.stroke(); }
    for (const [offsetX, offsetY] of [[-10, -20], [5, -22], [12, -15]]) oval(context, offsetX, offsetY, 2.2, 1.5, paint(paper, 0.14));
  } else if (species === 'tortoise') {
    for (const offset of [-16, 12]) {
      const stride = moving ? Math.sin(resident.motionPhase + (offset < 0 ? 0 : Math.PI)) : 0;
      oval(context, offset + stride * 2, height * 0.35, 8, 5.5, paint(mix(green, yellow, 0.28)), stride * 0.1);
    }
    oval(context, 26, 1, 10, 9, paint(mix(green, yellow, 0.34)));
    oval(context, 30, -1, 3.3, 3.7, paint(paper));
    oval(context, 31 + gaze.x, -0.5 + gaze.y, 1.6, blink ? 0.5 : 2.3, paint(ink));
    oval(context, -3, -2, 25, 18, paint(mix(green, ink, 0.18)));
    oval(context, -5, -5, 22, 13, paint(mix(green, yellow, 0.24)));
    context.strokeStyle = paint(mix(green, ink, 0.40), 0.72); context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(-14, -12); context.lineTo(-3, -16); context.lineTo(8, -9); context.lineTo(7, 3); context.lineTo(-5, 8); context.lineTo(-16, 1); context.closePath(); context.stroke();
    for (const [startX, startY, endX, endY] of [[-14, -12, -21, -10], [8, -9, 15, -10], [7, 3, 18, 6], [-5, 8, -6, 14], [-16, 1, -26, 5]]) {
      context.beginPath(); context.moveTo(startX, startY); context.lineTo(endX, endY); context.stroke();
    }
    oval(context, -10, -11, 7, 2.2, paint(paper, 0.17), -0.3);
    for (const offset of [-16, 12]) for (let toe = 0; toe < 3; toe += 1) oval(context, offset + motion * 2 + toe * 3 - 3, height * 0.35 + 2.5, 0.8, 1, paint(mix(yellow, paper, 0.28), 0.7));
    context.strokeStyle = paint(ink, 0.6); context.lineWidth = 1;
    if (!resident.frown) { context.beginPath(); context.arc(31, 3, 3, 0.1, 1.8); context.stroke(); }
  } else if (species === 'crab') {
    const coral = mix(pink, yellow, 0.42);
    context.strokeStyle = paint(coral); context.lineWidth = 3; context.lineCap = 'round';
    for (let index = 0; index < 3; index += 1) {
      const offset = -11 + index * 10;
      const stride = moving ? Math.sin(resident.motionPhase + index * 2.1) : motion;
      context.beginPath(); context.moveTo(offset, 5); context.lineTo(offset - 6, 10 + stride); context.lineTo(offset - 2 + stride * 2, 13); context.stroke();
    }
    oval(context, -5, -2, 15, 13, paint(mix(pink, paper, 0.72)));
    oval(context, -10, -8, 7, 2.5, paint(paper, 0.38), -0.6);
    context.strokeStyle = paint(pink, 0.62); context.lineWidth = 1.8;
    context.beginPath();
    for (let index = 0; index < 45; index += 1) {
      const angle = index / 45 * TAU * 1.7;
      const radius = 1 + index / 45 * 9;
      const positionX = -6 + Math.cos(angle) * radius;
      const positionY = -3 + Math.sin(angle) * radius;
      if (index === 0) context.moveTo(positionX, positionY); else context.lineTo(positionX, positionY);
    }
    context.stroke();
    oval(context, 12, 4, 10, 6, paint(coral));
    for (const offset of [9, 18]) {
      context.strokeStyle = paint(coral); context.lineWidth = 2;
      context.beginPath(); context.moveTo(offset, 2); context.lineTo(offset, -8); context.stroke();
      oval(context, offset, -8, 3.5, 4, paint(paper)); oval(context, offset + 0.6 + gaze.x, -8 + gaze.y, 1.7, blink ? 0.5 : 2.3, paint(ink));
    }
    context.strokeStyle = paint(coral); context.lineWidth = 3;
    context.beginPath(); context.moveTo(17, 6); context.lineTo(26, 1 + motion * 2); context.stroke();
    oval(context, 28, -1 + motion * 2, 5, 4, paint(coral));
    shape(context, [[27, -3 + motion * 2], [34, -7 + motion * 2], [31, 0 + motion * 2]], paint(coral));
  } else {
    const flight = resident.flightBlend;
    const landing = resident.landingBlend;
    const wingMotion = resident.wingLift;
    const feathers = resident.appearance === 'kingfisher' ? mix(blue, green, 0.20) : resident.appearance === 'sandpiper' ? mix(wood, paper, 0.52) : paper;
    context.strokeStyle = paint(wood); context.lineWidth = 2; context.lineCap = 'round';
    for (const offset of [-3, 7]) {
      context.beginPath(); context.moveTo(offset, 8); context.lineTo(offset - 8 + landing * 13, 10 + landing * 8); context.lineTo(offset - 2 + landing * 13, 11 + landing * 7); context.stroke();
    }
    shape(context, [[-10, 0], [-26, -8], [-20, 5]], paint(mix(paper, ink, 0.2)));
    oval(context, -1, 1, 18, 11, paint(feathers));
    oval(context, -7, 5, 12, 5, paint(mix(paper, blue, 0.2), 0.48));
    oval(context, 12, -9, 9, 9, paint(feathers));
    const beakLength = resident.appearance === 'pelican' ? 40 : resident.appearance === 'sandpiper' ? 34 : 31;
    shape(context, [[18, -9], [beakLength, -6], [18, -3]], paint(resident.appearance === 'sandpiper' ? wood : yellow));
    if (resident.appearance === 'pelican') { context.fillStyle = paint(mix(yellow, paper, 0.42)); context.beginPath(); context.moveTo(18, -3); context.quadraticCurveTo(29, 5, beakLength, -6); context.closePath(); context.fill(); }
    if (resident.appearance === 'kingfisher') oval(context, 7, 3, 9, 6, paint(mix(yellow, pink, 0.2)));
    oval(context, 14 + gaze.x * 0.45, -10 + gaze.y * 0.5, 2.2, blink ? 0.6 : 2.4, paint(ink));
    context.fillStyle = paint(mix(feathers, blue, 0.14));
    context.beginPath(); context.moveTo(7, -3);
    context.quadraticCurveTo(-1, -7 + flight * (-12 - wingMotion * 21), -33, 8 + flight * (-25 - wingMotion * 30));
    context.quadraticCurveTo(-20, 15 + flight * (-12 - wingMotion * 12), 7, -3); context.fill();
    context.strokeStyle = paint(ink, 0.35); context.lineWidth = 1;
    for (let index = 0; index < 3; index += 1) { context.beginPath(); context.moveTo(-11 - index * 4, 2 + flight * (-10 - wingMotion * 12)); context.lineTo(-25 - index * 3, 7 + flight * (-17 - wingMotion * 26)); context.stroke(); }
  }
  context.restore();
}

export function drawHabitats(art, context, island) {
  if (!island.landmarks) return;
  const { oval, paint, mix } = art;
  const { paper, ink, pink, blue, wood, leaf, yellow } = art.colors;
  const { picnic, nook, reef, far } = island.landmarks;
  context.save();
  if (island.dock) {
    const { x: dockX, y: dockY } = island.dock.position;
    for (const offset of [-74, 72]) {
      const ground = island.floorAt(dockX + offset);
      context.fillStyle = paint(mix(wood, ink, 0.12)); context.fillRect(dockX + offset - 4, dockY - 9, 8, ground - dockY + 13);
      context.fillStyle = paint(paper, 0.16); context.fillRect(dockX + offset - 3, dockY - 8, 2, ground - dockY + 6);
    }
    context.fillStyle = paint(mix(wood, yellow, 0.28)); context.fillRect(dockX - 106, dockY - 7, 212, 14);
    context.strokeStyle = paint(ink, 0.2); context.lineWidth = 1;
    for (let offset = -102; offset < 106; offset += 13) { context.beginPath(); context.moveTo(dockX + offset, dockY - 6); context.lineTo(dockX + offset, dockY + 6); context.stroke(); }
  }
  const swing = island.props.find(prop => prop.kind === 'swing');
  if (swing) {
    const [first, second] = swing.ropeAnchors;
    context.strokeStyle = paint(wood); context.lineWidth = 8; context.lineCap = 'round';
    for (const [top, sign] of [[first, -1], [second, 1]]) { context.beginPath(); context.moveTo(top.x + sign * 22, picnic.y); context.lineTo(top.x + sign * 12, top.y - 12); context.stroke(); }
    context.beginPath(); context.moveTo(first.x - 21, first.y - 12); context.lineTo(second.x + 21, second.y - 12); context.stroke();
  }
  context.fillStyle = paint(mix(pink, paper, 0.56)); context.fillRect(picnic.x - 75, picnic.y + 2, 150, 22);
  context.strokeStyle = paint(paper, 0.7); context.lineWidth = 2;
  for (let offset = -64; offset < 75; offset += 14) { context.beginPath(); context.moveTo(picnic.x + offset, picnic.y + 3); context.lineTo(picnic.x + offset, picnic.y + 23); context.stroke(); }
  for (let offset = 5; offset < 23; offset += 7) { context.beginPath(); context.moveTo(picnic.x - 74, picnic.y + offset); context.lineTo(picnic.x + 74, picnic.y + offset); context.stroke(); }
  oval(context, picnic.x - 39, picnic.y + 10, 14, 4.5, paint(paper, 0.92));
  oval(context, picnic.x + 35, picnic.y + 10, 14, 4.5, paint(paper, 0.92));
  oval(context, nook.x, nook.y + 7, 70, 12, paint(mix(yellow, paper, 0.44), 0.7));
  for (let index = 0; index < 11; index += 1) {
    const angle = index / 10 * Math.PI;
    oval(context, nook.x + Math.cos(angle) * 66, nook.y + 7 + Math.sin(angle) * 10, 5 + index % 3, 3, paint(mix(ink, paper, 0.58)));
  }
  shape(context, [[nook.x - 73, nook.y], [nook.x - 67, nook.y - 31], [nook.x - 34, nook.y - 27], [nook.x - 20, nook.y]], paint(mix(wood, paper, 0.35)));
  oval(context, nook.x - 47, nook.y - 5, 12, 7, paint(ink, 0.5));
  for (let index = 0; index < 20; index += 1) {
    const positionX = reef.x - 180 + index * 19;
    const baseY = island.floorAt(positionX);
    const color = index % 3 === 0 ? pink : index % 3 === 1 ? yellow : leaf;
    context.strokeStyle = paint(mix(color, paper, 0.15), 0.60); context.lineWidth = 3 + index % 3; context.lineCap = 'round';
    context.beginPath(); context.moveTo(positionX, baseY); context.quadraticCurveTo(positionX - 12, baseY - 21, positionX + 3, baseY - 28 - index % 4 * 8); context.stroke();
    context.beginPath(); context.moveTo(positionX - 2, baseY - 15); context.lineTo(positionX - 12, baseY - 27); context.stroke();
  }
  const denX = reef.x + 68;
  const denY = island.floorAt(denX);
  oval(context, denX, denY + 2, 65, 9, paint(ink, 0.13));
  const stoneColor = mix(blue, mix(ink, paper, 0.46), 0.70);
  oval(context, denX, denY - 8, 49, 30, paint(stoneColor, 0.46));
  oval(context, denX + 3, denY - 4, 28, 20, paint(ink, 0.22));
  oval(context, denX - 19, denY - 29, 21, 3, paint(paper, 0.19), -0.2);
  for (let index = 0; index < 48; index += 1) {
    const positionX = island.layout.toe + 15 + index / 47 * (island.layout.farToe - island.layout.toe - 25);
    const baseY = island.floorAt(positionX);
    const length = 15 + Math.abs(Math.sin(index * 4.21)) * 35;
    if (index % 4 === 0) {
      oval(context, positionX, baseY - 5, 8 + index % 6, 7, paint(mix(pink, yellow, 0.3), 0.35));
      oval(context, positionX + 6, baseY - 14, 4, 10, paint(mix(pink, paper, 0.3), 0.32));
    } else art.leaf(context, positionX, baseY, length, 4 + index % 3, -1.5 + Math.sin(index) * 0.6, paint(mix(leaf, blue, 0.28), 0.4));
    context.strokeStyle = paint(paper, 0.08); context.lineWidth = 1;
    context.beginPath(); context.ellipse(positionX, baseY + 4, 22, 2.5, 0, Math.PI, TAU); context.stroke();
  }
  for (const positionX of [80, 135, island.width - 28, island.width - 80]) {
    const ground = island.floorAt(positionX);
    for (let index = 0; index < 7; index += 1) art.leaf(context, positionX, ground, 43 + index % 3 * 14, 14, -2.9 + index * 0.42, paint(mix(leaf, yellow, index % 2 * 0.16)));
  }
  context.strokeStyle = paint(wood); context.lineWidth = 5;
  context.beginPath(); context.moveTo(far.x + 24, far.y); context.lineTo(far.x + 24, far.y - 93); context.stroke();
  shape(context, [[far.x + 26, far.y - 91], [far.x + 73, far.y - 77], [far.x + 26, far.y - 62]], paint(mix(pink, paper, 0.25)));
  for (let index = 0; index < 3; index += 1) oval(context, far.x - 12, far.y - 4 - index * 9, 17 - index * 4, 6, paint(mix(ink, paper, 0.64 + index * 0.05)));
  const positions = [picnic, nook, far];
  context.textAlign = 'center'; context.font = '600 12px "Segoe UI", sans-serif'; context.fillStyle = paint(ink, 0.64);
  let previousRight = -Infinity;
  for (const landmark of positions) {
    const halfWidth = context.measureText(landmark.name).width / 2;
    const stagger = landmark.x - halfWidth < previousRight + 12;
    context.fillText(landmark.name, landmark.x, landmark.y + (stagger ? 67 : 48));
    previousRight = landmark.x + halfWidth;
  }
  for (const edge of [0, island.width]) {
    const ground = island.floorAt(edge);
    const inward = edge === 0 ? 1 : -1;
    shape(context, [[edge, ground - 94], [edge + inward * 32, ground - 58], [edge + inward * 54, ground + 10], [edge, ground + 45]], paint(mix(ink, paper, 0.5)));
  }
  if (island.map.id === 'pools') {
    for (let index = 0; index < 30; index += 1) {
      const positionX = 110 + index / 29 * (island.layout.shore - 160);
      const positionY = island.layout.ground + 35 + Math.abs(Math.sin(index * 2.4)) * 105;
      oval(context, positionX, positionY, 9 + index % 4 * 3, 4 + index % 3, paint(mix(ink, paper, 0.63), 0.65), Math.sin(index) * 0.3);
      oval(context, positionX - 2, positionY - 2, 5, 1.3, paint(paper, 0.34));
    }
  } else if (island.map.id === 'sunset') {
    context.strokeStyle = paint(wood, 0.065); context.lineWidth = 1.5;
    for (let index = 0; index < 16; index += 1) {
      const positionX = 100 + index * 58;
      const positionY = island.layout.ground + 72 + index % 3 * 25;
      context.beginPath(); context.moveTo(positionX, positionY); context.bezierCurveTo(positionX + 35, positionY - 10, positionX + 68, positionY + 12, positionX + 112, positionY); context.stroke();
    }
  } else {
    for (let index = 0; index < 10; index += 1) {
      const positionX = 120 + index * 76;
      if (Math.abs(positionX - picnic.x) < 80 || Math.abs(positionX - nook.x) < 70) continue;
      art.leaf(context, positionX, island.layout.ground + 85, 26, 7, -2.5 + index % 3 * 0.4, paint(leaf, 0.16));
    }
  }
  context.restore();
}

export function drawObjectiveEffects(art, context, island, time) {
  if (!island.objectives) return;
  const { paint, oval } = art;
  for (const entry of island.objectives.entries) {
    const target = island.landmarks[entry.target];
    if (entry.complete) {
      context.strokeStyle = paint(art.colors.green, 0.8); context.lineWidth = 2.2; context.lineCap = 'round';
      context.beginPath(); context.moveTo(target.x - 7, target.y - 37); context.lineTo(target.x - 1, target.y - 31); context.lineTo(target.x + 9, target.y - 43); context.stroke();
    } else {
      const progress = entry.id === 'shells' ? entry.progress : 0;
      for (let index = 0; index < entry.goal; index += 1) oval(context, target.x + (index - (entry.goal - 1) / 2) * 12, target.y - 35, 3, 3, paint(index < progress ? art.colors.green : art.colors.paper, 0.85));
    }
  }
  for (const flourish of island.objectives.flourishes) {
    const age = (time - flourish.time) / 1000;
    if (age < 0 || age > 2) continue;
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * TAU;
      const positionX = flourish.x + Math.cos(angle) * age * 49;
      const positionY = flourish.y + Math.sin(angle) * age * 31 - age * 32;
      const alpha = 1 - age / 2;
      if (island.map.id === 'lagoon') art.leaf(context, positionX, positionY, 7, 2.5, angle + age, paint(art.rainbow[index % 7], alpha));
      else if (island.map.id === 'pools') {
        context.strokeStyle = paint(art.rainbow[index % 7], alpha); context.lineWidth = 1.4;
        context.beginPath(); context.arc(positionX, positionY, 2.8 + age, 0, TAU); context.stroke();
      } else {
        context.strokeStyle = paint(index % 2 ? art.colors.yellow : art.colors.paper, alpha); context.lineWidth = 1.8;
        context.beginPath(); context.moveTo(positionX - 3, positionY); context.lineTo(positionX + 3, positionY);
        context.moveTo(positionX, positionY - 3); context.lineTo(positionX, positionY + 3); context.stroke();
      }
    }
  }
}