function setBodyDepth(body, depth) {
  const band = depth <= 18 ? 0 : 1 + Math.floor((depth - 18) / 50);
  const category = 1 << Math.min(12, band + 1);
  body.isSensor = false;
  body.collisionFilter.category = category;
  body.collisionFilter.mask = 1 | category;
}

function advanceDepth(item, maximum) {
  const target = Math.max(0, Math.min(maximum, item.depthTarget || 0));
  item.depth = Math.max(0, Math.min(maximum, (item.depth || 0) + Math.max(-5, Math.min(5, target - (item.depth || 0)))));
}

module.exports = { setBodyDepth, advanceDepth };