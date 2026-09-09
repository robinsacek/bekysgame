const TAU = Math.PI * 2;

export function drawMapObject(art, context, prop) {
  const { paint, mix, oval, colors } = art;
  const { radius, width, height, kind } = prop;
  if (kind === 'log' || kind === 'driftwood') {
    const timber = kind === 'driftwood' ? mix(colors.wood, colors.paper, 0.42) : mix(colors.wood, colors.ink, 0.10);
    const grain = context.createLinearGradient(0, -height / 2, 0, height / 2);
    grain.addColorStop(0, paint(mix(timber, colors.paper, 0.23))); grain.addColorStop(0.55, paint(timber)); grain.addColorStop(1, paint(mix(timber, colors.ink, 0.23)));
    context.fillStyle = grain; context.beginPath(); context.moveTo(-width / 2, -height * 0.35);
    context.bezierCurveTo(-width * 0.2, -height * 0.64, width * 0.24, -height * 0.25, width / 2, -height * 0.45);
    context.lineTo(width / 2, height * 0.38); context.quadraticCurveTo(0, height * 0.6, -width / 2, height * 0.35); context.closePath(); context.fill();
    oval(context, -width / 2, 0, 4, height * 0.42, paint(mix(timber, colors.paper, 0.26)));
    oval(context, width / 2, 0, 4, height * 0.42, paint(mix(timber, colors.paper, 0.40)));
    context.lineWidth = 0.8;
    for (let line = 0; line < 6; line += 1) {
      const positionY = -height * 0.28 + line * height * 0.1;
      context.strokeStyle = paint(line % 2 ? colors.paper : colors.ink, 0.19); context.beginPath(); context.moveTo(-width * 0.43, positionY);
      context.bezierCurveTo(-20, positionY - 3, 22, positionY + 3, width * 0.44, positionY + Math.sin(line) * 2); context.stroke();
    }
    context.strokeStyle = paint(colors.ink, 0.23); context.beginPath(); context.ellipse(-width / 2, 0, 2.2, height * 0.27, 0, 0, TAU); context.stroke();
    return;
  }
  if (kind === 'pumice') {
    const stone = context.createRadialGradient(-radius * 0.3, -radius * 0.3, 1, 0, 0, radius);
    stone.addColorStop(0, paint(mix(colors.paper, colors.wood, 0.17))); stone.addColorStop(1, paint(mix(colors.paper, colors.ink, 0.39)));
    oval(context, 0, 0, radius, radius * 0.93, stone);
    for (let pore = 0; pore < 22; pore += 1) {
      const angle = pore * 2.4;
      const distance = Math.sqrt((pore + 1) / 23) * radius * 0.80;
      oval(context, Math.cos(angle) * distance, Math.sin(angle) * distance * 0.9, 1.1 + pore % 3 * 0.4, 0.8, paint(colors.ink, 0.27), angle);
    }
    return;
  }
  if (kind === 'conch') {
    const shell = context.createLinearGradient(-radius, -radius, radius, radius);
    shell.addColorStop(0, paint(colors.paper)); shell.addColorStop(1, paint(mix(colors.pink, colors.yellow, 0.55)));
    context.fillStyle = shell; context.beginPath(); context.moveTo(-radius, radius * 0.1);
    context.bezierCurveTo(-radius * 0.7, -radius * 0.85, radius * 0.25, -radius, radius * 0.60, -radius * 0.23);
    context.lineTo(radius, radius * 0.33); context.quadraticCurveTo(radius * 0.22, radius * 0.93, -radius * 0.35, radius * 0.72); context.closePath(); context.fill();
    oval(context, radius * 0.44, radius * 0.31, radius * 0.32, radius * 0.14, paint(mix(colors.wood, colors.pink, 0.35), 0.66), 0.48);
    context.strokeStyle = paint(colors.wood, 0.5); context.lineWidth = 1.2; context.beginPath();
    for (let step = 0; step < 50; step += 1) {
      const angle = step / 49 * TAU * 1.6;
      const distance = radius * 0.02 + step / 49 * radius * 0.53;
      const positionX = -radius * 0.18 + Math.cos(angle) * distance;
      const positionY = -radius * 0.1 + Math.sin(angle) * distance * 0.85;
      if (step) context.lineTo(positionX, positionY); else context.moveTo(positionX, positionY);
    }
    context.stroke(); return;
  }
  if (kind === 'buoy') {
    const buoy = context.createRadialGradient(-7, -8, 1, 0, 0, radius);
    buoy.addColorStop(0, paint(colors.paper)); buoy.addColorStop(1, paint(mix(colors.paper, colors.ink, 0.21)));
    oval(context, 0, 0, radius, radius, buoy);
    context.save(); context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.clip();
    context.fillStyle = paint(mix(colors.pink, colors.paper, 0.10)); context.fillRect(-radius, -4, radius * 2, 9); context.restore();
    context.strokeStyle = paint(colors.wood); context.lineWidth = 2; context.beginPath(); context.arc(0, -radius, 3.5, 0, TAU); context.stroke();
    oval(context, -6, -9, 4.5, 2, paint(colors.paper, 0.7), -0.5); return;
  }
  if (kind === 'seedpod') {
    oval(context, 0, 0, radius, radius * 0.82, paint(mix(colors.green, colors.wood, 0.36)), -0.2);
    context.strokeStyle = paint(colors.yellow, 0.38); context.lineWidth = 0.7;
    for (let vein = -2; vein <= 2; vein += 1) { context.beginPath(); context.moveTo(-radius * 0.75, vein * 2); context.quadraticCurveTo(0, vein * 5, radius * 0.8, vein); context.stroke(); }
    oval(context, radius * 0.76, 0, 2.5, 3, paint(colors.wood)); return;
  }
  if (kind === 'bell') {
    const glaze = context.createLinearGradient(-radius, -radius, radius, radius);
    glaze.addColorStop(0, paint(mix(colors.paper, colors.yellow, 0.22))); glaze.addColorStop(1, paint(mix(colors.wood, colors.yellow, 0.27)));
    context.fillStyle = glaze; context.beginPath(); context.moveTo(-radius * 0.75, radius * 0.48);
    context.bezierCurveTo(-radius * 0.5, 0, -radius * 0.6, -radius, 0, -radius);
    context.bezierCurveTo(radius * 0.6, -radius, radius * 0.5, 0, radius * 0.75, radius * 0.48); context.closePath(); context.fill();
    oval(context, 0, radius * 0.48, radius * 0.75, 2, paint(colors.wood)); oval(context, 0, radius * 0.70, 2.4, 2.5, paint(colors.yellow));
    context.strokeStyle = paint(colors.paper, 0.48); context.lineWidth = 1; context.beginPath(); context.moveTo(-radius * 0.35, -radius * 0.4); context.lineTo(-radius * 0.46, radius * 0.1); context.stroke();
  }
}

export function drawMapHabitat(art, context, island) {
  if (!island.expedition) return;
  const { paint, mix, oval, colors } = art;
  const { shore, ground, farShore, farGround } = island.layout;
  if (island.map.habitat === 'mangroves') {
    for (const [positionX, size] of [[155, 1], [290, 0.7], [farShore + 70, 0.75]]) {
      const floor = island.floorAt(positionX);
      context.save(); context.translate(positionX, floor - 6); context.scale(size, size);
      context.strokeStyle = paint(mix(colors.wood, colors.leaf, 0.22)); context.lineCap = 'round'; context.lineWidth = 5;
      for (let root = -2; root <= 2; root += 1) { context.beginPath(); context.moveTo(root * 3, -65); context.bezierCurveTo(root * 12, -29, root * 18, -15, root * 24, 6); context.stroke(); }
      context.lineWidth = 9; context.beginPath(); context.moveTo(0, -52); context.quadraticCurveTo(13, -93, -1, -126); context.stroke();
      for (let branch = 0; branch < 8; branch += 1) {
        const position = (branch - 3.5) * 16;
        const height = -120 - Math.sin(branch * 0.7) * 23;
        oval(context, position, height, 29, 17, paint(mix(colors.leaf, colors.green, branch % 3 * 0.13)));
        art.leaf(context, position - 8, height - 6, 22, 7, -0.4, paint(colors.paper, 0.10));
      }
      context.restore();
    }
  } else if (island.map.habitat === 'basalt-pools') {
    const { toe, farToe, water } = island.layout;
    for (const [start, end] of [[shore - 48, toe + 55], [farToe - 45, farShore + 38]]) {
      const bank = Array.from({ length: 97 }, (_, index) => {
        const portion = index / 96;
        const positionX = start + (end - start) * portion;
        const thickness = Math.sin(portion * Math.PI) ** 0.6 * (25 + 12 * Math.sin(positionX * 0.036) ** 2 + 17 * Math.sin(positionX * 0.071) ** 2);
        return { x: positionX, y: island.floorAt(positionX), thickness };
      });
      context.save(); context.beginPath(); context.moveTo(bank[0].x, bank[0].y);
      for (const point of bank.slice(1)) context.lineTo(point.x, point.y);
      for (const point of [...bank].reverse()) context.lineTo(point.x, point.y + point.thickness);
      context.closePath();
      const stone = context.createLinearGradient(0, ground, 0, island.layout.bottom);
      stone.addColorStop(0, paint(mix(colors.ink, colors.paper, 0.63), 0.92));
      stone.addColorStop(0.4, paint(mix(colors.wood, colors.paper, 0.50), 0.75));
      stone.addColorStop(1, paint(mix(colors.ocean, colors.ink, 0.36), 0.48));
      context.fillStyle = stone; context.fill(); context.clip();
      for (let seam = 0; seam < 37; seam += 1) {
        const positionX = start + (end - start) * seam / 36;
        const floor = island.floorAt(positionX);
        const length = 10 + Math.abs(Math.sin(seam * 3.7)) * 34;
        context.strokeStyle = paint(floor > water - 18 ? colors.ocean : colors.ink, 0.25);
        context.lineWidth = 1.2 + seam % 3 * 0.65;
        context.beginPath(); context.moveTo(positionX - 6, floor - 2);
        context.lineTo(positionX + 3, floor + length * 0.3);
        context.lineTo(positionX - 5 + Math.sin(seam) * 10, floor + length * 0.58);
        context.lineTo(positionX + 8, floor + length); context.stroke();
        context.strokeStyle = paint(colors.paper, 0.27); context.lineWidth = 0.8;
        context.beginPath(); context.moveTo(positionX - 4, floor + 1);
        context.quadraticCurveTo(positionX + 6, floor + 8, positionX - 1, floor + length * 0.5); context.stroke();
      }
      for (let fleck = 0; fleck < 200; fleck += 1) {
        const fraction = (Math.sin(fleck * 12.9898 + start) * 43758.5453) % 1;
        const positionX = start + Math.abs(fraction) * (end - start);
        const floor = island.floorAt(positionX);
        oval(context, positionX, floor + 3 + Math.abs(Math.sin(fleck * 4.3)) * 48, 0.7 + fleck % 3 * 0.65, 0.5 + fleck % 2 * 0.3, paint(fleck % 3 ? colors.paper : colors.ink, 0.18));
      }
      for (let channel = 0; channel < 6; channel += 1) {
        const positionX = start + (end - start) * (0.12 + channel * 0.13);
        const breadth = 20 + channel % 3 * 12;
        const floor = island.floorAt(positionX);
        if (floor < water - 20) continue;
        context.fillStyle = paint(mix(colors.ocean, colors.paper, 0.25), 0.56);
        context.beginPath(); context.moveTo(positionX - breadth, floor - 1);
        context.bezierCurveTo(positionX - 9, floor + 3, positionX + 6, floor + 19, positionX + breadth, floor + 6);
        context.lineTo(positionX + breadth + 8, floor - 1); context.closePath(); context.fill();
      }
      context.restore();
      for (let tuft = 0; tuft < 14; tuft += 1) {
        const positionX = start + (end - start) * (tuft + 0.5) / 14;
        const floor = island.floorAt(positionX);
        for (let pebble = 0; pebble < 3; pebble += 1) {
          const offset = pebble * 5 - 5;
          oval(context, positionX + offset, floor + 4 + Math.sin(tuft + pebble) * 2, 2.5 + pebble, 1.4 + pebble * 0.25, paint(mix(colors.ink, colors.paper, 0.52 + pebble * 0.10), 0.65), tuft * 0.3);
        }
        if (floor > water - 25 && tuft % 3 === 0) for (let strand = 0; strand < 3; strand += 1) {
          context.strokeStyle = paint(colors.leaf, 0.45); context.lineWidth = 1.5; context.lineCap = 'round';
          context.beginPath(); context.moveTo(positionX + strand * 3, floor + 1);
          context.quadraticCurveTo(positionX + strand * 4 - 7, floor - 8, positionX + strand * 5 - 2, floor - 15 - strand * 3); context.stroke();
        }
      }
    }
  } else {
    for (const [positionX, breadth] of [[110, 130], [280, 100], [farShore + 175, 160]]) {
      const floor = island.floorAt(positionX);
      context.fillStyle = paint(mix(colors.sand, colors.paper, 0.17)); context.beginPath(); context.moveTo(positionX - breadth, floor);
      context.bezierCurveTo(positionX - breadth * 0.4, floor - 42, positionX + breadth * 0.1, floor - 66, positionX + breadth, floor); context.closePath(); context.fill();
      for (let tuft = 0; tuft < 5; tuft += 1) for (let blade = 0; blade < 5; blade += 1) {
        const stemX = positionX - breadth * 0.6 + tuft * breadth * 0.28;
        const stemY = floor - 10 - Math.sin((tuft + 1) * 0.55) * 22;
        context.strokeStyle = paint(mix(colors.leaf, colors.yellow, 0.43), 0.70); context.lineWidth = 1.1;
        context.beginPath(); context.moveTo(stemX, stemY); context.quadraticCurveTo(stemX + (blade - 2) * 4, stemY - 26, stemX + (blade - 2) * 8 + 10, stemY - 33 - blade * 2); context.stroke();
      }
    }
    const chimeX = island.width * 0.955;
    context.strokeStyle = paint(mix(colors.wood, colors.paper, 0.25)); context.lineWidth = 7; context.lineCap = 'round';
    context.beginPath(); context.moveTo(chimeX - 55, farGround); context.lineTo(chimeX - 50, farGround - 172); context.lineTo(chimeX + 55, farGround - 166); context.stroke();
  }
}