import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

console.log('Testing Menu View & Full Game Layout Switching...');

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
        add(...tokens) { tokens.forEach(t => this.classes.add(t)); },
        remove(...tokens) { tokens.forEach(t => this.classes.delete(t)); },
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
        add(...tokens) { tokens.forEach(t => this.classes.add(t)); },
        remove(...tokens) { tokens.forEach(t => this.classes.delete(t)); },
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

const patchedSource = source
  .replace('function showMenuView(', 'globalThis.showMenuView = function showMenuView(')
  .replace('function showGameView(', 'globalThis.showGameView = function showGameView(')
  .replace('function handleBackToMenu(', 'globalThis.handleBackToMenu = function handleBackToMenu(')
  .replace('function applyZoom(', 'globalThis.applyZoom = function applyZoom(');

vm.runInNewContext(patchedSource, domSandbox);

const { showMenuView, showGameView, handleBackToMenu, applyZoom } = domSandbox;

// 1. Initial State: Menu View is visible, Game View is hidden
console.log('1. Testing initial view state...');
showMenuView();
assert.equal(elements['menuView'].hidden, false, 'Menu View must be visible initially');
assert.equal(elements['gameView'].hidden, true, 'Game View must be hidden initially');
assert.equal(elements['backToMenuBtn'].hidden, true, 'Back to menu button hidden in menu');

// 2. Switching to Solo Game View
console.log('2. Testing switch to Solo Game View...');
showGameView('solo');
assert.equal(elements['menuView'].hidden, true, 'Menu View hidden during game');
assert.equal(elements['gameView'].hidden, false, 'Game View visible during game');
assert.equal(elements['backToMenuBtn'].hidden, false, 'Back to menu button visible in game');
assert(elements['gameModeBadge'].textContent.includes('SOLO'), 'Mode badge indicates Solo mode');

// 3. Returning to Menu View
console.log('3. Testing return to Menu View...');
handleBackToMenu();
assert.equal(elements['menuView'].hidden, false, 'Menu View visible after returning');
assert.equal(elements['gameView'].hidden, true, 'Game View hidden after returning');

// 4. Sidebar Toggle functionality
console.log('4. Testing sidebar toggle in Game View...');
showGameView('solo');
const toggleBtn = elements['toggleSidebarBtn'];
const gameViewEl = elements['gameView'];

// Simulate click on toggleSidebarBtn
toggleBtn.listeners['click']();
assert(gameViewEl.classList.contains('show-sidebar'), 'gameView has show-sidebar class after toggle');

toggleBtn.listeners['click']();
assert(!gameViewEl.classList.contains('show-sidebar'), 'gameView hides sidebar after second toggle');

// 5. Zoom controls (140% default zoom magnification)
console.log('5. Testing Zoom controls (100%, 120%, 140%)...');
const gameSideEl = elements['gameSide'];
assert(gameSideEl.classList.contains('zoom-140'), 'Default zoom level must be zoom-140');

applyZoom('120');
assert(gameSideEl.classList.contains('zoom-120'), 'applyZoom(120) adds zoom-120');
assert(!gameSideEl.classList.contains('zoom-140'), 'applyZoom(120) removes zoom-140');

applyZoom('140');
assert(gameSideEl.classList.contains('zoom-140'), 'applyZoom(140) restores zoom-140');

console.log('All menu, layout, and zoom controls tests passed successfully!');
