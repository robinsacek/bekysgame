export function drawFoodPortion(art, context, portion, time) {
  const { paint, mix, oval, colors } = art;
  const food = portion.foodType;
  context.save(); context.translate(portion.body.position.x, portion.body.position.y + (portion.depth || 0)); context.rotate(portion.body.angle || 0);
  context.lineCap = 'round'; context.lineJoin = 'round';
  if (food === 'grass' || food === 'algae') {
    for (let blade = 0; blade < 5; blade += 1) {
      const offset = (blade - 2) * 4;
      const sway = Math.sin(time * 0.003 + blade) * (food === 'algae' ? 3 : 1);
      context.strokeStyle = paint(mix(colors.green, blade % 2 ? colors.leaf : colors.yellow, 0.3)); context.lineWidth = food === 'algae' ? 4 : 2.7;
      context.beginPath(); context.moveTo(offset * 0.4, 10);
      context.bezierCurveTo(offset + sway, 1, offset - sway, -6, offset + sway * 0.4, -12 - blade % 2 * 5); context.stroke();
    }
    oval(context, 0, 10, 4.5, 2, paint(mix(colors.wood, colors.paper, 0.5)));
  } else if (food === 'banana') {
    const scale = (portion.radius || 16) / 16;
    context.scale(scale, scale);
    context.fillStyle = paint(colors.yellow); context.strokeStyle = paint(mix(colors.yellow, colors.wood, 0.4)); context.lineWidth = 1.2;
    context.beginPath(); context.moveTo(-13, -11);
    context.bezierCurveTo(-10, 4, 2, 9, 15, -4);
    context.bezierCurveTo(12, 16, -9, 21, -16, -6);
    context.closePath(); context.fill(); context.stroke();
    context.strokeStyle = paint(mix(colors.yellow, colors.paper, 0.55)); context.lineWidth = 2.2;
    context.beginPath(); context.moveTo(-12, -3); context.quadraticCurveTo(-4, 14, 10, 5); context.stroke();
    context.strokeStyle = paint(colors.wood); context.lineWidth = 3;
    context.beginPath(); context.moveTo(-14, -9); context.lineTo(-15, -13); context.moveTo(14, -3); context.lineTo(16, -5); context.stroke();
  } else if (food === 'carrot') {
    context.fillStyle = paint(mix(colors.yellow, colors.pink, 0.32)); context.beginPath(); context.moveTo(-6, -6);
    context.quadraticCurveTo(0, -12, 6, -6); context.quadraticCurveTo(5, 2, 0, 14); context.quadraticCurveTo(-5, 2, -6, -6); context.fill();
    context.strokeStyle = paint(colors.wood, 0.5); context.lineWidth = 1;
    for (const offset of [-4, 1, 5]) { context.beginPath(); context.moveTo(-3, offset); context.lineTo(1, offset + 1); context.stroke(); }
    context.strokeStyle = paint(colors.green); context.lineWidth = 2.2;
    for (const offset of [-1, 0, 1]) { context.beginPath(); context.moveTo(0, -7); context.quadraticCurveTo(offset * 4, -13, offset * 6, -18); context.stroke(); }
  } else if (food === 'bait-fish') {
    const tail = Math.sin(time * 0.019) * 2;
    context.fillStyle = paint(mix(colors.blue, colors.green, 0.28)); context.beginPath(); context.moveTo(-7, 0);
    context.lineTo(-17, -7 + tail); context.lineTo(-15, 7 + tail); context.closePath(); context.fill();
    oval(context, 1, 0, 12, 6, paint(mix(colors.blue, colors.paper, 0.54)));
    context.strokeStyle = paint(colors.paper, 0.8); context.lineWidth = 1.7; context.beginPath(); context.moveTo(-7, 0); context.lineTo(8, 0); context.stroke();
    oval(context, 8, -1.5, 1.8, 2, paint(colors.ink)); oval(context, 8.5, -2, 0.5, 0.6, paint(colors.paper));
  } else if (food === 'insects') {
    for (let insect = 0; insect < 4; insect += 1) {
      const positionX = Math.cos(time * 0.004 + insect * 1.8) * 9;
      const positionY = Math.sin(time * 0.006 + insect * 1.8) * 8;
      oval(context, positionX - 2, positionY - 2, 3.8, 2, paint(colors.paper, 0.85), -0.4);
      oval(context, positionX + 2, positionY - 2, 3.8, 2, paint(colors.paper, 0.85), 0.4);
      oval(context, positionX, positionY, 1.8, 2.5, paint(colors.wood));
    }
  } else if (food === 'plankton') {
    oval(context, 0, 0, 16, 12, paint(colors.green, 0.12));
    for (let fleck = 0; fleck < 9; fleck += 1) {
      const angle = fleck * 2.4 + time * 0.001;
      oval(context, Math.cos(angle) * (5 + fleck), Math.sin(angle) * 10, 1.8, 1.5, paint(fleck % 2 ? colors.paper : colors.yellow, 0.86));
    }
  } else if (food === 'shell-bed') {
    oval(context, 0, 1, 10, 7, paint(mix(colors.wood, colors.blue, 0.4)), -0.3);
    oval(context, 0, -1, 8, 4, paint(mix(colors.pink, colors.paper, 0.52)), -0.3);
    context.strokeStyle = paint(colors.paper, 0.7); context.lineWidth = 1; context.beginPath(); context.ellipse(0, -1, 9, 5, -0.3, Math.PI, Math.PI * 2); context.stroke();
  } else {
    for (const [positionX, positionY] of [[-5, 2], [3, 3], [0, -3]]) {
      oval(context, positionX, positionY, 4.5, 3, paint(mix(colors.yellow, colors.wood, 0.3)), positionX * 0.1);
      oval(context, positionX - 1, positionY - 1, 2, 0.8, paint(colors.paper, 0.5));
    }
  }
  context.restore();
}

export function drawForagePatch(art, context, patch, time, wind = 0) {
  if (Number.isInteger(patch.treeSlot)) return;
  const { paint, mix, oval, colors } = art;
  const available = patch.readyAt <= time && !patch.portionId;
  const growth = patch.portionId ? 0 : patch.depletedAt == null ? 1 : Math.max(0, Math.min(1, (time - patch.depletedAt) / (patch.readyAt - patch.depletedAt)));
  const positionY = patch.y + patch.depth;
  const stirred = patch.touchedUntil > time ? Math.sin(time * 0.022) * 8 : wind * (4 + Math.sin(time * 0.0016 + patch.x) * 6);
  context.save(); context.translate(patch.x, positionY); context.lineCap = 'round';
  if (patch.food === 'grass' || patch.food === 'algae') {
    const grass = patch.food === 'grass';
    oval(context, 0, 2, grass ? 31 : 15, grass ? 4 : 2, paint(colors.leaf, 0.09));
    for (let blade = 0; blade < (grass ? 15 : 7); blade += 1) {
      const offset = (blade - (grass ? 7 : 3)) * (grass ? 3.6 : 3);
      const length = (grass ? 20 : 10) + (Math.sin(blade * 2.7 + patch.x) + 1) * (grass ? 10 : 6);
      context.strokeStyle = paint(mix(colors.leaf, blade % 3 ? colors.green : colors.yellow, blade % 3 ? 0.26 : 0.38), grass ? 0.72 : 0.48);
      context.lineWidth = grass ? 1.6 : 2;
      context.beginPath(); context.moveTo(offset, 0);
      context.quadraticCurveTo(offset + stirred * 0.35, -length * (0.15 + growth * 0.35), offset + stirred + Math.sin(blade) * 5, -length * (0.22 + growth * 0.78)); context.stroke();
    }
  } else if (patch.food === 'insects') {
    if (available) for (let insect = 0; insect < 3; insect += 1) {
      const positionX = Math.sin(time * 0.003 + insect * 2) * 17;
      const height = Math.cos(time * 0.004 + insect) * 8;
      oval(context, positionX - 2, height - 1, 3, 1.6, paint(colors.paper, 0.6), -0.45);
      oval(context, positionX + 2, height - 1, 3, 1.6, paint(colors.paper, 0.6), 0.45);
      oval(context, positionX, height, 1.5, 2, paint(colors.wood, 0.8));
    }
  } else if (patch.food === 'plankton') {
    if (available) for (let fleck = 0; fleck < 7; fleck += 1) {
      const angle = fleck * 2.4 + time * 0.0005;
      oval(context, Math.cos(angle) * (5 + fleck * 2), Math.sin(angle) * 9, 1.1, 1.4, paint(fleck % 2 ? colors.paper : colors.yellow, 0.35));
    }
  } else if (patch.food === 'carrot' || patch.food === 'bait-fish') {
    if (patch.food === 'carrot') oval(context, 0, 2, 16, 3, paint(colors.wood, 0.16));
    else { context.strokeStyle = paint(colors.paper, 0.25); context.lineWidth = 1; context.beginPath(); context.ellipse(0, 3, 21, 9, 0, 0, Math.PI * 2); context.stroke(); }
    if (growth > 0) {
      context.save(); context.scale(0.25 + growth * 0.75, 0.25 + growth * 0.75); context.globalAlpha = 0.3 + growth * 0.7;
      drawFoodPortion(art, context, { foodType: patch.food, body: { position: { x: 0, y: patch.food === 'carrot' ? -7 : 0 }, angle: 0 } }, time);
      context.restore();
    }
  } else {
    for (let crumb = 0; crumb < (available ? 5 : 2); crumb += 1) {
      const positionX = (crumb - 2) * 5;
      oval(context, positionX, Math.sin(crumb * 2) * 2, 2.8, 1.5, paint(mix(colors.wood, colors.paper, patch.food === 'shell-bed' ? 0.65 : 0.25), 0.65), crumb);
      if (patch.food === 'shell-bed') { context.strokeStyle = paint(colors.pink, 0.45); context.lineWidth = 0.6; context.beginPath(); context.arc(positionX, 0, 1.3, 0, Math.PI * 1.5); context.stroke(); }
    }
  }
  if (patch.food === 'plankton' && available) { context.strokeStyle = paint(colors.paper, 0.3); context.lineWidth = 1; context.beginPath(); context.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2); context.stroke(); }
  if (['insects', 'plankton'].includes(patch.food) && !available) {
    oval(context, 0, 0, 3 + growth * 8, 2 + growth * 5, paint(patch.food === 'insects' ? colors.yellow : colors.green, 0.08 + growth * 0.15));
  }
  context.restore();
}