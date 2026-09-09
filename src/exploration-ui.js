import { createElement, NotebookPen, LocateFixed, MapPin, Check, X } from 'lucide';

function icon(element, glyph) {
  element.replaceChildren(createElement(glyph, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' }));
}

export class ExplorationUI {
  constructor(current, release, announce) {
    this.current = current;
    this.release = release;
    this.announce = announce;
    this.journalKey = '';
    this.lastCompleted = 0;
    this.lastMap = '';
    icon(document.getElementById('journal-icon'), NotebookPen);
    icon(document.getElementById('find-jelly'), LocateFixed);
    icon(document.getElementById('journal-close'), X);
    document.getElementById('find-jelly').addEventListener('click', () => this.find());
    document.getElementById('journal').addEventListener('click', () => this.showJournal(document.getElementById('journal-panel').hidden));
    document.getElementById('journal-close').addEventListener('click', () => this.showJournal(false));
    const overview = document.getElementById('coast-overview');
    const seek = event => {
      const bounds = overview.getBoundingClientRect();
      const { island, camera } = this.current();
      camera.seek((event.clientX - bounds.left) / bounds.width * island.width);
    };
    overview.addEventListener('pointerdown', event => { event.preventDefault(); this.release(); seek(event); overview.setPointerCapture(event.pointerId); });
    overview.addEventListener('pointermove', event => { if (overview.hasPointerCapture(event.pointerId)) seek(event); });
    overview.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); this.release();
      const { island, camera } = this.current();
      if (event.key === 'Home') camera.seek(0); else if (event.key === 'End') camera.seek(island.width);
      else camera.pan(event.key === 'ArrowLeft' ? -camera.viewWidth * 0.35 : camera.viewWidth * 0.35);
    });
  }

  find() {
    this.release();
    const { island, camera } = this.current();
    camera.find(island.blobPosition().x);
    this.announce('Back with Blobby.');
  }

  showJournal(open) {
    document.getElementById('journal-panel').hidden = !open;
    const button = document.getElementById('journal');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close island journal' : 'Open island journal');
    if (open) this.release();
  }

  update() {
    const { island, camera, scene } = this.current();
    const objectives = island.objectives.snapshot();
    const key = `${island.map.id}:${objectives.entries.map(entry => `${entry.progress}:${entry.complete}`).join('|')}`;
    if (key !== this.journalKey) {
      this.journalKey = key;
      document.getElementById('journal-count').textContent = `${objectives.completed}/${objectives.total}`;
      document.getElementById('journal-place').textContent = island.map.name;
      const entries = document.getElementById('journal-entries');
      entries.replaceChildren();
      for (const entry of objectives.entries) {
        const row = document.createElement('li'); row.dataset.objective = entry.id; row.className = entry.complete ? 'complete' : '';
        const mark = document.createElement('span'); mark.className = 'objective-mark';
        if (entry.complete) icon(mark, Check); else mark.textContent = `${entry.progress}/${entry.goal}`;
        const text = document.createElement('span'); text.className = 'objective-text';
        const title = document.createElement('strong'); title.textContent = entry.title;
        const detail = document.createElement('span'); detail.textContent = entry.complete ? 'A little memory made' : entry.detail;
        text.append(title, detail);
        const locate = document.createElement('button'); locate.type = 'button'; locate.className = 'icon-button objective-locate';
        locate.setAttribute('aria-label', `View ${entry.target.name}`); icon(locate, MapPin);
        locate.addEventListener('click', () => { this.release(); this.current().camera.seek(entry.target.x); this.showJournal(false); });
        row.append(mark, text, locate); entries.append(row);
      }
      if (island.map.id === this.lastMap && objectives.completed > this.lastCompleted) {
        const entry = objectives.entries.filter(item => item.complete).sort((first, second) => second.completedAt - first.completedAt)[0];
        this.announce(`${entry.title} complete.`);
      }
      this.lastCompleted = objectives.completed; this.lastMap = island.map.id;
    }
    const overview = document.getElementById('coast-overview');
    const context = overview.getContext('2d');
    const { paint, mix, colors } = scene;
    const factor = overview.width / island.width;
    context.fillStyle = paint(mix(colors.ocean, colors.paper, 0.65)); context.fillRect(0, 0, overview.width, overview.height);
    context.fillStyle = paint(colors.sand); context.beginPath(); context.moveTo(0, overview.height);
    for (let positionX = 0; positionX <= island.width; positionX += 16) context.lineTo(positionX * factor, 13 + (island.floorAt(positionX) - island.layout.ground) / 6);
    context.lineTo(overview.width, overview.height); context.fill();
    for (const landmark of Object.values(island.landmarks)) scene.oval(context, landmark.x * factor, 19, 3, 3, paint(colors.wood, 0.7));
    for (const resident of island.wildlife.residents) scene.oval(context, resident.body.position.x * factor, 32, 2, 2, paint(colors.green));
    scene.oval(context, island.blobPosition().x * factor, 25, 5, 5, paint(colors.pink));
    context.strokeStyle = paint(colors.ink, 0.8); context.lineWidth = 2;
    context.strokeRect(camera.x * factor + 1, 2, Math.min(camera.viewWidth, island.width) * factor - 2, overview.height - 4);
    overview.setAttribute('aria-valuenow', String(Math.round(Math.min(island.width, camera.x + camera.viewWidth / 2))));
    overview.setAttribute('aria-valuetext', `${Math.round(camera.x / Math.max(1, camera.maximum) * 100)} percent along the coast`);
  }
}