import { layoutBubbles } from './bubble-layout.js';

const TAU = Math.PI * 2;

export function drawCreatureBubbles(art, context, island, time, camera) {
  const { paint, mix, oval, colors } = art;
  const bounds = art.canvas.getBoundingClientRect();
  const pixelScale = Math.max(0.85, island.height / bounds.height);
  const residents = island.wildlife.residents.map(resident => ({ ...resident, ...island.wildlife.position(resident),
    width: resident.width * (1 + resident.depth * 0.0018), height: resident.height * (1 + resident.depth * 0.0018) }));
  if (island.blob.ewwUntil > time) { const point = island.blobPosition(); residents.push({ id: 'blob', species: 'blob', x: point.x, y: point.y + island.blob.depth, width: 82, height: 78, ewwUntil: island.blob.ewwUntil }); }
  else if (island.blob.tingleUntil > time) { const point = island.blobPosition(); residents.push({ id: 'blob', species: 'blob', x: point.x, y: point.y + island.blob.depth, width: 82, height: 78, thought: 'tingle', thoughtUntil: island.blob.tingleUntil }); }
  const bubbles = layoutBubbles(residents, time, { left: camera.x, right: camera.x + camera.viewWidth, top: 215 * island.height / bounds.height, bottom: island.height - 55 * pixelScale, pixelScale });
  art.bubbles = bubbles;
  for (const bubble of bubbles) {
    context.save(); context.globalAlpha = bubble.alpha;
    const direction = bubble.anchorX < bubble.x ? -1 : 1;
    oval(context, bubble.x, bubble.y + 1.5 * pixelScale, bubble.radiusX + pixelScale, bubble.radiusY + pixelScale, paint(colors.ink, 0.12));
    oval(context, bubble.x, bubble.y, bubble.radiusX, bubble.radiusY, paint(colors.paper, 0.96));
    context.strokeStyle = paint(colors.ink, 0.18); context.lineWidth = 0.8 * pixelScale;
    context.beginPath(); context.ellipse(bubble.x, bubble.y, bubble.radiusX, bubble.radiusY, 0, 0, TAU); context.stroke();
    oval(context, bubble.x + direction * bubble.radiusX * 0.25, bubble.y + bubble.radiusY + 5 * pixelScale, 2.4 * pixelScale, 2 * pixelScale, paint(colors.paper, 0.9));
    context.translate(bubble.x, bubble.y); context.scale(pixelScale, pixelScale);
    context.lineWidth = 1.4; context.lineCap = 'round'; context.lineJoin = 'round';
    const kind = bubble.kind;
    if (kind === 'ewww') {
      context.font = '700 12px "Segoe UI", sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = paint(colors.ink); context.fillText('Ewww!', 0, 0.5);
    } else if (kind === 'heart' || kind === 'meal-heart') {
      const settle = kind === 'meal-heart' && !art.reducedMotion ? 1 + Math.sin(Math.min(1, bubble.age / 500) * Math.PI) * 0.08 : 1;
      context.scale(bubble.glyphScale * settle, bubble.glyphScale * settle);
      context.beginPath(); context.moveTo(0, 6); context.bezierCurveTo(-12, -1, -6, -10, 0, -4); context.bezierCurveTo(6, -10, 12, -1, 0, 6); context.fillStyle = paint(colors.pink); context.fill();
    } else if (kind === 'coconut') {
      oval(context, 0, 0, 6.2, 6.2, paint(colors.wood));
      for (const [positionX, positionY] of [[-2, -2], [2, -2], [0, 1]]) oval(context, positionX, positionY, 0.9, 1, paint(colors.ink));
    } else if (kind === 'shell') {
      oval(context, 0, 0, 7, 5.5, paint(mix(colors.pink, colors.paper, 0.4)));
      context.strokeStyle = paint(colors.pink); context.beginPath(); context.arc(0, 0, 3.5, 0, TAU * 0.8); context.stroke();
    } else if (kind === 'fish') {
      oval(context, 1.5, 0, 6, 3.5, paint(colors.blue));
      context.fillStyle = paint(colors.blue); context.beginPath(); context.moveTo(-3, 0); context.lineTo(-8, -4); context.lineTo(-8, 4); context.closePath(); context.fill();
      oval(context, 4.5, -0.5, 0.8, 0.8, paint(colors.paper));
    } else if (kind === 'alert') {
      context.strokeStyle = paint(colors.pink); context.lineWidth = 2; context.beginPath(); context.moveTo(0, -6); context.lineTo(0, 1); context.stroke(); oval(context, 0, 5, 1.3, 1.3, paint(colors.pink));
    } else if (kind === 'grass') {
      context.strokeStyle = paint(colors.green);
      for (const offset of [-5, 0, 5]) { context.beginPath(); context.moveTo(offset * 0.5, 6); context.quadraticCurveTo(offset * 0.4, 0, offset, -6); context.stroke(); }
    } else if (kind === 'insect') {
      oval(context, -4, -2, 4, 2.8, paint(colors.yellow, 0.6), -0.6); oval(context, 4, -2, 4, 2.8, paint(colors.yellow, 0.6), 0.6); oval(context, 0, 0, 2, 5, paint(colors.wood));
    } else if (kind === 'food') {
      for (const [positionX, positionY] of [[-4, 2], [3, 3], [0, -3]]) oval(context, positionX, positionY, 2.7, 2.2, paint(mix(colors.yellow, colors.wood, 0.25)));
    } else if (kind === 'tingle') {
      context.strokeStyle = paint(colors.pink); context.lineWidth = 1.7;
      for (let ray = 0; ray < 5; ray += 1) { const angle = ray / 5 * TAU; context.beginPath(); context.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 3); context.lineTo(Math.cos(angle) * 7, Math.sin(angle) * 7); context.stroke(); }
      oval(context, 0, 0, 1.4, 1.4, paint(colors.yellow));
    } else if (kind === 'home') {
      context.strokeStyle = paint(colors.green); context.beginPath(); context.moveTo(-7, 0); context.lineTo(0, -6); context.lineTo(7, 0); context.moveTo(-5, -1); context.lineTo(-5, 6); context.lineTo(5, 6); context.lineTo(5, -1); context.stroke();
    } else if (kind === 'rest') {
      oval(context, 0, 0, 6.5, 6.5, paint(mix(colors.yellow, colors.wood, 0.2))); oval(context, 3, -2, 5.5, 5.5, paint(colors.paper));
    } else {
      for (const offset of [-4, 0, 4]) oval(context, offset, 0, 1.1, 1.1, paint(colors.ink, 0.65));
    }
    context.restore();
  }
}