import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../riichi.js', import.meta.url), 'utf8');
const beforeBindings = source.slice(0, source.indexOf("  $('rulesTop').addEventListener"));
const sandbox = {};
vm.runInNewContext(`${beforeBindings}\n globalThis.test = { isWinningHand, possibleChi, availableClaims, state, isFlower, calculateFan, fanToPoints, findWinningDecomposition };\n})();`, sandbox);
const { isWinningHand, possibleChi, availableClaims, state, isFlower, calculateFan, fanToPoints, findWinningDecomposition } = sandbox.test;

// Base 4 melds and pair
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,31,31,31,27,27], 0), true, '4 melds and a pair win');
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,31,31,32,27,27], 0), false, 'incomplete hand fails');
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,27,27], 1), true, 'open meld counted correctly');
assert.equal(possibleChi([18,20],19).length, 1, 'Chi within one suit');
assert.equal(possibleChi([8,10],9).length, 0, 'Chi cannot cross suit boundary');
assert.equal(possibleChi([27,28],29).length, 0, 'Chi cannot use honors');

state.players = [0,1,2,3].map((seat) => ({ seat, hand: [], melds: [], flowers: [], score: 10000 }));
state.players[0].hand = [31,31,0,1,2,4,5,6,18,19,20,27,28];
assert.equal(availableClaims(0, 3, 31).some((v) => v.kind === 'pon'), true, 'Pon from any opponent');
state.players[0].hand = [18,20,0,1,2,4,5,6,9,10,11,27,28];
assert.equal(availableClaims(0, 3, 19).some((v) => v.kind === 'chi'), true, 'Chi from preceding seat');
assert.equal(availableClaims(0, 2, 19).some((v) => v.kind === 'chi'), false, 'No Chi from other seats');
state.players[0].hand = [31,31,31,0,1,2,4,5,6,9,10,11,27];
assert.equal(availableClaims(0, 2, 31).some((v) => v.kind === 'kan'), true, 'Kan from three concealed matches');

// Test Flower logic (144 tiles)
assert.equal(isFlower(34), true, 'Tile 34 is Plum flower');
assert.equal(isFlower(41), true, 'Tile 41 is Winter season');
assert.equal(isFlower(33), false, 'Tile 33 is White Dragon, not a flower');
assert.equal(isFlower(0), false, 'Tile 0 is 1 Wan, not a flower');

// Test Fan calculation: Ping Hu (All chows, numeric pair)
state.players[0].hand = [0,1,2,3,4,5,9,10,11,18,19,20,21,21];
state.players[0].melds = [];
state.players[0].flowers = [];
const pingHu = calculateFan(0, 'Ron', 1, 21);
assert.equal(pingHu.items.some((it) => it.name.includes('Ping Hu')), true, 'Ping Hu detected');

// Test Fan calculation: Dui Dui Hu (All pongs)
state.players[0].hand = [0,0,0,9,9,9,18,18,18,31,31,31,27,27];
state.players[0].melds = [];
state.players[0].flowers = [];
const duiDui = calculateFan(0, 'Ron', 1, 27);
assert.equal(duiDui.items.some((it) => it.name.includes('Dui Dui Hu')), true, 'Dui Dui Hu detected');
assert.equal(duiDui.items.some((it) => it.name.includes('Naga Merah')), true, 'Red dragon pung detected');

// Test Fan calculation: Qing Yi Se (Pure One Suit)
state.players[0].hand = [0,1,2,3,4,5,6,7,8,0,1,2,5,5];
state.players[0].melds = [];
state.players[0].flowers = [];
const qingYiSe = calculateFan(0, 'Ron', 1, 5);
assert.equal(qingYiSe.items.some((it) => it.name.includes('Qing Yi Se')), true, 'Qing Yi Se detected (+7 Fan)');

// Test Seat Flower matching seat 0 (East) -> tile 34 (Mei)
state.players[0].flowers = [34]; // Flower 1 matches East
const withFlower = calculateFan(0, 'Tsumo', null, 5);
assert.equal(withFlower.items.some((it) => it.name.includes('Bunga Kursi')), true, 'Seat flower matches seat');
assert.equal(withFlower.items.some((it) => it.name.includes('Tsumo')), true, 'Tsumo bonus detected');

// Test fanToPoints
assert.equal(fanToPoints(1), 40);
assert.equal(fanToPoints(3), 160);
assert.equal(fanToPoints(7), 960);

console.log('All 144-tile Hong Kong & Jakarta lounge rules tests passed successfully!');
