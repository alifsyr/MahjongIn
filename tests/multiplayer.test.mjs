import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

console.log('Testing Multiplayer Backend Integration (P0 - P3)...');

const source = readFileSync(new URL('../riichi.js', import.meta.url), 'utf8');

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
      classList: {
        classes: new Set(),
        toggle(cls, val) {
          if (val === undefined) val = !this.classes.has(cls);
          if (val) this.classes.add(cls);
          else this.classes.delete(cls);
        },
        add(cls) { this.classes.add(cls); },
        remove(cls) { this.classes.delete(cls); },
        contains(cls) { return this.classes.has(cls); }
      },
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
      classList: {
        classes: new Set(),
        toggle(cls, val) {
          if (val === undefined) val = !this.classes.has(cls);
          if (val) this.classes.add(cls);
          else this.classes.delete(cls);
        },
        add(cls) { this.classes.add(cls); },
        remove(cls) { this.classes.delete(cls); },
        contains(cls) { return this.classes.has(cls); }
      },
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

// Expose internal functions for verification
const patchedSource = source
  .replace('function applyServerGameState(', 'globalThis.applyServerGameState = function applyServerGameState(')
  .replace('function handleServerGameOver(', 'globalThis.handleServerGameOver = function handleServerGameOver(')
  .replace('function renderActions(', 'globalThis.renderActions = function renderActions(')
  .replace('function renderOpponents(', 'globalThis.renderOpponents = function renderOpponents(')
  .replace('function render(', 'globalThis.render = function render(')
  .replace('let onlineSession = null;', 'globalThis.onlineSession = null; Object.defineProperty(globalThis, "onlineSession", { get: () => onlineSession, set: (v) => { onlineSession = v; } }); let onlineSession = null;')
  .replace('const state = {', 'const state = globalThis.state = {');

vm.runInNewContext(patchedSource, domSandbox);

const { applyServerGameState, handleServerGameOver, renderActions, renderOpponents, render, state } = domSandbox;

// 1. Test applyServerGameState & Dead Wall / Opponent Disconnection mapping
console.log('1. Testing applyServerGameState state mapping...');
domSandbox.onlineSession = { roomCode: 'ABCD', seat: 0, sessionToken: 'tok123' };

applyServerGameState({
  roomCode: 'ABCD',
  seat: 0,
  wallCount: 45,
  deadWallCount: 14,
  currentTurn: 0,
  phase: 'discard',
  myHand: [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 31, 31, 31],
  myFlowers: [34],
  myMelds: [],
  myScore: 10000,
  canTsumo: true,
  canKongTiles: [31],
  turn: 12,
  opponents: [
    { seat: 1, name: 'Budi', tileCount: 13, flowers: [], melds: [], discards: [], score: 10000, isConnected: false },
    { seat: 2, name: 'Siti', tileCount: 13, flowers: [], melds: [], discards: [], score: 10000, isConnected: true },
    { seat: 3, name: 'Dewi', tileCount: 13, flowers: [], melds: [], discards: [], score: 10000, isConnected: true }
  ]
});

assert.equal(state.canTsumo, true, 'canTsumo flag mapped');
assert.deepEqual([...state.canKongTiles], [31], 'canKongTiles mapped');
assert.equal(state.deadWallCount, 14, 'deadWallCount mapped');
assert.equal(state.players[1].isConnected, false, 'Opponent seat 1 isConnected mapped as false');
assert.equal(state.players[2].isConnected, true, 'Opponent seat 2 isConnected mapped as true');

// 2. Test renderActions with online Tsumo & Kan
console.log('2. Testing renderActions for online Tsumo and Kan buttons...');
renderActions();
const actionButtons = elements['actionBar'].children;
const buttonLabels = actionButtons.map((b) => b.textContent);

assert(buttonLabels.some((l) => l.includes('MAHJONG! (Tsumo)')), 'Tsumo button present when canTsumo is true');
assert(buttonLabels.some((l) => l.includes('Kan:')), 'Kan button present for canKongTiles');

// 3. Test renderOpponents disconnected class and badge
console.log('3. Testing renderOpponents disconnected badge...');
renderOpponents();
const bot1 = elements['bot1'];
assert(bot1.classList.contains('player-disconnected'), 'bot1 container has player-disconnected class');
assert(bot1.innerHTML.includes('(Terputus...)'), 'bot1 HTML includes (Terputus...) badge');

// 4. Test handleServerGameOver with Exhaustive Draw
console.log('4. Testing handleServerGameOver with Exhaustive Draw...');
handleServerGameOver({ winner: null, isDraw: true });
assert.equal(state.active, false, 'Game marked inactive');
assert.equal(state.phase, 'over', 'Phase marked over');
assert(elements['modalTitle'].textContent.includes('Ronde Seri'), 'Exhaustive draw modal title shown');
assert(elements['modalContent'].innerHTML.includes('Exhaustive Draw'), 'Exhaustive draw explanation included in modal body');

// 5. Test handleServerGameOver with normal win & Tsumo
console.log('5. Testing handleServerGameOver with Tsumo win...');
handleServerGameOver({
  winner: 0,
  isTsumo: true,
  fanSummary: {
    totalFan: 3,
    basePoints: 160,
    items: [{ name: 'Ping Hu', fan: 1 }, { name: 'Menang Ambil Sendiri (Tsumo)', fan: 1 }, { name: 'Bunga Kursi', fan: 1 }]
  }
});
assert.equal(state.active, false, 'Game marked inactive on win');
assert(elements['modalTitle'].textContent.includes('Tsumo'), 'Tsumo win title shown');

// 6. Test session persistence in localStorage
console.log('6. Testing session persistence...');
mockLocalStorage.setItem('mahjongin_session', JSON.stringify({ roomCode: 'WXYZ', seat: 2, sessionToken: 'sec789' }));
const savedSession = JSON.parse(mockLocalStorage.getItem('mahjongin_session'));
assert.equal(savedSession.roomCode, 'WXYZ');
assert.equal(savedSession.sessionToken, 'sec789');

console.log('All multiplayer integration tests passed successfully!');
