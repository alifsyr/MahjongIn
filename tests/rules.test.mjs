import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../riichi.js', import.meta.url), 'utf8');
const beforeBindings = source.slice(0, source.indexOf("  $('rulesTop').addEventListener"));
const sandbox = {};
vm.runInNewContext(`${beforeBindings}\n globalThis.test = { isWinningHand, possibleChi, availableClaims, state };\n})();`, sandbox);
const { isWinningHand, possibleChi, availableClaims, state } = sandbox.test;

assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,31,31,31,27,27], 0), true, '4 melds and a pair win');
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,31,31,32,27,27], 0), false, 'incomplete hand fails');
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,27,27], 1), true, 'open meld counted correctly');
assert.equal(possibleChi([18,20],19).length, 1, 'Chi within one suit');
assert.equal(possibleChi([8,10],9).length, 0, 'Chi cannot cross suit boundary');
assert.equal(possibleChi([27,28],29).length, 0, 'Chi cannot use honors');

state.players = [0,1,2,3].map((seat) => ({ seat, hand: [], melds: [] }));
state.players[0].hand = [31,31,0,1,2,4,5,6,18,19,20,27,28];
assert.equal(availableClaims(0, 3, 31).some((v) => v.kind === 'pon'), true, 'Pon from any opponent');
state.players[0].hand = [18,20,0,1,2,4,5,6,9,10,11,27,28];
assert.equal(availableClaims(0, 3, 19).some((v) => v.kind === 'chi'), true, 'Chi from preceding seat');
assert.equal(availableClaims(0, 2, 19).some((v) => v.kind === 'chi'), false, 'No Chi from other seats');
state.players[0].hand = [31,31,31,0,1,2,4,5,6,9,10,11,27];
assert.equal(availableClaims(0, 2, 31).some((v) => v.kind === 'kan'), true, 'Kan from three concealed matches');
console.log('Riichi rules tests passed (winning, open melds, Chi, Pon, Kan).');
