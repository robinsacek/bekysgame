const TAU = Math.PI * 2;

function coastPath(art, context) {
  context.beginPath(); context.moveTo(...art.coastline[0]);
  for (const point of art.coastline.slice(1)) context.lineTo(...point);
  context.lineTo(art.width, art.height); context.lineTo(0, art.height); context.closePath();
}

function rock(art, context, positionX, positionY, width, height, seed, submerged) {
  const { paint, mix, oval, colors } = art;
  const shade = mix(colors.ink, submerged ? colors.ocean : colors.paper, submerged ? 0.64 : 0.58);
  oval(context, positionX + width * 0.06, positionY + 3, width * 0.56, height * 0.14, paint(colors.ink, submerged ? 0.10 : 0.14));
  context.save(); context.translate(positionX, positionY);
  const texture = context.createLinearGradient(-width * 0.3, -height, width * 0.3, 0);
  texture.addColorStop(0, paint(mix(shade, colors.paper, 0.22))); texture.addColorStop(0.6, paint(shade)); texture.addColorStop(1, paint(mix(shade, colors.ink, 0.13)));
  context.beginPath(); context.moveTo(-width * 0.49, 0);
  context.bezierCurveTo(-width * 0.58, -height * 0.28, -width * 0.39, -height * 0.88, -width * 0.17, -height * 0.85);
  context.bezierCurveTo(width * 0.08, -height * 1.12, width * 0.22, -height * 0.8, width * 0.33, -height * 0.67);
  context.bezierCurveTo(width * 0.53, -height * 0.55, width * 0.51, -height * 0.12, width * 0.46, 0);
  context.closePath(); context.fillStyle = texture; context.fill(); context.clip();
  for (let layer = 0; layer < 5; layer += 1) {
    const offset = -height * (0.13 + layer * 0.18);
    context.strokeStyle = paint(layer % 2 ? colors.paper : colors.ink, 0.08); context.lineWidth = 1 + layer % 2;
    context.beginPath(); context.moveTo(-width * 0.55, offset);
    context.bezierCurveTo(-width * 0.2, offset - height * 0.12, width * 0.22, offset + height * 0.18, width * 0.58, offset - height * 0.1); context.stroke();
  }
  for (let speck = 0; speck < 24; speck += 1) {
    const position = Math.sin(seed * 3 + speck * 9.1);
    oval(context, position * width * 0.48, -height * (0.12 + (Math.cos(speck * 2.7 + seed) + 1) * 0.42), 0.7 + speck % 3 * 0.3, 0.55, paint(speck % 2 ? colors.paper : colors.ink, 0.12));
  }
  if (!submerged) {
    context.fillStyle = paint(mix(colors.leaf, colors.yellow, 0.12), 0.34);
    context.beginPath(); context.ellipse(-width * 0.1, -height * 0.75, width * 0.26, height * 0.14, -0.16, 0, TAU); context.fill();
  }
  context.restore();
}

function grass(art, context, positionX, positionY, size, seed, submerged) {
  const { paint, mix, oval, colors } = art;
  oval(context, positionX, positionY + 2, size * 0.40, size * 0.06, paint(colors.ink, 0.10));
  context.lineCap = 'round';
  for (let blade = 0; blade < 9; blade += 1) {
    const fan = (blade - 4) / 4;
    const length = size * (0.55 + (Math.sin(seed + blade * 2.1) + 1) * 0.25);
    context.strokeStyle = paint(mix(submerged ? colors.ocean : colors.leaf, blade % 3 ? colors.green : colors.yellow, blade % 3 ? 0.24 : 0.32), submerged ? 0.43 : 0.65);
    context.lineWidth = submerged ? 1.6 : 1.3;
    context.beginPath(); context.moveTo(positionX + fan * 3, positionY);
    context.bezierCurveTo(positionX + fan * length * 0.17, positionY - length * 0.32, positionX + fan * length * 0.4, positionY - length * 0.78, positionX + fan * length * 0.52, positionY - length); context.stroke();
  }
}

export function drawTerrainDetails(art, context, island) {
  const { paint, mix, oval, colors, width, height, random } = art;
  const { ground, shore, farShore = width, water, waterStart, waterEnd = width, bottom } = island.layout;
  const rocky = island.map.id === 'pools';
  const warm = island.map.id === 'sunset';
  context.save(); coastPath(art, context); context.clip();
  const sediment = context.createLinearGradient(0, ground, 0, height);
  sediment.addColorStop(0, paint(colors.paper, 0.06)); sediment.addColorStop(0.32, paint(mix(colors.wood, colors.sand, 0.68), 0.08)); sediment.addColorStop(1, paint(mix(colors.wood, colors.sand, 0.72), 0.23));
  context.fillStyle = sediment; context.fillRect(0, ground, width, height - ground);
  for (let contour = 0; contour < 42; contour += 1) {
    const positionX = random() * width;
    const depth = 15 + random() * (height - island.floorAt(positionX));
    const length = 30 + random() * (rocky ? 95 : 200);
    context.strokeStyle = paint(contour % 3 ? colors.wood : colors.paper, 0.06 + random() * 0.06);
    context.lineWidth = 0.8 + random() * 1.2; context.beginPath();
    for (let step = 0; step <= 12; step += 1) {
      const position = Math.min(width, positionX + length * step / 12);
      const elevation = island.floorAt(position) + depth + Math.sin(step * 0.45 + contour) * 3;
      if (step === 0) context.moveTo(position, elevation); else context.lineTo(position, elevation);
    }
    context.stroke();
  }
  for (const crossing of [waterStart, waterEnd]) {
    const damp = context.createRadialGradient(crossing, water, 1, crossing, water, 105);
    damp.addColorStop(0, paint(mix(colors.wood, colors.ocean, 0.30), 0.23)); damp.addColorStop(1, paint(colors.sand, 0));
    context.fillStyle = damp; context.fillRect(crossing - 105, water - 100, 210, 210);
  }
  for (let patch = 0; patch < 145; patch += 1) {
    const positionX = random() * width;
    const floor = island.floorAt(positionX);
    const positionY = floor + 5 + random() * Math.max(1, height - floor);
    const submerged = positionX > waterStart && positionX < waterEnd;
    const shade = submerged ? mix(colors.ocean, colors.wood, 0.25) : mix(colors.wood, colors.sand, 0.35);
    oval(context, positionX, positionY, 3 + random() * 9, 0.5 + random(), paint(shade, 0.07), random() * 0.3);
  }
  if (island.layout.seabed) {
    for (let ripple = 0; ripple < 170; ripple += 1) {
      const positionX = island.layout.toe + random() * (island.layout.farToe - island.layout.toe);
      const floor = island.floorAt(positionX);
      const positionY = floor + 2 + random() * (height - floor);
      const length = 6 + random() * 30;
      context.strokeStyle = paint(mix(colors.wood, colors.ocean, 0.4), 0.10 + random() * 0.10); context.lineWidth = 0.7;
      context.beginPath(); context.moveTo(positionX - length / 2, positionY);
      context.quadraticCurveTo(positionX, positionY - 2.5, positionX + length / 2, positionY - 0.5); context.stroke();
      context.strokeStyle = paint(colors.paper, 0.27); context.beginPath(); context.moveTo(positionX - length * 0.4, positionY + 1.4);
      context.quadraticCurveTo(positionX, positionY - 0.6, positionX + length * 0.4, positionY + 0.8); context.stroke();
      if (ripple % 6 === 0) {
        oval(context, positionX, positionY + 2, 2.5 + ripple % 3, 1.3, paint(mix(colors.pink, colors.sand, 0.72), 0.65), ripple * 0.4);
        context.strokeStyle = paint(colors.paper, 0.55); context.beginPath(); context.arc(positionX, positionY + 2, 1.3, 0.2, Math.PI); context.stroke();
      }
    }
  }
  context.restore();
  context.save();
  context.beginPath(); context.moveTo(waterStart, water);
  for (const point of art.waterBed) context.lineTo(...point);
  context.closePath(); context.clip();
  for (let cluster = 0; cluster < (rocky ? 19 : 13); cluster += 1) {
    const positionX = waterStart + 60 + random() * Math.max(1, waterEnd - waterStart - 120);
    const floor = island.floorAt(positionX);
    if (floor < water + 50) continue;
    const breadth = 28 + random() * (rocky ? 115 : 74);
    rock(art, context, positionX, floor + 8, breadth, breadth * (0.22 + random() * 0.3), cluster, true);
    grass(art, context, positionX - breadth * 0.4, floor + 2, 22 + random() * 35, cluster, true);
  }
  context.restore();
  const groves = rocky ? [80, 165, 295, farShore + 75] : warm ? [55, 150, 290, farShore + 70, farShore + 195] : [52, 140, 235, 295, farShore + 90, farShore + 175];
  for (const [index, positionX] of groves.entries()) {
    if (positionX > width - 25 || positionX > shore - 45 && positionX < farShore) continue;
    const floor = island.floorAt(positionX);
    const breadth = 22 + random() * (rocky ? 57 : 28);
    rock(art, context, positionX, floor + 4, breadth, breadth * 0.44, index, false);
    grass(art, context, positionX + breadth * 0.55, floor + 1, 18 + random() * 20, index, false);
    if (!rocky) {
      for (let leaf = 0; leaf < 4; leaf += 1) art.leaf(context, positionX - breadth * 0.4, floor, 25 + random() * 35, 6 + random() * 7, -2.8 + leaf * 0.53, paint(mix(colors.leaf, colors.green, leaf * 0.10), 0.72));
      if (!warm && index % 2 === 0) {
        for (let petal = 0; petal < 5; petal += 1) oval(context, positionX - 15 + Math.cos(petal * TAU / 5) * 3.5, floor - 22 + Math.sin(petal * TAU / 5) * 3.5, 3.3, 2.1, paint(mix(colors.pink, colors.paper, 0.24)), petal * TAU / 5);
        oval(context, positionX - 15, floor - 22, 1.8, 1.8, paint(colors.yellow));
      }
    }
  }
  for (const body of island.rocks) {
    context.save(); context.beginPath(); context.moveTo(body.vertices[0].x, body.vertices[0].y);
    for (const vertex of body.vertices.slice(1)) context.lineTo(vertex.x, vertex.y);
    context.closePath(); context.clip();
    for (let vein = 0; vein < 9; vein += 1) {
      const elevation = body.bounds.min.y + vein * 7;
      context.strokeStyle = paint(vein % 2 ? colors.paper : colors.ink, 0.12); context.lineWidth = vein % 3 ? 1 : 2;
      context.beginPath(); context.moveTo(body.bounds.min.x, elevation);
      context.bezierCurveTo(body.position.x - 15, elevation - 5, body.position.x + 9, elevation + 7, body.bounds.max.x, elevation - 3); context.stroke();
    }
    context.restore();
  }
  if (bottom > water + 200) {
    const depth = context.createLinearGradient(0, water + 35, 0, bottom);
    depth.addColorStop(0, paint(colors.blue, 0)); depth.addColorStop(1, paint(mix(colors.blue, colors.ink, 0.28), 0.07));
    context.save(); context.beginPath(); context.moveTo(waterStart, water);
    for (const point of art.waterBed) context.lineTo(...point);
    context.closePath(); context.fillStyle = depth; context.fill(); context.restore();
  }
}