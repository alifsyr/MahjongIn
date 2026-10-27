/* Mahjong Jakarta Lounge: 4-player Hong Kong style Mahjong (144 tiles).
   Implements 144 tiles including 8 flowers/seasons, automatic flower replacement,
   and Hong Kong Fan scoring with table chip transfer (shooter vs tsumo).
   Purely recreational board game with no real money or gambling involved. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const NAMES = ['Kamu', 'Hana', 'Kenji', 'Sora'];
  const WINDS = ['Timur', 'Selatan', 'Barat', 'Utara'];
  const WIND_SIGNS = ['東', '南', '西', '北'];
  const NUMBER_SIGNS = '一二三四五六七八九';
  const HONORS = ['東', '南', '西', '北', '中', '發', '白'];
  const HONOR_NAMES = ['Angin Timur', 'Angin Selatan', 'Angin Barat', 'Angin Utara', 'Naga Merah', 'Naga Hijau', 'Naga Putih'];
  const FLOWER_NAMES = [
    'Bunga 1 (Plum / 梅)', 'Bunga 2 (Orchid / 蘭)', 'Bunga 3 (Chrysanthemum / 菊)', 'Bunga 4 (Bamboo / 竹)',
    'Musim 1 (Spring / 春)', 'Musim 2 (Summer / 夏)', 'Musim 3 (Autumn / 秋)', 'Musim 4 (Winter / 冬)'
  ];
  const FLOWER_SIGNS = ['梅', '蘭', '菊', '竹', '春', '夏', '秋', '冬'];
  const isFlower = (t) => t >= 34 && t <= 41;

  const state = {
    players: [], wall: [], current: 0, phase: 'draw', selected: null,
    drawn: null, lastDiscard: null, pending: null, active: false, turn: 1,
    generation: 0, log: [], winner: null
  };

  const SERVER_URL = 'https://mahjongin-server.onrender.com';
  let socket = null;
  let onlineSession = null;

  const tileName = (t) => {
    if (t < 9) return `${t + 1} Karakter`;
    if (t < 18) return `${t - 8} Lingkaran`;
    if (t < 27) return `${t - 17} Bambu`;
    if (t < 34) return HONOR_NAMES[t - 27];
    return FLOWER_NAMES[t - 34];
  };

  const tileShort = (t) => {
    if (t < 9) return `${t + 1} Wan`;
    if (t < 18) return `${t - 8} Pin`;
    if (t < 27) return `${t - 17} Sou`;
    if (t < 34) return HONOR_NAMES[t - 27];
    return FLOWER_SIGNS[t - 34];
  };

  function tileArt(t) {
    if (t < 9) return `<span>${NUMBER_SIGNS[t]}</span><span class="tile-minor">萬</span>`;
    if (t < 18) return `<span>${'①②③④⑤⑥⑦⑧⑨'[t - 9]}</span><span class="tile-minor">筒</span>`;
    if (t < 27) return `<span>${NUMBER_SIGNS[t - 18]}</span><span class="tile-minor">索</span>`;
    if (t < 34) return HONORS[t - 27];
    const num = ((t - 34) % 4) + 1;
    return `<span class="flower-no">${num}</span><span class="flower-sign">${FLOWER_SIGNS[t - 34]}</span>`;
  }

  const tileColor = (t) => {
    if (t < 9) return 'blue';
    if (t < 18) return '';
    if (t < 27) return 'green';
    if (t === 31) return 'red';
    if (t === 32) return 'green';
    if (t === 33) return 'blue';
    if (t >= 34 && t <= 37) return 'flower-plum';
    if (t >= 38 && t <= 41) return 'flower-season';
    return '';
  };

  function miniTile(t, latest = false) {
    return `<span class="mini-tile ${tileColor(t)} ${latest ? 'latest' : ''}" title="${tileName(t)}" aria-label="${tileName(t)}">${tileArt(t)}</span>`;
  }

  function shuffle(values) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  const sortHand = (hand) => hand.sort((a, b) => a - b);

  function countsFor(hand) {
    const counts = Array(34).fill(0);
    hand.forEach((t) => { if (t < 34) counts[t]++; });
    return counts;
  }

  function canMakeMelds(counts, groupsNeeded) {
    const first = counts.findIndex((n) => n > 0);
    if (first === -1) return groupsNeeded === 0;
    if (!groupsNeeded) return false;
    if (counts[first] >= 3) {
      counts[first] -= 3;
      if (canMakeMelds(counts, groupsNeeded - 1)) { counts[first] += 3; return true; }
      counts[first] += 3;
    }
    if (first < 27 && first % 9 <= 6 && counts[first + 1] && counts[first + 2]) {
      counts[first]--; counts[first + 1]--; counts[first + 2]--;
      if (canMakeMelds(counts, groupsNeeded - 1)) {
        counts[first]++; counts[first + 1]++; counts[first + 2]++;
        return true;
      }
      counts[first]++; counts[first + 1]++; counts[first + 2]++;
    }
    return false;
  }

  function isWinningHand(hand, openMelds) {
    const needed = 4 - openMelds;
    if (needed < 0 || hand.length !== needed * 3 + 2) return false;
    const counts = countsFor(hand);
    for (let pair = 0; pair < 34; pair++) {
      if (counts[pair] < 2) continue;
      counts[pair] -= 2;
      if (canMakeMelds(counts, needed)) { counts[pair] += 2; return true; }
      counts[pair] += 2;
    }
    return false;
  }

  function findWinningDecomposition(hand, needed) {
    const counts = countsFor(hand);
    for (let pair = 0; pair < 34; pair++) {
      if (counts[pair] < 2) continue;
      counts[pair] -= 2;
      const groups = [];
      if (extractMelds(counts, needed, groups)) {
        return { pair, groups };
      }
      counts[pair] += 2;
    }
    return null;
  }

  function extractMelds(counts, needed, groups) {
    const first = counts.findIndex((n) => n > 0);
    if (first === -1) return needed === 0;
    if (!needed) return false;
    if (counts[first] >= 3) {
      counts[first] -= 3;
      groups.push({ type: 'pong', tile: first });
      if (extractMelds(counts, needed - 1, groups)) return true;
      groups.pop();
      counts[first] += 3;
    }
    if (first < 27 && first % 9 <= 6 && counts[first + 1] && counts[first + 2]) {
      counts[first]--; counts[first + 1]--; counts[first + 2]--;
      groups.push({ type: 'chow', tile: first });
      if (extractMelds(counts, needed - 1, groups)) return true;
      groups.pop();
      counts[first]++; counts[first + 1]++; counts[first + 2]++;
    }
    return false;
  }

  function calculateFan(winnerSeat, mode, discarder, winningTile) {
    const player = state.players[winnerSeat];
    const items = [];
    const needed = 4 - player.melds.length;
    const decomp = findWinningDecomposition(player.hand, needed);

    const allGroups = [
      ...player.melds.map((m) => ({ type: m.kind === 'chi' ? 'chow' : 'pong', tile: m.tiles[0] })),
      ...(decomp ? decomp.groups : [])
    ];

    if (mode === 'Tsumo') {
      items.push({ name: 'Tsumo (Ambil Sendiri)', fan: 1 });
    }

    player.flowers.forEach((f) => {
      if ((f - 34) % 4 === winnerSeat) {
        items.push({ name: `Bunga Kursi (${tileShort(f)})`, fan: 1 });
      }
    });
    const plumSet = player.flowers.filter((f) => f >= 34 && f <= 37);
    if (plumSet.length === 4) {
      items.push({ name: 'Set Lengkap 4 Bunga (梅蘭菊竹)', fan: 2 });
    }
    const seasonSet = player.flowers.filter((f) => f >= 38 && f <= 41);
    if (seasonSet.length === 4) {
      items.push({ name: 'Set Lengkap 4 Musim (春夏秋冬)', fan: 2 });
    }
    if (player.flowers.length === 0) {
      items.push({ name: 'Tanpa Bunga (Wu Hua)', fan: 1 });
    }

    const dragonNames = { 31: 'Naga Merah (中)', 32: 'Naga Hijau (發)', 33: 'Naga Putih (白)' };
    [31, 32, 33].forEach((dragon) => {
      if (allGroups.some((g) => g.type === 'pong' && g.tile === dragon)) {
        items.push({ name: `Pung ${dragonNames[dragon]}`, fan: 1 });
      }
    });

    if (allGroups.some((g) => g.type === 'pong' && g.tile === 27)) {
      items.push({ name: 'Pung Angin Ronde (Timur)', fan: 1 });
    }
    if (winnerSeat !== 0 && allGroups.some((g) => g.type === 'pong' && g.tile === 27 + winnerSeat)) {
      items.push({ name: `Pung Angin Kursi (${WINDS[winnerSeat]})`, fan: 1 });
    }

    if (decomp && allGroups.length === 4) {
      const isAllPongs = allGroups.every((g) => g.type === 'pong');
      const isAllChows = allGroups.every((g) => g.type === 'chow') && decomp.pair < 27;

      if (isAllPongs) {
        items.push({ name: 'Dui Dui Hu (Semua Pung/Kembar)', fan: 3 });
      } else if (isAllChows) {
        items.push({ name: 'Ping Hu (Semua Chow/Runtun)', fan: 1 });
      }

      const allTiles = [
        ...player.hand,
        ...player.melds.flatMap((m) => m.tiles)
      ];
      const hasWan = allTiles.some((t) => t < 9);
      const hasPin = allTiles.some((t) => t >= 9 && t < 18);
      const hasSou = allTiles.some((t) => t >= 18 && t < 27);
      const hasHonors = allTiles.some((t) => t >= 27 && t < 34);
      const suitCount = (hasWan ? 1 : 0) + (hasPin ? 1 : 0) + (hasSou ? 1 : 0);

      if (suitCount === 1 && !hasHonors) {
        items.push({ name: 'Qing Yi Se (Satu Jenis Murni)', fan: 7 });
      } else if (suitCount === 1 && hasHonors) {
        items.push({ name: 'Hun Yi Se (Satu Jenis Campur Honor)', fan: 3 });
      }
    }

    if (mode === 'Ron' && player.melds.filter((m) => m.from !== winnerSeat).length === 0) {
      items.push({ name: 'Menqian Qing (Tangan Tertutup)', fan: 1 });
    }

    if (items.length === 0) {
      items.push({ name: 'Ji Hu (Kombinasi Standar)', fan: 1 });
    }

    const totalFan = items.reduce((sum, item) => sum + item.fan, 0);
    return { items, totalFan };
  }

  function fanToPoints(fan) {
    if (fan <= 1) return 40;
    if (fan === 2) return 80;
    if (fan === 3) return 160;
    if (fan === 4) return 320;
    if (fan === 5) return 480;
    if (fan === 6) return 640;
    if (fan === 7) return 960;
    return 1280;
  }

  function enqueue(callback, ms = 580) {
    const generation = state.generation;
    setTimeout(() => {
      if (generation !== state.generation || !state.active) return;
      if (!$('overlay').hidden) { enqueue(callback, 250); return; }
      callback();
    }, ms);
  }

  function addLog(message) {
    state.log.unshift(message);
    state.log.length = Math.min(state.log.length, 15);
  }

  function setStatus(text) { $('statusText').textContent = text; }

  function replaceInitialFlowers(seat) {
    const player = state.players[seat];
    let found = true;
    while (found && state.wall.length) {
      const idx = player.hand.findIndex(isFlower);
      if (idx === -1) {
        found = false;
      } else {
        const flower = player.hand.splice(idx, 1)[0];
        player.flowers.push(flower);
        const replacement = state.wall.pop();
        player.hand.push(replacement);
        if (seat === 0) {
          addLog(`Kamu mendapat ${tileName(flower)} saat pembagian (diganti ubin baru).`);
        }
      }
    }
  }

  function startNewGame() {
    closeModal();
    state.generation++;
    const standardTiles = Array.from({ length: 34 }, (_, type) => Array(4).fill(type)).flat();
    const flowerTiles = [34, 35, 36, 37, 38, 39, 40, 41];
    state.wall = shuffle([...standardTiles, ...flowerTiles]);
    state.players = NAMES.map((name, seat) => ({
      seat,
      name,
      hand: [],
      discards: [],
      melds: [],
      flowers: [],
      score: state.players[seat]?.score ?? 10000
    }));

    for (let n = 0; n < 13; n++) {
      for (let seat = 0; seat < 4; seat++) {
        state.players[seat].hand.push(state.wall.pop());
      }
    }
    for (let seat = 0; seat < 4; seat++) {
      replaceInitialFlowers(seat);
      sortHand(state.players[seat].hand);
    }

    state.current = 0;
    state.phase = 'draw';
    state.selected = null;
    state.drawn = null;
    state.lastDiscard = null;
    state.pending = null;
    state.active = true;
    state.winner = null;
    state.turn = 1;
    state.log = [];
    addLog('Ronde dimulai (144 Ubin meja Jakarta Lounge). Kamu duduk di kursi Timur.');
    setStatus('Giliranmu: ambil satu ubin dari tumpukan.');
    render();
  }

  function drawFromWall(seat, replacement = false) {
    if (!state.wall.length) { finishDraw(); return null; }
    let tile = state.wall.pop();
    const player = state.players[seat];
    while (isFlower(tile) && state.wall.length) {
      player.flowers.push(tile);
      addLog(`${NAMES[seat]} menarik ${tileName(tile)}! Ubin bunga dipajang & ambil pengganti.`);
      tile = state.wall.pop();
    }
    if (isFlower(tile)) {
      player.flowers.push(tile);
      finishDraw();
      return null;
    }
    player.hand.push(tile);
    sortHand(player.hand);
    if (seat === 0) state.drawn = tile;
    if (replacement) addLog(`${NAMES[seat]} mengambil ubin pengganti Kan.`);
    return tile;
  }

  function playerDraw() {
    if (onlineSession) {
      if (state.current !== 0 || state.phase !== 'draw') return;
      socket?.emit('game:draw');
      return;
    }
    if (!state.active || state.phase !== 'draw' || state.current !== 0) return;
    if (drawFromWall(0) === null) return;
    state.phase = 'discard';
    state.selected = null;
    addLog('Kamu mengambil 1 ubin. Pilih ubin untuk dibuang.');
    setStatus(isWinningHand(state.players[0].hand, state.players[0].melds.length) ? 'Mahjong! Tanganmu sudah lengkap.' : 'Pilih satu ubin lalu tekan Buang Ubin.');
    render();
  }

  function possibleChi(hand, tile) {
    if (tile >= 27) return [];
    const suitStart = Math.floor(tile / 9) * 9;
    const options = [];
    const counts = countsFor(hand);
    for (let start = Math.max(suitStart, tile - 2); start <= Math.min(suitStart + 6, tile); start++) {
      const tiles = [start, start + 1, start + 2];
      const consume = tiles.filter((v) => v !== tile);
      if (consume.every((v) => counts[v] > 0)) options.push({ kind: 'chi', tiles, consume });
    }
    return options;
  }

  function availableClaims(seat, discarder, tile) {
    if (seat === discarder || tile >= 34) return [];
    const player = state.players[seat];
    const counts = countsFor(player.hand);
    const options = [];
    if (isWinningHand([...player.hand, tile], player.melds.length))
      options.push({ kind: 'ron', tiles: [tile], consume: [] });
    if (counts[tile] >= 3) options.push({ kind: 'kan', tiles: [tile, tile, tile, tile], consume: [tile, tile, tile] });
    if (counts[tile] >= 2) options.push({ kind: 'pon', tiles: [tile, tile, tile], consume: [tile, tile] });
    if (seat === (discarder + 1) % 4) options.push(...possibleChi(player.hand, tile));
    return options;
  }

  function removeTiles(hand, remove) {
    for (const t of remove) {
      const index = hand.indexOf(t);
      if (index === -1) throw new Error(`Ubin ${t} tidak tersedia`);
      hand.splice(index, 1);
    }
  }

  function discardTile(seat, tile) {
    if (!state.active) return;
    const player = state.players[seat];
    removeTiles(player.hand, [tile]);
    player.discards.push(tile);
    state.lastDiscard = { seat, tile };
    state.selected = null;
    state.drawn = null;
    state.turn++;
    addLog(`${NAMES[seat]} membuang ${tileShort(tile)}.`);
    state.phase = 'resolving';
    setStatus(`${NAMES[seat]} membuang ${tileName(tile)}.`);
    resolveDiscard(seat, tile);
  }

  function playerDiscard() {
    if (state.phase !== 'discard' || state.current !== 0 || state.selected === null) return;
    const displayed = displayedHand();
    const tile = displayed[state.selected];
    if (tile === undefined) return;
    if (onlineSession) {
      socket?.emit('game:discard', { tile });
      state.selected = null;
      render();
      return;
    }
    discardTile(0, tile);
  }

  function displayedHand() {
    const hand = [...state.players[0].hand];
    if (state.drawn !== null && state.phase === 'discard') {
      const idx = hand.indexOf(state.drawn);
      if (idx !== -1) {
        hand.splice(idx, 1);
        hand.push(state.drawn);
      }
    }
    return hand;
  }

  function resolveDiscard(discarder, tile) {
    if (discarder !== 0) {
      const humanClaims = availableClaims(0, discarder, tile);
      if (humanClaims.length) {
        state.pending = { discarder, tile, options: humanClaims };
        state.phase = 'claim';
        setStatus(`Kesempatan mengklaim ${tileName(tile)} dari ${NAMES[discarder]}!`);
        render();
        return;
      }
    }
    state.pending = null;
    render();
    enqueue(() => botClaimOrAdvance(discarder, tile), 430);
  }

  function botClaimOrAdvance(discarder, tile) {
    if (!state.active || !state.lastDiscard || state.lastDiscard.seat !== discarder || state.lastDiscard.tile !== tile) return;
    const candidates = [];
    for (let seat = 1; seat <= 3; seat++) {
      if (seat === discarder) continue;
      const options = availableClaims(seat, discarder, tile);
      const ron = options.find((x) => x.kind === 'ron');
      if (ron) candidates.push({ seat, option: ron, priority: 10 });
      else {
        const kan = options.find((x) => x.kind === 'kan');
        const pon = options.find((x) => x.kind === 'pon');
        const chi = options.find((x) => x.kind === 'chi');
        if (kan && Math.random() < .32) candidates.push({ seat, option: kan, priority: 6 });
        else if (pon && Math.random() < .43) candidates.push({ seat, option: pon, priority: 5 });
        else if (chi && Math.random() < .17) candidates.push({ seat, option: chi, priority: 2 });
      }
    }
    candidates.sort((a, b) => b.priority - a.priority || ((a.seat - discarder + 4) % 4) - ((b.seat - discarder + 4) % 4));
    if (candidates.length) {
      const { seat, option } = candidates[0];
      claimDiscard(seat, discarder, tile, option);
    } else beginTurn((discarder + 1) % 4);
  }

  function claimDiscard(seat, discarder, tile, option) {
    if (!state.active) return;
    if (option.kind === 'ron') { endRound(seat, 'Ron', discarder, tile); return; }
    const source = state.players[discarder];
    if (source.discards[source.discards.length - 1] !== tile) return;
    source.discards.pop();
    state.lastDiscard = null;
    const player = state.players[seat];
    removeTiles(player.hand, option.consume);
    player.melds.push({ kind: option.kind, tiles: [...option.tiles], from: discarder });
    state.current = seat;
    state.selected = null;
    state.pending = null;
    state.drawn = null;
    sortHand(player.hand);
    addLog(`${NAMES[seat]} memanggil ${option.kind.toUpperCase()} dari ${NAMES[discarder]}.`);
    if (option.kind === 'kan' && drawFromWall(seat, true) === null) return;
    state.phase = seat === 0 ? 'discard' : 'bot';
    if (seat === 0) setStatus('Klaim berhasil. Sekarang buang satu ubin.');
    else setStatus(`${NAMES[seat]} mengambil ubin dengan ${option.kind.toUpperCase()}.`);
    render();
    if (seat !== 0) {
      if (isWinningHand(player.hand, player.melds.length)) { enqueue(() => endRound(seat, 'Tsumo'), 600); return; }
      enqueue(() => botDiscard(seat), 700);
    }
  }

  function playerClaim(index) {
    if (!state.pending || state.phase !== 'claim') return;
    const { discarder, tile, options } = state.pending;
    const option = options[index];
    if (!option) return;
    if (onlineSession) {
      socket?.emit('game:claim', { kind: option.kind, index });
      state.pending = null;
      render();
      return;
    }
    claimDiscard(0, discarder, tile, option);
  }

  function passClaim() {
    if (state.phase !== 'claim' || !state.pending) return;
    if (onlineSession) {
      socket?.emit('game:pass');
      state.pending = null;
      render();
      return;
    }
    const { discarder, tile } = state.pending;
    state.pending = null;
    state.phase = 'resolving';
    addLog('Kamu melewati kesempatan klaim.');
    render();
    enqueue(() => botClaimOrAdvance(discarder, tile), 200);
  }

  function beginTurn(seat) {
    if (!state.active) return;
    state.current = seat;
    state.pending = null;
    state.phase = seat === 0 ? 'draw' : 'bot';
    if (seat === 0) {
      setStatus('Giliranmu! Tekan Ambil Ubin.');
      addLog('Kembali ke giliranmu.');
    } else setStatus(`Giliran ${NAMES[seat]} (${WINDS[seat]}).`);
    render();
    if (seat !== 0) enqueue(() => botTurn(seat), 620);
  }

  function botDiscardValue(hand, tile) {
    const counts = countsFor(hand);
    let affinity = (counts[tile] - 1) * 7;
    if (tile < 27) {
      const min = Math.floor(tile / 9) * 9;
      const max = min + 8;
      if (tile - 1 >= min) affinity += counts[tile - 1] * 2.8;
      if (tile + 1 <= max) affinity += counts[tile + 1] * 2.8;
      if (tile - 2 >= min) affinity += counts[tile - 2] * 1.5;
      if (tile + 2 <= max) affinity += counts[tile + 2] * 1.5;
    }
    return affinity + Math.random() * 1.1;
  }

  function botChooseDiscard(seat) {
    const hand = state.players[seat].hand;
    return [...hand].sort((a, b) => botDiscardValue(hand, a) - botDiscardValue(hand, b))[0];
  }

  function botTurn(seat) {
    if (state.phase !== 'bot' || state.current !== seat) return;
    if (drawFromWall(seat) === null) return;
    const player = state.players[seat];
    if (isWinningHand(player.hand, player.melds.length)) {
      enqueue(() => endRound(seat, 'Tsumo'), 550);
      return;
    }
    const counts = countsFor(player.hand);
    const possibleKan = counts.findIndex((n) => n === 4);
    if (possibleKan !== -1 && Math.random() < .23 && state.wall.length) {
      removeTiles(player.hand, [possibleKan, possibleKan, possibleKan, possibleKan]);
      player.melds.push({ kind: 'kan', tiles: Array(4).fill(possibleKan), from: seat });
      addLog(`${NAMES[seat]} melakukan Kan tertutup.`);
      if (drawFromWall(seat, true) === null) return;
      if (isWinningHand(player.hand, player.melds.length)) {
        enqueue(() => endRound(seat, 'Tsumo'), 550);
        return;
      }
    }
    render();
    enqueue(() => botDiscard(seat), 590);
  }

  function botDiscard(seat) {
    if (state.phase !== 'bot' || state.current !== seat) return;
    discardTile(seat, botChooseDiscard(seat));
  }

  function playerClosedKan(tile) {
    if (state.current !== 0 || state.phase !== 'discard' || !state.wall.length) return;
    if (countsFor(state.players[0].hand)[tile] < 4) return;
    removeTiles(state.players[0].hand, [tile, tile, tile, tile]);
    state.players[0].melds.push({ kind: 'kan', tiles: [tile, tile, tile, tile], from: 0 });
    state.drawn = null;
    state.selected = null;
    addLog(`Kamu melakukan Kan tertutup (${tileShort(tile)}).`);
    if (drawFromWall(0, true) === null) return;
    setStatus('Kan berhasil. Kamu mengambil ubin pengganti.');
    render();
  }

  function endRound(winner, mode, discarder = null, winningTile = null) {
    if (!state.active) return;
    state.active = false;
    state.phase = 'over';
    state.pending = null;
    state.winner = winner;
    state.generation++;

    const player = state.players[winner];
    const { items, totalFan } = calculateFan(winner, mode, discarder, winningTile);
    const basePoints = fanToPoints(totalFan);

    let paymentText = '';
    if (mode === 'Ron' && discarder !== null) {
      const shooterPay = basePoints * 2;
      state.players[discarder].score -= shooterPay;
      state.players[winner].score += shooterPay;
      paymentText = `<strong>${NAMES[discarder]}</strong> (Shooter) membayar <strong>${shooterPay.toLocaleString('id-ID')} poin</strong> ke <strong>${NAMES[winner]}</strong>.`;
      addLog(`${NAMES[discarder]} membayar ${shooterPay.toLocaleString('id-ID')} poin ke ${NAMES[winner]}.`);
    } else {
      let totalWon = 0;
      for (let s = 0; s < 4; s++) {
        if (s !== winner) {
          state.players[s].score -= basePoints;
          totalWon += basePoints;
        }
      }
      state.players[winner].score += totalWon;
      paymentText = `Ketiga pemain lawan masing-masing membayar <strong>${basePoints.toLocaleString('id-ID')} poin</strong> ke <strong>${NAMES[winner]}</strong> (Total: +${totalWon.toLocaleString('id-ID')} poin).`;
      addLog(`Setiap lawan membayar ${basePoints.toLocaleString('id-ID')} poin ke ${NAMES[winner]}.`);
    }

    addLog(`${NAMES[winner]} menang via ${mode} (${totalFan} Fan)!`);
    setStatus(`${NAMES[winner]} menang — ${mode} (${totalFan} Fan)!`);
    render();

    const fanListHtml = items.map((it) => `<div class="fan-row"><span>✦ ${it.name}</span><strong>+${it.fan} Fan</strong></div>`).join('');
    const scoreBoardHtml = state.players.map((p) => `<div class="score-pill ${p.seat === winner ? 'winner-pill' : ''}"><span>${WIND_SIGNS[p.seat]} ${p.name}</span><strong>${p.score.toLocaleString('id-ID')} pts</strong></div>`).join('');

    showModal({
      icon: winner === 0 ? '✿' : WIND_SIGNS[winner],
      kicker: 'RONDE SELESAI · HONG KONG STYLE',
      title: winner === 0 ? 'Mahjong! Kamu menang!' : `${NAMES[winner]} menang!`,
      body: `
        <div class="winner-summary">
          <p><strong>${NAMES[winner]}</strong> menyelesaikan tangan dengan <strong>${mode}</strong>${discarder !== null ? ` dari buangan ${NAMES[discarder]}` : ''}.</p>
          <div class="fan-box">
            <div class="fan-header"><span>RINCIAN FAN</span><strong>TOTAL: ${totalFan} FAN</strong></div>
            <div class="fan-items">${fanListHtml}</div>
          </div>
          <div class="winner-big">${basePoints.toLocaleString('id-ID')} <small style="font-size:14px;font-weight:normal;">poin dasar</small></div>
          <div class="payment-notice">${paymentText}</div>
          <div class="score-table-label">KLASEMEN SKOR MEJA:</div>
          <div class="score-pill-container">${scoreBoardHtml}</div>
          <p class="table-disclaimer">Sesuai peraturan lounge Jakarta: Tanpa taruhan uang asli • 100% hiburan & olahraga otak.</p>
        </div>
      `,
      actions: [{ text: 'Main Ronde Berikutnya', primary: true, run: startNewGame }]
    });
  }

  function finishDraw() {
    if (!state.active) return;
    state.active = false;
    state.phase = 'over';
    state.generation++;
    addLog('Tumpukan habis. Ronde berakhir seri.');
    setStatus('Ronde seri — tidak ada ubin tersisa.');
    render();
    const scoreBoardHtml = state.players.map((p) => `<div class="score-pill"><span>${WIND_SIGNS[p.seat]} ${p.name}</span><strong>${p.score.toLocaleString('id-ID')} pts</strong></div>`).join('');
    showModal({
      icon: '✧',
      kicker: 'RONDE SELESAI',
      title: 'Ronde berakhir seri',
      body: `
        <p>Semua ubin di tumpukan telah habis. Tidak ada pemain yang menyelesaikan kombinasi Mahjong.</p>
        <div class="score-table-label">SKOR SAAT INI:</div>
        <div class="score-pill-container">${scoreBoardHtml}</div>
      `,
      actions: [{ text: 'Coba Lagi', primary: true, run: startNewGame }]
    });
  }

  function createButton(label, className, callback, disabled = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', callback);
    return btn;
  }

  function renderOpponents() {
    for (let seat = 1; seat < 4; seat++) {
      const player = state.players[seat];
      const container = $(`bot${seat}`);
      container.classList.toggle('current', state.current === seat && state.active);
      const backs = Array.from({ length: Math.min(9, player.hand.length) }, () => '<i class="tile-back"></i>').join('');
      const melds = player.melds.map((meld) => `<span class="opp-meld-item">${meld.tiles.map((t) => miniTile(t)).join('')}</span>`).join('');
      const flowers = player.flowers.length ? `<div class="opp-flowers"><span class="flower-icon">🌸</span>${player.flowers.map((t) => miniTile(t)).join('')}</div>` : '';
      container.innerHTML = `
        <span class="opp-avatar">${WIND_SIGNS[seat]}</span>
        <div class="opp-info">
          <div class="opp-name">${player.name}</div>
          <div class="opp-sub">${WINDS[seat]} · ${player.hand.length} ubin · <strong class="opp-score">${player.score.toLocaleString('id-ID')} pts</strong></div>
        </div>
        <div class="opp-backs">${backs}</div>
        ${melds ? `<div class="opp-melds">${melds}</div>` : ''}
        ${flowers}
      `;
    }
  }

  function renderDiscards() {
    const placement = [0, 1, 2, 3];
    for (const seat of placement) {
      const discards = state.players[seat].discards;
      const recent = discards.slice(-15);
      const html = recent.map((t, idx) => miniTile(t, idx === recent.length - 1 && state.lastDiscard?.seat === seat && state.lastDiscard?.tile === t)).join('');
      $(`discard${seat}`).innerHTML = `<label>${WINDS[seat]} · ${discards.length} BUANGAN</label><div class="discard-tiles">${html}</div>`;
    }
  }

  function renderHand() {
    const container = $('myHand');
    const hand = displayedHand();
    container.replaceChildren();
    hand.forEach((t, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isDrawn = state.drawn !== null && index === hand.length - 1 && state.phase === 'discard';
      btn.className = `hand-tile ${tileColor(t)} ${isDrawn ? 'drawn' : ''} ${state.selected === index ? 'selected' : ''}`;
      btn.innerHTML = tileArt(t);
      btn.setAttribute('aria-label', `${tileName(t)}${isDrawn ? ', baru diambil' : ''}`);
      btn.setAttribute('aria-pressed', String(state.selected === index));
      btn.disabled = !state.active || state.phase !== 'discard' || state.current !== 0;
      btn.addEventListener('click', () => {
        state.selected = state.selected === index ? null : index;
        renderHand();
        renderActions();
      });
      container.appendChild(btn);
    });
    $('handCount').textContent = `${hand.length} ubin`;

    const myFlowers = $('myFlowers');
    if (myFlowers) {
      myFlowers.hidden = !state.players[0].flowers.length;
      myFlowers.innerHTML = `<span class="flower-badge">🌸 Ubin Bunga & Musim (${state.players[0].flowers.length}):</span> ${state.players[0].flowers.map((t) => miniTile(t)).join('')}`;
    }

    const myScore = $('myScoreDisplay');
    if (myScore) {
      myScore.textContent = `${state.players[0].score.toLocaleString('id-ID')} pts`;
    }

    const meldTray = $('myMelds');
    meldTray.hidden = !state.players[0].melds.length;
    meldTray.innerHTML = state.players[0].melds.map((meld) => `<div class="meld-group"><span class="meld-name">${meld.kind.toUpperCase()}</span>${meld.tiles.map((t) => miniTile(t)).join('')}</div>`).join('');
    const active = state.active && state.current === 0 && ['draw', 'discard', 'claim'].includes(state.phase);
    $('turnIndicator').classList.toggle('active', active);
    $('turnIndicator').textContent = !state.active ? 'SELESAI' : state.phase === 'claim' ? 'KLAIM UBIN' : active ? 'GILIRANMU' : 'MENUNGGU';
    $('drawnNote').innerHTML = state.phase === 'draw' ? 'Tekan <strong>Ambil Ubin</strong> untuk memulai giliran.' :
      state.phase === 'discard' && state.current === 0 ? 'Pilih satu ubin untuk dibuang. Tangan lengkap akan membuka tombol <strong>Mahjong!</strong>' :
      state.phase === 'claim' ? 'Kesempatan untuk mengambil ubin yang baru dibuang lawan.' :
      !state.active ? 'Ronde telah berakhir. Mulai game baru untuk mencoba lagi.' : 'Tunggu giliran pemain berikutnya.';
  }

  function renderActions() {
    const bar = $('actionBar');
    bar.replaceChildren();
    if (!state.active) {
      bar.append(createButton('↻ Main Lagi', 'primary-action', startNewGame));
    } else if (state.current === 0 && state.phase === 'draw') {
      bar.append(createButton('✦ Ambil Ubin', 'primary-action', playerDraw));
    } else if (state.current === 0 && state.phase === 'discard') {
      const player = state.players[0];
      if (isWinningHand(player.hand, player.melds.length))
        bar.append(createButton('✿ MAHJONG! (Tsumo)', 'primary-action', () => endRound(0, 'Tsumo')));
      bar.append(createButton('Buang Ubin ↗', 'primary-action', playerDiscard, state.selected === null));
      const counts = countsFor(player.hand);
      counts.forEach((n, t) => {
        if (n >= 4 && state.wall.length)
          bar.append(createButton(`Kan: ${tileShort(t)}`, 'secondary-action', () => playerClosedKan(t)));
      });
    } else {
      bar.append(createButton('Menunggu giliran…', 'soft-action', () => {}, true));
    }
    const claimBar = $('claimBar');
    claimBar.hidden = state.phase !== 'claim' || !state.pending;
    if (claimBar.hidden) { claimBar.replaceChildren(); return; }
    const { discarder, tile, options } = state.pending;
    claimBar.innerHTML = `<div class="claim-heading"><strong>${NAMES[discarder]} membuang ${tileName(tile)}</strong><span>Pilih klaim atau lanjutkan giliran biasa.</span></div><div class="claim-options" id="claimOptions"></div>`;
    const choices = $('claimOptions');
    options.forEach((option, index) => {
      const name = option.kind === 'ron' ? '✿ RON — Mahjong!' : option.kind === 'chi' ? `CHI ${option.tiles.map(tileShort).join(' · ')}` : option.kind === 'pon' ? 'PON — Kembar 3' : 'KAN — Kembar 4';
      choices.append(createButton(name, 'claim-action', () => playerClaim(index)));
    });
    choices.append(createButton('Lewati', 'claim-action pass', passClaim));
  }

  function render() {
    if (!state.players.length) return;
    renderOpponents();
    renderDiscards();
    renderHand();
    renderActions();
    const left = state.wall.length;
    $('wallNumber').textContent = left;
    $('centerWall').textContent = left;
    $('wallProgress').style.width = `${Math.min(100, (left / 92) * 100)}%`;
    $('turnCounter').textContent = `GILIRAN ${state.turn}`;
    $('eventLog').innerHTML = state.log.slice(0, 8).map((event) => `<div class="event-line"><span class="event-dot">✦</span><span>${event}</span></div>`).join('');
  }

  function showModal({ icon, kicker, title, body, actions }) {
    $('modalIcon').textContent = icon;
    $('modalKicker').textContent = kicker;
    $('modalTitle').textContent = title;
    $('modalContent').innerHTML = body;
    $('modalActions').replaceChildren();
    actions.forEach((action) => {
      $('modalActions').append(createButton(action.text, action.primary ? '' : 'subtle', action.run));
    });
    $('overlay').hidden = false;
    $('modalClose').focus();
  }
  function closeModal() { $('overlay').hidden = true; }

  function showRules() {
    showModal({
      icon: '中',
      kicker: 'ATURAN MAHJONG VIRAL JAKARTA · 144 UBIN',
      title: 'Panduan Cara Bermain',
      body: `
        <p>Aturan ini disesuaikan dengan standar kafe & lounge Mahjong yang sedang viral di Jakarta (seperti di PIK, Senopati, Kelapa Gading) menggunakan format <strong>Hong Kong Mahjong 144 Ubin</strong>.</p>
        <ul class="modal-rules">
          <li><b>1. Set 144 Ubin Lengkap</b> Menggunakan 108 ubin angka (Wan, Pin, Sou), 28 ubin kehormatan (Angin Timur/Selatan/Barat/Utara & Naga Merah/Hijau/Putih), serta <b>8 Ubin Bunga & Musim</b> (梅 蘭 菊 竹 • 春 夏 秋 冬).</li>
          <li><b>2. Ubin Bunga & Musim Otomatis</b> Saat menarik ubin bunga, ubin otomatis dipajang dan kamu langsung mengambil ubin pengganti dari tembok. Bunga yang nomornya cocok dengan kursimu memberi <b>+1 Fan</b>!</li>
          <li><b>3. Syarat Menang (Mahjong / Hu)</b> Susun <b>4 kelompok (Chi / Pon / Kan) + 1 pasang ubin kembar</b> (total 14 ubin).</li>
          <li><b>4. Klaim Ubin Buangan Lawan</b>
            <br>• <b>Chi</b>: 3 angka berurutan sejenis (hanya dari pemain sebelah kiri).
            <br>• <b>Pon</b>: 3 ubin kembar identik (dari siapa saja).
            <br>• <b>Kan</b>: 4 ubin kembar identik (dari siapa saja atau tertutup, mendapat ubin pengganti).
          </li>
          <li><b>5. Sistem Nilai Fan (Hong Kong Scoring)</b>
            <br>• <b>Tsumo</b> (menang ambil sendiri): +1 Fan
            <br>• <b>Bunga Kursi</b> (nomor bunga sesuai nomor kursi): +1 Fan
            <br>• <b>Ping Hu</b> (semua Chi runtun): +1 Fan
            <br>• <b>Pung Naga / Angin Kursi</b>: +1 Fan
            <br>• <b>Dui Dui Hu</b> (semua Pung kembar): +3 Fan
            <br>• <b>Hun Yi Se</b> (satu jenis angka + naga/angin): +3 Fan
            <br>• <b>Qing Yi Se</b> (satu jenis angka murni): +7 Fan
          </li>
          <li><b>6. Sistem Pembayaran Meja Lounge</b>
            <br>• <b>Ron</b>: Pemain yang membuang ubin (Shooter) membayar penuh kekalahan.
            <br>• <b>Tsumo</b>: Ketiga pemain lawan masing-masing membayar rata.
          </li>
          <li><b>7. Strictly No Gambling</b> Murni dimainkan sebagai rekreasi sosial, strategi, dan olahraga asah otak bersama teman.</li>
        </ul>
      `,
      actions: [{ text: 'Mengerti, ayo main!', primary: true, run: closeModal }]
    });
  }

  function confirmNewGame() {
    if (!state.active) { startNewGame(); return; }
    showModal({
      icon: '✧',
      kicker: 'RONDE BARU',
      title: 'Mulai ronde baru?',
      body: '<p>Susunan, buangan, dan giliran ronde ini akan direset. Tangan baru dari 144 ubin akan dibagikan untuk keempat pemain (saldo poin tetap berjalan).</p>',
      actions: [{ text: 'Batal', run: closeModal }, { text: 'Ya, Bagikan Ubin', primary: true, run: startNewGame }]
    });
  }

  function renderOnlineBar() {
    const bar = $('onlineBar');
    if (!bar) return;
    if (!onlineSession) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    $('onlineRoomCode').textContent = onlineSession.roomCode;
    $('onlineSeatName').textContent = WINDS[onlineSession.seat];
    $('fillBotsBtn').hidden = state.phase !== 'waiting';
    $('startOnlineGameBtn').hidden = state.phase !== 'waiting' || onlineSession.seat !== 0;
  }

  function applyServerGameState(s) {
    if (!onlineSession) return;
    state.active = s.phase !== 'waiting' && s.phase !== 'over';
    state.phase = s.phase === 'waiting' ? 'waiting' : s.phase;
    state.current = s.currentTurn === s.seat ? 0 : ((s.currentTurn - s.seat + 4) % 4);
    state.turn = s.turn;
    state.wall = Array(s.wallCount).fill(0);
    state.lastDiscard = s.lastDiscard ? {
      seat: (s.lastDiscard.seat - s.seat + 4) % 4,
      tile: s.lastDiscard.tile
    } : null;
    state.pending = s.pendingClaim;

    state.players[0] = {
      seat: 0,
      name: NAMES[0],
      hand: [...s.myHand],
      flowers: [...s.myFlowers],
      melds: [...s.myMelds],
      discards: state.players[0]?.discards || [],
      score: s.myScore
    };

    s.opponents.forEach((opp) => {
      const relSeat = (opp.seat - s.seat + 4) % 4;
      state.players[relSeat] = {
        seat: relSeat,
        name: opp.name,
        hand: Array(opp.tileCount).fill(0),
        flowers: [...opp.flowers],
        melds: [...opp.melds],
        discards: [...opp.discards],
        score: opp.score
      };
    });

    if (s.phase === 'waiting') {
      setStatus(`Meja Online #${s.roomCode}. Tunggu pemain lain atau tekan Isi Bot & Mulai Game.`);
    } else if (state.current === 0 && state.phase === 'draw') {
      setStatus('Giliranmu! Tekan Ambil Ubin.');
    } else if (state.current === 0 && state.phase === 'discard') {
      setStatus(isWinningHand(state.players[0].hand, state.players[0].melds.length) ? 'Mahjong! Tanganmu sudah lengkap.' : 'Pilih satu ubin lalu tekan Buang Ubin.');
    } else if (state.phase === 'claim' && s.pendingClaim) {
      setStatus(`Kesempatan klaim ${tileName(s.pendingClaim.tile)}!`);
    } else {
      setStatus(`Menunggu giliran lawan...`);
    }

    render();
    renderOnlineBar();
  }

  function handleServerGameOver(winnerSeat, fanSummary) {
    state.active = false;
    state.phase = 'over';
    const relWinner = (winnerSeat - (onlineSession?.seat || 0) + 4) % 4;
    const winnerName = relWinner === 0 ? 'Kamu' : (NAMES[relWinner] || `Pemain ${winnerSeat}`);
    showModal({
      icon: relWinner === 0 ? '✿' : WIND_SIGNS[winnerSeat],
      kicker: 'RONDE ONLINE SELESAI',
      title: relWinner === 0 ? 'Mahjong! Kamu menang!' : `${winnerName} menang!`,
      body: `
        <div class="winner-summary">
          <p><strong>${winnerName}</strong> memenangkan ronde meja online!</p>
          <div class="fan-box">
            <div class="fan-header"><span>RINCIAN FAN</span><strong>TOTAL: ${fanSummary.totalFan} FAN</strong></div>
            <div class="fan-items">${fanSummary.items.map((it) => `<div class="fan-row"><span>✦ ${it.name}</span><strong>+${it.fan} Fan</strong></div>`).join('')}</div>
          </div>
          <div class="winner-big">${fanSummary.basePoints.toLocaleString('id-ID')} <small style="font-size:14px;font-weight:normal;">poin dasar</small></div>
          <p class="table-disclaimer">Hasil kalkulasi resmi server online MahjongIn.</p>
        </div>
      `,
      actions: [
        {
          text: 'Mulai Ronde Berikutnya',
          primary: true,
          run: () => {
            closeModal();
            socket?.emit('game:start');
          }
        }
      ]
    });
  }

  function showOnlineLobby() {
    const isConn = socket?.connected;
    showModal({
      icon: '🌐',
      kicker: 'MULTIPLAYER ONLINE',
      title: 'Meja Mahjong Online',
      body: `
        <div class="lobby-box">
          <div class="server-status-box">
            <span class="live-dot ${isConn ? 'connected' : 'connecting'}"></span>
            <span><strong>Server:</strong> ${SERVER_URL} (${isConn ? 'Online' : 'Menghubungkan...'})</span>
          </div>

          <label style="font-size:11px;color:#ded1b2;"><strong>Nama Pemain:</strong></label>
          <input id="playerNameInput" class="lobby-input" placeholder="Masukkan namamu" value="${localStorage.getItem('mahjong-player-name') || 'Kamu'}" />

          <div style="margin-top:10px;">
            <strong style="color:#eedcb9;font-size:12px;">1. Buat Meja Baru (Host)</strong>
            <p style="font-size:11px;color:#a4bda8;margin:4px 0 8px;">Buat meja, dapatkan kode 4-karakter, dan bagikan ke teman.</p>
            <button id="modalCreateRoomBtn" class="primary-action" style="width:100%;">✦ Buat Meja Baru</button>
          </div>

          <div class="lobby-divider"><span>ATAU GABUNG MEJA</span></div>

          <div>
            <strong style="color:#eedcb9;font-size:12px;">2. Gabung Meja Teman</strong>
            <p style="font-size:11px;color:#a4bda8;margin:4px 0 8px;">Masukkan kode meja dari temanmu.</p>
            <div class="join-row">
              <input id="modalRoomCodeInput" class="lobby-input" placeholder="KODE (4 HURUF)" maxlength="4" style="text-transform:uppercase;letter-spacing:0.1em;font-weight:bold;" />
              <button id="modalJoinRoomBtn" class="secondary-action" style="white-space:nowrap;">Gabung ↗</button>
            </div>
          </div>
        </div>
      `,
      actions: [
        { text: 'Tutup', run: closeModal }
      ]
    });

    setTimeout(() => {
      $('modalCreateRoomBtn')?.addEventListener('click', () => {
        const name = ($('playerNameInput')?.value || '').trim() || 'Kamu';
        localStorage.setItem('mahjong-player-name', name);
        if (!socket?.connected) {
          alert('Belum terhubung ke server online. Tunggu sebentar (Render cold start)...');
          return;
        }
        socket.emit('room:create', { name });
      });

      $('modalJoinRoomBtn')?.addEventListener('click', () => {
        const name = ($('playerNameInput')?.value || '').trim() || 'Pemain';
        const roomCode = ($('modalRoomCodeInput')?.value || '').trim().toUpperCase();
        if (!roomCode || roomCode.length < 3) {
          alert('Masukkan kode meja yang valid (4 karakter).');
          return;
        }
        localStorage.setItem('mahjong-player-name', name);
        if (!socket?.connected) {
          alert('Belum terhubung ke server online. Tunggu sebentar (Render cold start)...');
          return;
        }
        socket.emit('room:join', { roomCode, name });
      });
    }, 50);
  }

  function updateServerStatus(status, text) {
    const dot = $('serverDot');
    const label = $('serverStatusText');
    if (!dot || !label) return;
    dot.className = `live-dot ${status}`;
    label.textContent = text;
  }

  function initSocket() {
    if (typeof io === 'undefined') {
      updateServerStatus('disconnected', 'OFFLINE (SOLO)');
      return;
    }
    updateServerStatus('connecting', 'MENGHUBUNGKAN...');
    try {
      socket = io(SERVER_URL, {
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('Berhasil terhubung ke server MahjongIn! Socket ID:', socket.id);
        updateServerStatus('connected', 'ONLINE • SIAP');
      });

      socket.on('disconnect', () => {
        console.log('Terputus dari server.');
        updateServerStatus('disconnected', 'TERPUTUS (SOLO)');
      });

      socket.on('connect_error', () => {
        updateServerStatus('disconnected', 'SERVER TIDUR (SOLO)');
      });

      socket.on('room:joined', ({ roomCode, seat }) => {
        onlineSession = { roomCode, seat };
        addLog(`Masuk meja online #${roomCode} sebagai kursi ${WINDS[seat]}.`);
        closeModal();
        renderOnlineBar();
      });

      socket.on('game:state', (serverState) => {
        applyServerGameState(serverState);
      });

      socket.on('game:over', ({ winner, fanSummary }) => {
        handleServerGameOver(winner, fanSummary);
      });

      socket.on('error', (msg) => {
        alert(msg);
      });
    } catch (err) {
      console.warn('Socket initialization failed:', err);
      updateServerStatus('disconnected', 'OFFLINE');
    }
  }

  $('rulesTop').addEventListener('click', showRules);
  $('rulesSide').addEventListener('click', showRules);
  $('newGame').addEventListener('click', confirmNewGame);
  $('modalClose').addEventListener('click', closeModal);
  $('overlay').addEventListener('click', (event) => { if (event.target === $('overlay')) closeModal(); });
  $('onlineBtn')?.addEventListener('click', showOnlineLobby);
  $('copyRoomBtn')?.addEventListener('click', () => {
    if (onlineSession) {
      navigator.clipboard?.writeText(onlineSession.roomCode);
      alert('Kode meja disalin: ' + onlineSession.roomCode);
    }
  });
  $('fillBotsBtn')?.addEventListener('click', () => socket?.emit('room:fill-bots'));
  $('startOnlineGameBtn')?.addEventListener('click', () => socket?.emit('game:start'));
  $('leaveRoomBtn')?.addEventListener('click', () => {
    onlineSession = null;
    $('onlineBar').hidden = true;
    startNewGame();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
    if (!$('overlay').hidden || !state.active) return;
    if (event.key.toLowerCase() === 'd' && state.phase === 'draw' && state.current === 0) playerDraw();
    if (event.key === 'Enter' && state.phase === 'discard' && state.selected !== null) playerDiscard();
  });
  startNewGame();
  initSocket();
})();
