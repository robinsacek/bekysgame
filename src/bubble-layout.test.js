const test = require('node:test');
const assert = require('node:assert/strict');
const { layoutBubbles } = require('./bubble-layout.js');

test('nearby thought bubbles stay inside the viewport, clear the HUD and avoid each other', () => {
  for (const width of [460, 1295]) {
    const residents = [8, 28, width / 2, width / 2 + 22, width - 8].map((positionX, index) => ({ id: `resident-${index}`, species: index === 2 ? 'rabbit' : 'fish', x: positionX, y: 465 + index * 13, width: 40, height: 32, thought: 'heart', thoughtUntil: 2000, ewwUntil: index === 1 ? 2000 : 0 }));
    const bubbles = layoutBubbles(residents, 1000, { left: 0, right: width, top: 220, bottom: 840, pixelScale: 1.3 });
    assert.ok(bubbles.length >= 4, 'Spacing must retain the observable reactions, not hide them all');
    for (const [index, bubble] of bubbles.entries()) {
      assert.ok(bubble.left >= 0 && bubble.right <= width && bubble.top >= 220 && bubble.bottom <= 840);
      for (const other of bubbles.slice(index + 1)) assert.ok(bubble.right <= other.left || bubble.left >= other.right || bubble.bottom <= other.top || bubble.top >= other.bottom, 'No two drawn bubbles may overlap');
    }
    assert.ok(bubbles.some(bubble => bubble.kind === 'ewww'), 'Comic captions need the same layout protections');
    assert.deepEqual(layoutBubbles(residents, 3000, { left: 0, right: width, top: 220, bottom: 840 }), [], 'Expired thoughts must disappear');
  }
});