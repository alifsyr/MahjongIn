/* Mahjong Garden: simplified 4-player Japanese-style Mahjong.
   No money, online connection, account, or external assets are involved. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const NAMES = ['Kamu', 'Hana', 'Kenji', 'Sora'];
  const WINDS = ['Timur', 'Selatan', 'Barat', 'Utara'];
  const WIND_SIGNS = ['東', '南', '西', '北'];
  const NUMBER_SIGNS = '一二三四五六七八九';
  const HONORS = ['東', '南', '西', '北', '中', '發', '白'];
  const HONOR_NAMES = ['Angin Timur', 'Angin Selatan', 'Angin Barat', 'Angin Utara', 'Naga Merah', 'Naga Hijau', 'Naga Putih'];
  const state = { players: [], wall: [], current: 0, phase: 'draw', selected: null,
    drawn: null, lastDiscard: null, pending: null, active: false, turn: 1,
    generation: 0, log: [], winner: null };

  const tileName = (t) => {
    if (t < 9) return `${t + 1} Karakter`;
    if (t < 18) return `${t - 8} Lingkaran`;
    if (t < 27) return `${t - 17} Bambu`;
    return HONOR_NAMES[t - 27];
  };
  const tileShort = (t) => {
    if (t < 9) return `${t + 1} Wan`;
    if (t < 18) return `${t - 8} Pin`;
    if (t < 27) return `${t - 17} Sou`;
    return HONOR_NAMES[t - 27];
  };
  function tileArt(t) {
    if (t < 9) return `<span>${NUMBER_SIGNS[t]}</span><span class="tile-minor">萬</span>`;
    if (t < 18) return `<span>${'①②③④⑤⑥⑦⑧⑨'[t - 9]}</span><span class="tile-minor">筒</span>`;
    if (t < 27) return `<span>${NUMBER_SIGNS[t - 18]}</span><span class="tile-minor">索</span>`;
    return HONORS[t - 27];
  }
  const tileColor = (t) => t < 9 ? 'blue' : t < 18 ? '' : t < 27 ? 'green' : t === 31 ? 'red' : t === 32 ? 'green' : t === 33 ? 'blue' : '';
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
    hand.forEach((t) => counts[t]++);
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

  function startNewGame() {
    closeModal();
    state.generation++;
    state.wall = shuffle(Array.from({ length: 34 }, (_, type) => Array(4).fill(type)).flat());
    state.players = NAMES.map((name, seat) => ({ seat, name, hand: [], discards: [], melds: [] }));
    for (let n = 0; n < 13; n++) for (let seat = 0; seat < 4; seat++) {
      state.players[seat].hand.push(state.wall.pop());
    }
    state.players.forEach((p) => sortHand(p.hand));
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
    addLog('Permainan dimulai. Kamu duduk di kursi Timur.');
    setStatus('Giliranmu: ambil satu ubin dari tumpukan.');
    render();
  }

  function drawFromWall(seat, replacement = false) {
    if (!state.wall.length) { finishDraw(); return null; }
    const tile = state.wall.pop();
    state.players[seat].hand.push(tile);
    sortHand(state.players[seat].hand);
    if (seat === 0) state.drawn = tile;
    if (replacement) addLog(`${NAMES[seat]} mengambil ubin pengganti Kan.`);
    return tile;
  }

  function playerDraw() {
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
    if (seat === discarder) return [];
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
    claimDiscard(0, discarder, tile, option);
  }

  function passClaim() {
    if (state.phase !== 'claim' || !state.pending) return;
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
    addLog(`${NAMES[winner]} menang melalui ${mode}!`);
    setStatus(`${NAMES[winner]} menang — ${mode}!`);
    render();
    const player = state.players[winner];
    const meldBonus = player.melds.filter((m) => m.kind === 'kan').length * 300;
    const points = 1000 + (mode === 'Tsumo' ? 500 : 0) + meldBonus;
    if (winner === 0) {
      try { localStorage.setItem('mahjong-riichi-wins', String((Number(localStorage.getItem('mahjong-riichi-wins')) || 0) + 1)); }
      catch (_e) { /* Record storage is optional. */ }
    }
    showModal({
      icon: winner === 0 ? '✿' : WIND_SIGNS[winner],
      kicker: 'RONDE SELESAI',
      title: winner === 0 ? 'Mahjong! Kamu menang!' : `${NAMES[winner]} menang!`,
      body: `<p><strong>${NAMES[winner]}</strong> menyelesaikan 4 kelompok dan 1 pasang melalui <strong>${mode}</strong>${discarder === null ? '' : ` dari buangan ${NAMES[discarder]}`}.</p><div class="winner-big">${points.toLocaleString('id-ID')}</div><div class="winner-stat">poin latihan • ${player.melds.length} kelompok terbuka • ${state.wall.length} ubin tersisa</div><p>Sistem poin ini disederhanakan, bukan skor resmi Riichi.</p>`,
      actions: [{ text: 'Main Lagi', primary: true, run: startNewGame }],
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
    showModal({ icon: '✧', kicker: 'RONDE SELESAI', title: 'Ronde berakhir seri',
      body: '<p>Semua ubin di tumpukan telah habis. Tidak ada pemain yang menyelesaikan kombinasi Mahjong.</p>',
      actions: [{ text: 'Coba Lagi', primary: true, run: startNewGame }] });
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
      container.innerHTML = `<span class="opp-avatar">${WIND_SIGNS[seat]}</span><div class="opp-info"><div class="opp-name">${player.name}</div><div class="opp-sub">${WINDS[seat]} · ${player.hand.length} ubin</div></div><div class="opp-backs">${backs}</div>${melds ? `<div class="opp-melds">${melds}</div>` : ''}`;
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
    $('wallProgress').style.width = `${left / 84 * 100}%`;
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
    showModal({ icon: '中', kicker: 'ATURAN RIICHI SEDERHANA', title: 'Cara bermain',
      body: `<p>Mahjong dimainkan <strong>4 orang</strong>. Kamu di kursi Timur melawan tiga bot. Targetnya melengkapi <strong>4 kelompok + 1 pasangan</strong>.</p>
        <ul class="modal-rules"><li><b>1. Ambil & buang</b> Ambil satu ubin saat giliranmu, pilih satu yang tidak dibutuhkan, lalu tekan Buang Ubin.</li>
        <li><b>2. Chi (Chow)</b> Ambil buangan pemain tepat sebelum giliranmu untuk menyusun 3 angka berurutan dalam jenis yang sama.</li>
        <li><b>3. Pon (Pung)</b> Ambil buangan siapa pun untuk membuat 3 ubin identik.</li>
        <li><b>4. Kan (Kong)</b> Buat 4 ubin identik. Kamu akan langsung mendapat ubin pengganti.</li>
        <li><b>5. Ron / Tsumo</b> Menang dengan buangan lawan disebut Ron, dengan ubin yang kamu ambil sendiri disebut Tsumo.</li></ul>
        <p>Ini versi belajar: tanpa syarat yaku, furiten, dora, atau penghitungan skor Riichi resmi. Bot dapat mengklaim buangan, dan 136 ubin digunakan tanpa bunga.</p>`,
      actions: [{ text: 'Mengerti, ayo main!', primary: true, run: closeModal }] });
  }

  function confirmNewGame() {
    if (!state.active) { startNewGame(); return; }
    showModal({ icon: '✧', kicker: 'RONDE BARU', title: 'Mulai permainan baru?',
      body: '<p>Susunan, buangan, dan giliran ronde ini akan direset. Tangan baru akan dibagikan untuk keempat pemain.</p>',
      actions: [{ text: 'Batal', run: closeModal }, { text: 'Ya, Bagikan Ubin', primary: true, run: startNewGame }] });
  }

  $('rulesTop').addEventListener('click', showRules);
  $('rulesSide').addEventListener('click', showRules);
  $('newGame').addEventListener('click', confirmNewGame);
  $('modalClose').addEventListener('click', closeModal);
  $('overlay').addEventListener('click', (event) => { if (event.target === $('overlay')) closeModal(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
    if (!$('overlay').hidden || !state.active) return;
    if (event.key.toLowerCase() === 'd' && state.phase === 'draw' && state.current === 0) playerDraw();
    if (event.key === 'Enter' && state.phase === 'discard' && state.selected !== null) playerDiscard();
  });
  startNewGame();
})();
