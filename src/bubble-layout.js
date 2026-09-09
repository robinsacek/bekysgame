const { feedingPose } = require('./creature-pose.js');

function layoutBubbles(residents, time, view) {
  const bubbles = [];
  const scale = view.pixelScale || 1;
  const visible = residents.filter(resident => resident.x >= view.left && resident.x <= view.right)
    .sort((first, second) => Number(feedingPose(second, time).heart) - Number(feedingPose(first, time).heart));
  const overlaps = (first, second) => first.left < second.right + 4 * scale && first.right > second.left - 4 * scale
    && first.top < second.bottom + 4 * scale && first.bottom > second.top - 4 * scale;
  for (const resident of visible) {
    const mealHeart = feedingPose(resident, time).heart;
    const kind = resident.ewwUntil > time ? 'ewww' : mealHeart ? 'meal-heart' : resident.thoughtUntil > time && resident.thought !== 'meal-heart' ? resident.thought : null;
    if (!kind) continue;
    const radiusX = (kind === 'ewww' ? 29 : mealHeart ? 19 : 15) * scale;
    const radiusY = (mealHeart ? 18 : 14) * scale;
    const headroom = resident.species === 'rabbit' ? resident.height * 1.25 : resident.species === 'bird' ? resident.height * 1.05 : resident.height * 0.7;
    const anchorY = resident.y - headroom;
    const offsets = [[0, -radiusY - 12 * scale], [-radiusX * 2.1, -radiusY - 12 * scale], [radiusX * 2.1, -radiusY - 12 * scale], [0, -radiusY * 3.4], [-radiusX * 2.1, -radiusY * 3.4], [radiusX * 2.1, -radiusY * 3.4],
      ...(mealHeart ? [[0, -radiusY * 5.6], [-radiusX * 2.1, -radiusY * 5.6], [radiusX * 2.1, -radiusY * 5.6], [-radiusX * 4.2, -radiusY * 3.4], [radiusX * 4.2, -radiusY * 3.4]] : [[radiusX * 2.2, headroom + 3 * scale]])];
    for (const [offsetX, offsetY] of offsets) {
      const positionX = Math.max(view.left + radiusX + 6 * scale, Math.min(view.right - radiusX - 6 * scale, resident.x + offsetX));
      const positionY = anchorY + offsetY;
      const bounds = { left: positionX - radiusX, right: positionX + radiusX, top: positionY - radiusY, bottom: positionY + radiusY };
      if (bounds.top < view.top || bounds.bottom > view.bottom || bubbles.some(bubble => overlaps(bounds, bubble))) continue;
      if (visible.some(other => overlaps(bounds, { left: other.x - other.width / 2, right: other.x + other.width / 2, top: other.y - other.height * (other.species === 'rabbit' ? 1.1 : 0.65), bottom: other.y + other.height * 0.5 }))) continue;
      bubbles.push({ ...bounds, x: positionX, y: positionY, radiusX, radiusY, anchorX: resident.x, anchorY, id: resident.id, kind,
        glyphScale: mealHeart ? 1.5 : 1, age: mealHeart ? time - resident.lastMealAt : 0,
        alpha: Math.min(1, ((kind === 'ewww' ? resident.ewwUntil : mealHeart ? resident.mealHeartUntil : resident.thoughtUntil) - time) / 180) });
      break;
    }
  }
  return bubbles;
}

module.exports = { layoutBubbles };