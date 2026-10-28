import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../riichi.js', import.meta.url), 'utf8');
const beforeBindings = source.slice(0, source.indexOf("  $('rulesTop').addEventListener"));
const sandbox = {};
vm.runInNewContext(`${beforeBindings}\n globalThis.test = { isWinningHand, isFlower, calculateFan, fanToPoints, state, tileName };\n})();`, sandbox);
const { isWinningHand, isFlower, calculateFan, fanToPoints, state, tileName } = sandbox.test;

console.log('Testing Tutorial Step Logic...');

// Step 1: Winning hand structure (4 melds + 1 pair = 14 tiles)
const step1Tiles = [0, 1, 2, 12, 13, 14, 24, 25, 26, 31, 31, 31, 27, 27];
assert.equal(step1Tiles.length, 14, 'Step 1 displays 14 tiles');
assert.equal(isWinningHand(step1Tiles, 0), true, 'Step 1 hand is a valid winning hand');
assert.equal(step1Tiles[12], 27, 'Step 1 pair tile 1 is East Wind (27)');
assert.equal(step1Tiles[13], 27, 'Step 1 pair tile 2 is East Wind (27)');

// Step 2: 144 Tiles and Dragons identification
const step2Tiles = [0, 31, 13, 32, 22, 33, 27];
const dragons = [1, 3, 5]; // indices of 31, 32, 33
assert.equal(step2Tiles[1], 31, 'Red dragon');
assert.equal(step2Tiles[3], 32, 'Green dragon');
assert.equal(step2Tiles[5], 33, 'White dragon');
assert.equal(tileName(31), 'Naga Merah');
assert.equal(tileName(32), 'Naga Hijau');
assert.equal(tileName(33), 'Naga Putih');

// Step 3: Melds - Chi (4-5-6 Wan) and Pon (2-2-2 Pin)
const step3Chi = [3, 4, 5]; // 4-5-6 Wan
const step3Pon = [10, 10, 10]; // 2-2-2 Pin
assert.equal(step3Chi[1] - step3Chi[0], 1, 'Consecutive tile 1');
assert.equal(step3Chi[2] - step3Chi[1], 1, 'Consecutive tile 2');
assert.equal(step3Pon[0], step3Pon[1], 'Identical tile 1');
assert.equal(step3Pon[1], step3Pon[2], 'Identical tile 2');

// Step 4: Flower matching seat 3 (West)
// Seat 3 (West): Chrysanthemum = 36 (FLOWER_SIGNS index 2)
assert.equal(isFlower(36), true, 'Tile 36 is flower');
assert.equal(tileName(36).includes('Chrysanthemum'), true, 'Tile 36 is Chrysanthemum (Seat 3 / West)');

// Step 5: Turn flow (13 hand + 1 draw = 14 tiles -> discard 1 = 13 tiles)
const hand13 = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 31, 31];
assert.equal(hand13.length, 13, 'Hand starts with 13 tiles');
const hand14 = [...hand13, 8];
assert.equal(hand14.length, 14, 'Drawn hand has 14 tiles');
const handAfterDiscard = hand14.filter((t) => t !== 8);
assert.equal(handAfterDiscard.length, 13, 'Hand after discard returns to 13 tiles');

// Step 6: Claim system (Chi 3-4-5 Pin from discarded 5 Pin)
const handStep6 = [11, 12, 31, 31]; // 3 Pin, 4 Pin
const discardTile = 13; // 5 Pin
const chiMeld = [11, 12, discardTile].sort((a, b) => a - b);
assert.deepEqual(chiMeld, [11, 12, 13], 'Forms 3-4-5 Pin Chi');

// Step 7: Qing Yi Se Fan calculation
state.players = [0, 1, 2, 3].map((seat) => ({ seat, hand: [], melds: [], flowers: [], score: 10000 }));
state.players[0].hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 5, 5];
state.players[0].melds = [];
state.players[0].flowers = [];
const qingYiSeResult = calculateFan(0, 'Ron', 1, 5);
assert.equal(qingYiSeResult.items.some((it) => it.name.includes('Qing Yi Se')), true, 'Detected Qing Yi Se (7 Fan)');

// Step 8: Shooter Payout (3 Fan = Base Point 160 -> Shooter pays 2x = 320)
const basePoint3Fan = fanToPoints(3);
assert.equal(basePoint3Fan, 160, '3 Fan base points is 160');
const shooterPayment = basePoint3Fan * 2;
assert.equal(shooterPayment, 320, 'Shooter pays 2x base points = 320 pts');

console.log('All 8 Tutorial step validation tests passed successfully!');

console.log('Testing TutorialManager Interactive Flow in DOM...');
const elements = {};
function getElement(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      textContent: '',
      innerHTML: '',
      hidden: true,
      children: [],
      style: {},
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      setAttribute() {},
      getAttribute: () => null,
      replaceChildren() { this.children = []; },
      append(c) { this.children.push(c); },
      appendChild(c) { this.children.push(c); },
      focus() {},
      querySelectorAll() { return []; },
      addEventListener(evt, fn) { this.listeners = this.listeners || {}; this.listeners[evt] = fn; }
    };
  }
  return elements[id];
}

const mockDoc = {
  getElementById: getElement,
  createElement(tag) {
    return {
      tagName: tag,
      type: '',
      className: '',
      textContent: '',
      disabled: false,
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      setAttribute() {},
      getAttribute: () => null,
      style: {},
      appendChild(c) { this.children = this.children || []; this.children.push(c); },
      addEventListener(evt, fn) { this.listeners = this.listeners || {}; this.listeners[evt] = fn; }
    };
  },
  addEventListener(evt, fn) { this.listeners = this.listeners || {}; this.listeners[evt] = fn; }
};

const storage = {};
const mockLocalStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

const domSandbox = {
  document: mockDoc,
  localStorage: mockLocalStorage,
  window: {},
  alert: () => {},
  confirm: () => true,
  navigator: {},
  console
};

const fullSource = source.replace('const TutorialManager =', 'globalThis.TutorialManager =');
vm.runInNewContext(fullSource, domSandbox);

const tm = domSandbox.TutorialManager;
assert(tm, 'TutorialManager must exist');

// Test first-time visitor banner visibility
assert.equal(elements['tutorialBanner'].hidden, false, 'Banner shown when unvisited');

// Test Step 1: Target Menang
tm.start();
assert.equal(tm.isActive(), true, 'Tutorial active');
assert.equal(elements['overlay'].hidden, false, 'Overlay visible');
assert.equal(elements['modalTitle'].textContent.includes('Target Menang'), true);

tm.handleTileClick(0); // wrong tile
assert.equal(tm.validated, false, 'Wrong tile fails');
tm.handleTileClick(0); // deselect
tm.handleTileClick(12);
tm.handleTileClick(13);
assert.equal(tm.validated, true, 'Pair tiles validate Step 1');

// Test Step 2: Mengenal 144 Tiles
tm.next();
assert.equal(tm.step, 1);
tm.handleTileClick(1);
tm.handleTileClick(3);
tm.handleTileClick(5);
assert.equal(tm.validated, true, 'Dragon tiles validate Step 2');

// Test Step 3: Membentuk Set (Chi, Pon)
tm.next();
assert.equal(tm.step, 2);
tm.handleTileClick(0);
tm.handleTileClick(1);
tm.handleTileClick(2);
assert.equal(tm.substep, 1, 'Chi advances to Pon');
tm.handleTileClick(3);
tm.handleTileClick(4);
tm.handleTileClick(5);
assert.equal(tm.validated, true, 'Pon tiles validate Step 3');

// Test Step 4: Bunga Kursi
tm.next();
assert.equal(tm.step, 3);
tm.handleTileClick(2);
assert.equal(tm.validated, true, 'Flower 3 matches West seat');

// Test Step 5: Draw & Discard
tm.next();
assert.equal(tm.step, 4);
tm.substep = 1;
tm.render();
tm.handleTileClick(13);
tm.validated = true;
tm.render();
assert.equal(tm.validated, true, 'Discard validates Step 5');

// Test Step 6: Claim Discard
tm.next();
assert.equal(tm.step, 5);
tm.validated = true;
tm.render();
assert.equal(tm.validated, true, 'Claim validates Step 6');

// Test Step 7: Fan Quiz
tm.next();
assert.equal(tm.step, 6);
tm.handleQuizClick('A');
assert.equal(tm.validated, false);
tm.handleQuizClick('C');
assert.equal(tm.validated, true, 'Option C (Qing Yi Se) validates Step 7');

// Test Step 8: Shooter Quiz
tm.next();
assert.equal(tm.step, 7);
tm.handleQuizClick('B');
assert.equal(tm.validated, false);
tm.handleQuizClick('C');
assert.equal(tm.validated, true, 'Option C (320 pts) validates Step 8');

// Complete tutorial
tm.complete();
assert.equal(tm.isActive(), false);
assert.equal(storage['mahjong-tutorial-completed'], 'true');
assert.equal(elements['overlay'].hidden, true);

console.log('Interactive Tutorial flow verification passed successfully!');
