const test = require('node:test');
const assert = require('node:assert/strict');
const { layoutBubbles } = require('./bubble-layout.js');

test('a prominent meal heart clears a crowded depth cluster without hiding the recipient or neighbors', () => {
  const residents = [{ id: 'mango', species: 'lizard', x: 689, y: 546, width: 65, height: 32, state: 'resting', lastMealAt: 4500, mealHeartUntil: 6500, satisfiedUntil: 9500 },
    { id: 'fern', species: 'lizard', x: 694, y: 494, width: 44, height: 23, thought: 'heart', thoughtUntil: 6000 },
    { id: 'moss', species: 'tortoise', x: 738, y: 505, width: 70, height: 48, thought: 'heart', thoughtUntil: 6000 },
    { id: 'pebble', species: 'crab', x: 632, y: 515, width: 31, height: 22 }];
  for (const scale of [0.85, 1, 1.6]) {
    const view = { left: 510, right: 830, top: 220, bottom: 840, pixelScale: scale };
    const bubbles = layoutBubbles(residents, 4600, view);
    const meal = bubbles.find(bubble => bubble.id === 'mango');
    assert.equal(meal?.kind, 'meal-heart');
    assert.equal(meal.glyphScale, 1.5);
    assert.ok(meal.bottom < residents[0].y - residents[0].height * 0.65);
    for (const bubble of bubbles) {
      assert.ok(bubble.left >= view.left && bubble.right <= view.right && bubble.top >= view.top && bubble.bottom <= view.bottom);
      for (const other of bubbles.filter(other => other !== bubble)) assert.ok(bubble.right <= other.left || bubble.left >= other.right || bubble.bottom <= other.top || bubble.top >= other.bottom);
    }
  }
});

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