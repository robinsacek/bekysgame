function blobbyOutline(positionX, positionY) {
  const curves = [
    [[14, 59], [5, 26], [34, 7], [57, 16]],
    [[57, 16], [88, 20], [90, 65], [74, 76]],
    [[74, 76], [59, 90], [18, 87], [14, 59]],
  ];
  const points = curves.flatMap(curve => Array.from({ length: 8 }, (_, index) => {
    const amount = index / 8;
    const remaining = 1 - amount;
    const coordinate = axis => remaining ** 3 * curve[0][axis] + 3 * remaining ** 2 * amount * curve[1][axis] + 3 * remaining * amount ** 2 * curve[2][axis] + amount ** 3 * curve[3][axis];
    return { x: coordinate(0), y: coordinate(1) };
  }));
  const center = points.reduce((total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }), { x: 0, y: 0 });
  return points.map(point => ({ x: positionX + (point.x - center.x) * 1.06, y: positionY + (point.y - center.y) * 1.06 }));
}

module.exports = { blobbyOutline };