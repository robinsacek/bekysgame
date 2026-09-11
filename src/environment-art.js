export function drawEnvironment(art, context, island, time, camera, reducedMotion) {
  const { paint, mix, oval, colors } = art;
  const environment = island.environment;
  const wind = reducedMotion ? 0 : environment.wind;
  for (const point of environment.shoreline) {
    if (point.x < camera.x - 12 || point.x > camera.x + camera.viewWidth + 12) continue;
    const floor = island.floorAt(point.x);
    if (point.wetness > 0) {
      context.fillStyle = paint(mix(colors.sand, colors.ocean, 0.45), point.wetness * 0.18);
      context.beginPath(); context.moveTo(point.x - 6, island.floorAt(point.x - 6));
      context.lineTo(point.x + 6, island.floorAt(point.x + 6));
      context.lineTo(point.x + 6, island.floorAt(point.x + 6) + 13);
      context.lineTo(point.x - 6, island.floorAt(point.x - 6) + 13); context.closePath(); context.fill();
    }
    if (point.mark > 0 && floor < island.layout.water - 8) oval(context, point.x, floor + point.depth + 3, 5, 1.2, paint(colors.wood, point.mark * 0.13));
  }
  if (island.map.habitat === 'mangroves') {
    for (const [positionX, size] of [[155, 1], [290, 0.7], [island.layout.farShore + 70, 0.75]]) {
      if (positionX < camera.x - 150 || positionX > camera.x + camera.viewWidth + 150) continue;
      for (let branch = 0; branch < 8; branch += 1) {
        const sway = wind * (6 + Math.sin(time * 0.0017 + branch) * 8);
        const positionY = island.floorAt(positionX) - 6 + (-120 - Math.sin(branch * 0.7) * 23) * size;
        const branchX = positionX + (branch - 3.5) * 16 * size;
        art.leaf(context, branchX + 10 * size, positionY - 4, (17 + sway) * size, 5 * size, -0.30 + sway * 0.014, paint(colors.leaf, 0.9));
        art.leaf(context, branchX - 15 * size, positionY - 11, 19 * size, 5 * size, -0.5 + sway * 0.018, paint(mix(colors.green, colors.paper, 0.12), 0.55));
      }
    }
  } else {
    for (let tuft = 0; tuft < 20; tuft += 1) {
      const positionX = 70 + tuft * (island.layout.shore - 110) / 20;
      if (positionX < camera.x - 50 || positionX > camera.x + camera.viewWidth + 50) continue;
      const base = island.floorAt(positionX) + 20 + tuft % 3 * 20;
      const sway = wind * (5 + Math.sin(time * 0.0016 + tuft * 1.7) * 9);
      context.strokeStyle = paint(mix(colors.leaf, colors.yellow, 0.35), 0.65); context.lineWidth = 1.3;
      for (let blade = 0; blade < 3; blade += 1) {
        context.beginPath(); context.moveTo(positionX + blade * 4, base);
        context.quadraticCurveTo(positionX + blade * 6 + sway * 0.3, base - 15, positionX + blade * 8 + sway, base - 28 - blade * 4); context.stroke();
      }
    }
  }
  for (const particle of environment.particles) {
    const age = (time - particle.time) / 1000;
    const positionX = particle.x + particle.velocityX * age + wind * age * 20;
    if (positionX < camera.x - 10 || positionX > camera.x + camera.viewWidth + 10) continue;
    oval(context, positionX, particle.y + particle.velocityY * age + age * age * 110, particle.radius, particle.radius * 0.65,
      paint(mix(colors.sand, colors.paper, 0.4), Math.max(0, 1 - age * 1000 / particle.life) * 0.55));
  }
}

export function drawLilyPads(art, context, island) {
  const { paint, mix, oval, colors } = art;
  for (const [index, pad] of island.environment.lilyPads().entries()) {
    const { radius } = pad;
    const leaf = mix(colors.green, colors.yellow, 0.12 + index % 3 * 0.08);
    context.save(); context.translate(pad.x, pad.y); context.rotate(pad.angle);
    oval(context, 0, 4, radius * 1.06, radius * 0.31, paint(colors.ocean, 0.22));
    context.strokeStyle = paint(colors.paper, 0.40); context.lineWidth = 1;
    context.beginPath(); context.ellipse(0, 3, radius + 9, radius * 0.34, 0, 0.25, Math.PI * 1.9); context.stroke();
    for (const offset of [2.5, 0]) {
      context.beginPath(); context.moveTo(0, offset);
      context.ellipse(0, offset, radius, radius * 0.31, 0, 0.28, Math.PI * 2 - 0.28);
      context.closePath(); context.fillStyle = paint(offset ? mix(leaf, colors.ink, 0.32) : leaf); context.fill();
    }
    context.strokeStyle = paint(mix(leaf, colors.ink, 0.26), 0.65); context.lineWidth = 0.8; context.stroke();
    context.strokeStyle = paint(mix(leaf, colors.paper, 0.45), 0.62); context.lineWidth = 0.8;
    for (const angle of [0.75, 1.6, 2.5, 3.3, 4.15, 5.1]) {
      context.beginPath(); context.moveTo(-2, 0);
      context.quadraticCurveTo(Math.cos(angle) * radius * 0.4, Math.sin(angle) * radius * 0.08,
        Math.cos(angle) * radius * 0.84, Math.sin(angle) * radius * 0.25); context.stroke();
    }
    oval(context, -radius * 0.38, -radius * 0.13, radius * 0.16, 1.2, paint(colors.paper, 0.32), -0.1);
    if (pad.flower) {
      const flowerX = -radius * 0.12;
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = -Math.PI + petal * Math.PI / 4;
        oval(context, flowerX + Math.cos(angle) * 6, -5 + Math.sin(angle) * 5, 3.8, 7,
          paint(mix(colors.pink, colors.paper, 0.65 + petal % 2 * 0.18)), angle + Math.PI / 2);
      }
      oval(context, flowerX, -3, 4.5, 2.8, paint(colors.yellow));
      oval(context, flowerX - 1, -4, 1.4, 1, paint(colors.paper, 0.75));
    }
    context.restore();
  }
}

export function drawSwash(art, context, island, camera) {
  for (const point of island.environment.shoreline) {
    if (point.foam < 0.03 || point.x < camera.x - 12 || point.x > camera.x + camera.viewWidth + 12) continue;
    const floor = island.floorAt(point.x);
    for (let fleck = 0; fleck < 3; fleck += 1) art.oval(context, point.x + fleck * 3 - 3, floor + 1 + Math.sin(point.x + fleck) * 2,
      1.3 + point.foam * 1.2, 0.8, art.paint(art.colors.paper, point.foam * 0.65));
  }
}

export function drawWeather(art, context, island, time, camera, reducedMotion, sky) {
  const { paint, mix, oval, colors } = art;
  const environment = island.environment;
  const wind = reducedMotion ? 0 : environment.wind;
  const clock = reducedMotion ? 0 : time;
  const horizon = island.height * (island.map.horizon - (island.expedition ? 0.09 : 0));
  if (sky) {
    if (island.map.id === 'pools') {
      for (let cloud = 0; cloud < 6; cloud += 1) {
        const positionX = (cloud * 650 + clock * 0.012 * (0.5 + wind)) % (island.width + 400) - 200 + camera.x * 0.65;
        context.save(); context.translate(positionX, 110 + cloud % 2 * 65); context.scale(2.1, 0.48);
        art.cloud(context, 0, 0, 1, 0.24); context.restore();
      }
    } else if (island.map.id === 'sunset') {
      for (let cloud = 0; cloud < 4; cloud += 1) {
        const positionX = cloud * 740 + camera.x * 0.68 + clock * 0.0015;
        context.strokeStyle = paint(mix(colors.pink, colors.yellow, 0.4), 0.11); context.lineWidth = 8; context.lineCap = 'round';
        context.beginPath(); context.moveTo(positionX, horizon - 55 - cloud % 2 * 40); context.quadraticCurveTo(positionX + 90, horizon - 67 - cloud % 2 * 40, positionX + 240, horizon - 56 - cloud % 2 * 40); context.stroke();
      }
    }
    return;
  }
  if (island.map.id === 'pools') {
    context.save(); context.beginPath(); context.moveTo(...art.coastline[0]);
    for (const point of art.coastline.slice(1)) context.lineTo(...point);
    context.lineTo(island.width, island.height); context.lineTo(0, island.height); context.closePath(); context.clip();
    const positionX = (clock * 0.025 * (0.5 + wind)) % (island.width + 750) - 500;
    const shade = context.createLinearGradient(positionX, 0, positionX + 650, 0);
    shade.addColorStop(0, paint(colors.ink, 0)); shade.addColorStop(0.4, paint(colors.ink, 0.045)); shade.addColorStop(1, paint(colors.ink, 0));
    context.fillStyle = shade; context.fillRect(positionX, 0, 650, island.height); context.restore();
  }
  for (let mote = 0; mote < 18; mote += 1) {
    const positionX = ((mote * 197.3 + clock * wind * 0.008) % island.width);
    if (positionX < camera.x - 10 || positionX > camera.x + camera.viewWidth + 10) continue;
    const floor = island.floorAt(positionX);
    const positionY = Math.min(floor, island.layout.water) - 25 - (mote * 23 % 105) + Math.sin(clock * 0.001 + mote) * 6;
    const firefly = island.map.id === 'sunset' && environment.event?.kind === 'firefly-gust';
    oval(context, positionX, positionY, firefly ? 2 : 0.8, firefly ? 2 : 0.8,
      paint(firefly ? colors.yellow : colors.paper, firefly ? 0.4 + Math.sin(clock * 0.005 + mote) * 0.3 : 0.25));
  }
  const event = environment.event;
  if (!event) return;
  const progress = Math.max(0, Math.min(1, (time - event.time) / environment.rhythm.duration));
  if (event.kind === 'seedpod-drift') {
    for (let pod = 0; pod < 6; pod += 1) {
      const positionX = island.layout.waterStart + 20 + pod * 24 + progress * 240;
      const positionY = island.surfaceAt(positionX) + Math.sin(progress * 8 + pod) * 2;
      art.leaf(context, positionX, positionY, 12, 4, Math.sin(pod + progress * 4) * 0.3, paint(mix(colors.wood, colors.leaf, 0.3), Math.sin(progress * Math.PI) * 0.8));
    }
    for (const fish of island.wildlife?.residents.filter(resident => resident.species === 'fish') || []) oval(context, fish.body.position.x - 3, fish.body.position.y - 2, fish.width * 0.3, 1.4, paint(colors.paper, Math.sin(progress * Math.PI) * 0.55));
  } else if (event.kind === 'spray-set') {
    for (let spray = 0; spray < 22; spray += 1) {
      const positionX = island.layout.waterStart + 4 + spray * 3 + progress * 24;
      const positionY = island.surfaceAt(positionX) - Math.sin(progress * Math.PI) * (8 + spray % 7 * 4);
      oval(context, positionX, positionY, 1, 1.5, paint(colors.paper, Math.sin(progress * Math.PI) * 0.4));
    }
  } else {
    context.strokeStyle = paint(mix(colors.ink, colors.blue, 0.2), Math.sin(progress * Math.PI) * 0.45); context.lineWidth = 1.2;
    for (let bird = 0; bird < 5; bird += 1) {
      const positionX = camera.x + camera.viewWidth * (1.1 - progress * 1.2) + bird * 17;
      const positionY = horizon - 20 - bird % 3 * 6;
      context.beginPath(); context.moveTo(positionX - 4, positionY - 2); context.quadraticCurveTo(positionX - 1, positionY - 4, positionX, positionY);
      context.quadraticCurveTo(positionX + 1, positionY - 4, positionX + 4, positionY - 2); context.stroke();
    }
  }
}