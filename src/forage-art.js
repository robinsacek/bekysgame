export function drawForagePatch(art, context, patch, time, wind = 0) {
  const { paint, mix, oval, colors } = art;
  const available = patch.readyAt <= time;
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
      context.quadraticCurveTo(offset + stirred * 0.35, -length * (available ? 0.5 : 0.25), offset + stirred + Math.sin(blade) * 5, -length * (available ? 1 : 0.55)); context.stroke();
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
  } else {
    for (let crumb = 0; crumb < (available ? 5 : 2); crumb += 1) {
      const positionX = (crumb - 2) * 5;
      oval(context, positionX, Math.sin(crumb * 2) * 2, 2.8, 1.5, paint(mix(colors.wood, colors.paper, patch.food === 'shell-bed' ? 0.65 : 0.25), 0.65), crumb);
      if (patch.food === 'shell-bed') { context.strokeStyle = paint(colors.pink, 0.45); context.lineWidth = 0.6; context.beginPath(); context.arc(positionX, 0, 1.3, 0, Math.PI * 1.5); context.stroke(); }
    }
  }
  context.restore();
}