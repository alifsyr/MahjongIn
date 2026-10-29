/* Mahjong Jakarta Lounge: 4-player Hong Kong style Mahjong (144 tiles).
   Implements 144 tiles including 8 flowers/seasons, automatic flower replacement,
   and Hong Kong Fan scoring with table chip transfer (shooter vs tsumo).
   Purely recreational board game with no real money or gambling involved. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const NAMES = ['Kamu', 'Hana', 'Kenji', 'Sora'];
  const WINDS = ['East', 'South', 'West', 'North'];
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

  const WAN_CHARS = ['一', '二', '三', '四', '伍', '六', '七', '八', '九'];

  const cDot = (cx, cy, r, col, inner = '#ffffff') =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" stroke="#0f2b1d" stroke-width="0.5"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="none" stroke="${inner}" stroke-width="0.75"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.18).toFixed(1)}" fill="${col}"/>`;

  const cStick = (cx, cy, w, h, col) => {
    const r = (w / 2).toFixed(1);
    const top = (cy - h / 2).toFixed(1);
    return `<rect x="${(cx - w / 2).toFixed(1)}" y="${top}" width="${w}" height="${h}" rx="${r}" fill="${col}" stroke="#0e2a1e" stroke-width="0.5"/><line x1="${(cx - w / 2).toFixed(1)}" y1="${cy}" x2="${(cx + w / 2).toFixed(1)}" y2="${cy}" stroke="#ffffff" stroke-width="0.7"/><circle cx="${cx}" cy="${cy}" r="0.8" fill="#ffffff"/>`;
  };

  function tileArt(t) {
    let inner = '';
    if (t < 9) {
      inner = `<text x="18" y="21" font-family="'Songti SC','Noto Serif CJK SC','STSong',serif" font-size="20" font-weight="900" fill="#173b6c" text-anchor="middle">${WAN_CHARS[t]}</text><text x="18" y="42" font-family="'Songti SC','Noto Serif CJK SC','STSong',serif" font-size="20" font-weight="900" fill="#be2020" text-anchor="middle">萬</text>`;
    } else if (t === 9) {
      let petals = '';
      for (let a = 0; a < 8; a++) {
        const rad = (a * Math.PI) / 4;
        const px = (18 + Math.cos(rad) * 9.5).toFixed(1);
        const py = (24 + Math.sin(rad) * 9.5).toFixed(1);
        petals += `<circle cx="${px}" cy="${py}" r="2.2" fill="#1a783d"/>`;
      }
      inner = `<circle cx="18" cy="24" r="13" fill="#be2020" stroke="#0f2b1d" stroke-width="0.8"/><circle cx="18" cy="24" r="10.5" fill="#f7f3e8" stroke="#1a783d" stroke-width="0.6"/>${petals}<circle cx="18" cy="24" r="6" fill="#1a783d"/><circle cx="18" cy="24" r="4.2" fill="#be2020"/><circle cx="18" cy="24" r="1.8" fill="#ffffff"/>`;
    } else if (t === 10) {
      inner = cDot(18, 14, 6.5, '#1a783d') + cDot(18, 34, 6.5, '#1b4e8c');
    } else if (t === 11) {
      inner = cDot(10, 12, 4.5, '#1b4e8c') + cDot(18, 24, 4.5, '#be2020') + cDot(26, 36, 4.5, '#1a783d');
    } else if (t === 12) {
      inner = cDot(11, 14, 4.5, '#1b4e8c') + cDot(25, 14, 4.5, '#1a783d') + cDot(11, 34, 4.5, '#1a783d') + cDot(25, 34, 4.5, '#1b4e8c');
    } else if (t === 13) {
      inner = cDot(10, 13, 4.2, '#1b4e8c') + cDot(26, 13, 4.2, '#1a783d') + cDot(18, 24, 5.2, '#be2020') + cDot(10, 35, 4.2, '#1a783d') + cDot(26, 35, 4.2, '#1b4e8c');
    } else if (t === 14) {
      inner = cDot(12, 13, 4.5, '#1a783d') + cDot(24, 13, 4.5, '#1a783d') + cDot(12, 27, 4.2, '#be2020') + cDot(24, 27, 4.2, '#be2020') + cDot(12, 38, 4.2, '#be2020') + cDot(24, 38, 4.2, '#be2020');
    } else if (t === 15) {
      inner = cDot(10, 10, 3.8, '#1a783d') + cDot(18, 15, 3.8, '#1a783d') + cDot(26, 20, 3.8, '#1a783d') + cDot(12, 30, 4.2, '#be2020') + cDot(24, 30, 4.2, '#be2020') + cDot(12, 40, 4.2, '#be2020') + cDot(24, 40, 4.2, '#be2020');
    } else if (t === 16) {
      inner = [9, 19, 29, 39].map((y) => cDot(12, y, 3.8, '#1b4e8c') + cDot(24, y, 3.8, '#1b4e8c')).join('');
    } else if (t === 17) {
      inner = [11, 24, 37].map((y) => cDot(9, y, 3.8, '#1a783d') + cDot(18, y, 3.8, '#be2020') + cDot(27, y, 3.8, '#1b4e8c')).join('');
    } else if (t === 18) {
      inner = `<path d="M 6 39 Q 18 36 30 39" stroke="#1a783d" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="37.5" r="1.5" fill="#f7f3e8"/><path d="M 17 12 Q 15 6 12 7 M 18 11 Q 19 5 18 5 M 19 12 Q 23 6 24 8" stroke="#be2020" stroke-width="1.2" stroke-linecap="round" fill="none"/><path d="M 13 28 Q 7 35 11 43 Q 14 36 16 30" fill="#1a783d"/><circle cx="10.5" cy="39" r="1.5" fill="#be2020"/><path d="M 13 22 Q 13 14 18 14 Q 22 14 22 20 Q 23 27 18 30 Q 14 30 13 22 Z" fill="#1a783d"/><path d="M 16 19 Q 21 17 21 24 Q 21 28 17 29 Z" fill="#be2020"/><circle cx="20.5" cy="16.5" r="1.2" fill="#111"/><polygon points="22.5,15.5 27,17 22.5,18.5" fill="#d88b14"/>`;
    } else if (t === 19) {
      inner = cStick(18, 15, 4, 15, '#1a783d') + cStick(18, 33, 4, 15, '#1b4e8c');
    } else if (t === 20) {
      inner = cStick(18, 14, 4, 14, '#1b4e8c') + cStick(12, 33, 4, 14, '#1a783d') + cStick(24, 33, 4, 14, '#1a783d');
    } else if (t === 21) {
      inner = cStick(12, 16, 3.6, 14, '#1a783d') + cStick(12, 32, 3.6, 14, '#1b4e8c') + cStick(24, 16, 3.6, 14, '#1b4e8c') + cStick(24, 32, 3.6, 14, '#1a783d');
    } else if (t === 22) {
      inner = cStick(11, 15, 3.4, 13, '#1a783d') + cStick(25, 15, 3.4, 13, '#1b4e8c') + cStick(18, 24, 4, 16, '#be2020') + cStick(11, 33, 3.4, 13, '#1b4e8c') + cStick(25, 33, 3.4, 13, '#1a783d');
    } else if (t === 23) {
      inner = [10, 18, 26].map((x) => cStick(x, 15, 3.4, 13, '#1a783d')).join('') + [10, 18, 26].map((x) => cStick(x, 33, 3.4, 13, '#1b4e8c')).join('');
    } else if (t === 24) {
      inner = cStick(18, 13, 4, 13, '#be2020') + [10, 18, 26].map((x) => cStick(x, 26, 3.4, 11, x === 18 ? '#1b4e8c' : '#1a783d')).join('') + [10, 18, 26].map((x) => cStick(x, 38, 3.4, 11, x === 18 ? '#1a783d' : '#1b4e8c')).join('');
    } else if (t === 25) {
      inner = [9, 15, 21, 27].map((x, i) => cStick(x, 15, 3.4, 13, i % 2 ? '#1b4e8c' : '#1a783d')).join('') + [9, 15, 21, 27].map((x, i) => cStick(x, 33, 3.4, 13, i % 2 ? '#1a783d' : '#1b4e8c')).join('');
    } else if (t === 26) {
      inner = [12, 24, 36].map((y) => cStick(10, y, 3.4, 11, '#1a783d') + cStick(18, y, 3.4, 11, '#be2020') + cStick(26, y, 3.4, 11, '#1b4e8c')).join('');
    } else if (t >= 27 && t <= 30) {
      inner = `<text x="18" y="34" font-family="'Songti SC','Noto Serif CJK SC','STSong',serif" font-size="28" font-weight="900" fill="#142c4b" text-anchor="middle">${WIND_SIGNS[t - 27]}</text>`;
    } else if (t === 31) {
      inner = `<text x="18" y="34" font-family="'Songti SC','Noto Serif CJK SC','STSong',serif" font-size="28" font-weight="900" fill="#be2020" text-anchor="middle">中</text>`;
    } else if (t === 32) {
      inner = `<text x="18" y="34" font-family="'Songti SC','Noto Serif CJK SC','STSong',serif" font-size="26" font-weight="900" fill="#18783d" text-anchor="middle">發</text>`;
    } else if (t === 33) {
      inner = `<rect x="5.5" y="7.5" width="25" height="33" rx="3.5" fill="none" stroke="#1b4e8c" stroke-width="2.4"/><rect x="9" y="11" width="18" height="26" rx="2" fill="none" stroke="#1b4e8c" stroke-width="1"/>`;
    } else if (t >= 34 && t <= 41) {
      const num = ((t - 34) % 4) + 1;
      const sign = FLOWER_SIGNS[t - 34];
      const isSeason = t >= 38;
      const badgeCol = isSeason ? '#1b4e8c' : '#be2020';
      let art = '';
      if (t === 34) {
        art = `<circle cx="18" cy="29" r="6" fill="#be2020"/><circle cx="14" cy="25" r="4.5" fill="#d93b3b"/><circle cx="22" cy="25" r="4.5" fill="#d93b3b"/><circle cx="18" cy="29" r="2.2" fill="#ffd54f"/>`;
      } else if (t === 35) {
        art = `<path d="M 18 38 Q 17 28 20 22 M 18 34 Q 13 30 11 25" stroke="#1a783d" stroke-width="1.5" fill="none"/><ellipse cx="20" cy="22" rx="4.5" ry="3.5" fill="#8e24aa"/><circle cx="20" cy="22" r="1.5" fill="#ffca28"/>`;
      } else if (t === 36) {
        art = `<circle cx="18" cy="28" r="7.5" fill="#f57f17"/><circle cx="18" cy="28" r="5" fill="#fbc02d"/><circle cx="18" cy="28" r="2.5" fill="#fff9c4"/>`;
      } else if (t === 37) {
        art = `<line x1="16" y1="39" x2="16" y2="19" stroke="#1a783d" stroke-width="2.5"/><line x1="20" y1="39" x2="20" y2="23" stroke="#2e7d32" stroke-width="2"/><path d="M 16 26 Q 10 23 8 20 M 16 31 Q 23 27 25 24" stroke="#1a783d" stroke-width="1.5" fill="none"/>`;
      } else if (t === 38) {
        art = `<circle cx="18" cy="25" r="6.5" fill="#fbc02d"/><path d="M 18 39 Q 18 31 16 28 M 18 35 Q 23 32 25 30" stroke="#1a783d" stroke-width="1.8" fill="none"/>`;
      } else if (t === 39) {
        art = `<ellipse cx="18" cy="35" rx="9" ry="3" fill="#2e7d32"/><ellipse cx="18" cy="27" rx="6" ry="5" fill="#e91e63"/><circle cx="18" cy="27" r="2" fill="#ffeb3b"/>`;
      } else if (t === 40) {
        art = `<path d="M 18 39 L 18 20 M 18 25 L 12 21 M 18 29 L 24 25 M 18 33 L 13 31" stroke="#e65100" stroke-width="1.8" stroke-linecap="round"/><polygon points="18,18 14,23 22,23" fill="#f57c00"/>`;
      } else if (t === 41) {
        art = `<line x1="18" y1="21" x2="18" y2="37" stroke="#0288d1" stroke-width="1.8"/><line x1="10" y1="29" x2="26" y2="29" stroke="#0288d1" stroke-width="1.8"/><line x1="12" y1="23" x2="24" y2="35" stroke="#0288d1" stroke-width="1.5"/><line x1="12" y1="35" x2="24" y2="23" stroke="#0288d1" stroke-width="1.5"/><circle cx="18" cy="29" r="2" fill="#b3e5fc"/>`;
      }
      inner = `<rect x="2" y="2" width="13" height="15" rx="3" fill="${badgeCol}"/><text x="8.5" y="14" font-family="-apple-system,BlinkMacSystemFont,Inter,sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">${num}</text><text x="26.5" y="14.5" font-family="'Songti SC','Noto Serif CJK SC','STSong',serif" font-size="14" font-weight="900" fill="${badgeCol}" text-anchor="middle">${sign}</text>${art}`;
    }
    return `<svg viewBox="0 0 36 48" class="tile-face" aria-hidden="true">${inner}</svg>`;
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

  function playerPromotedKan(tile) {
    if (state.current !== 0 || state.phase !== 'discard' || !state.wall.length) return;
    const player = state.players[0];
    const meld = player.melds.find((m) => m.kind === 'pon' && m.tiles[0] === tile);
    if (!meld || countsFor(player.hand)[tile] < 1) return;
    removeTiles(player.hand, [tile]);
    meld.kind = 'kan';
    meld.tiles.push(tile);
    state.drawn = null;
    state.selected = null;
    addLog(`Kamu melakukan Kan tambah (${tileShort(tile)}).`);
    if (drawFromWall(0, true) === null) return;
    setStatus('Kan tambah berhasil. Kamu mengambil ubin pengganti.');
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
    setStatus(`${NAMES[winner]} menang: ${mode} (${totalFan} Fan)!`);
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
    setStatus('Ronde seri: tidak ada ubin tersisa.');
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
      const isDc = !!onlineSession && player.isConnected === false;
      container.classList.toggle('current', state.current === seat && state.active);
      container.classList.toggle('disconnected', isDc);
      container.classList.toggle('player-disconnected', isDc);

      const isCurrentTurn = state.current === seat && state.active && (state.phase === 'discard' || state.phase === 'bot');
      const backs = Array.from({ length: player.hand.length }, (_, i) => {
        const isDrawn = isCurrentTurn && i === player.hand.length - 1;
        return `<i class="tile-back${isDrawn ? ' drawn' : ''}"></i>`;
      }).join('');

      const melds = player.melds.map((meld) => `<span class="opp-meld-item">${meld.tiles.map((t) => miniTile(t)).join('')}</span>`).join('');
      const flowers = player.flowers.length ? `<div class="opp-flowers" title="Flower Tiles: ${player.flowers.length}"><span class="flower-icon">🌸</span>${player.flowers.map((t) => miniTile(t)).join('')}</div>` : '';
      const dcTag = isDc ? '<span class="opp-dc-tag">(Terputus...)</span>' : '';
      const turnStatus = isCurrentTurn ? '<span class="opp-turn-bubble">Thinking...</span>' : '';

      container.innerHTML = `
        <div class="opp-profile">
          <div class="opp-avatar-ring">
            <span class="opp-avatar">${WIND_SIGNS[seat]}</span>
            <span class="opp-level">Lv.${seat * 3 + 2}</span>
            <span class="opp-card-badge" title="${player.hand.length} Ubin Tersisa">${player.hand.length}</span>
            ${turnStatus}
          </div>
          <div class="opp-info">
            <div class="opp-name">${player.name}${dcTag}</div>
            <div class="opp-score-pill">🪙 <strong class="opp-score">${player.score.toLocaleString('id-ID')} pts</strong></div>
            <div class="opp-seat-tag">${WINDS[seat]} Seat</div>
          </div>
        </div>
        <div class="opp-rack">
          <div class="opp-backs" title="${player.hand.length} Tiles (Concealed)">${backs}</div>
          ${(melds || flowers) ? `<div class="opp-exposed">${melds ? `<div class="opp-melds">${melds}</div>` : ''}${flowers}</div>` : ''}
        </div>
      `;
    }
  }

  function renderDiscards() {
    const placement = [0, 1, 2, 3];
    for (const seat of placement) {
      const discards = state.players[seat].discards;
      const recent = discards.slice(-15);
      const html = recent.map((t, idx) => miniTile(t, idx === recent.length - 1 && state.lastDiscard?.seat === seat && state.lastDiscard?.tile === t)).join('');
      $(`discard${seat}`).innerHTML = `<label>${WINDS[seat]} · ${discards.length}</label><div class="discard-tiles">${html}</div>`;
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
      btn.setAttribute('aria-label', `${tileName(t)}${isDrawn ? ', drawn tile' : ''}`);
      btn.setAttribute('aria-pressed', String(state.selected === index));
      btn.disabled = !state.active || state.phase !== 'discard' || state.current !== 0;
      btn.addEventListener('click', () => {
        if (state.phase !== 'discard' || state.current !== 0) return;
        if (state.selected === index) {
          playerDiscard();
        } else {
          state.selected = index;
          renderHand();
          renderActions();
        }
      });
      btn.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (state.phase !== 'discard' || state.current !== 0) return;
        state.selected = index;
        playerDiscard();
      });
      container.appendChild(btn);
    });
    $('handCount').textContent = `${hand.length} Tiles`;

    const myFlowers = $('myFlowers');
    if (myFlowers) {
      myFlowers.hidden = !state.players[0].flowers.length;
      myFlowers.innerHTML = `<span class="flower-badge">🌸 Flowers (${state.players[0].flowers.length}):</span> ${state.players[0].flowers.map((t) => miniTile(t)).join('')}`;
    }

    const myScore = $('myScoreDisplay');
    if (myScore) {
      myScore.textContent = `${state.players[0].score.toLocaleString('id-ID')} pts`;
    }
    const topPoints = $('topbarPoints');
    if (topPoints) {
      topPoints.textContent = state.players[0].score.toLocaleString('id-ID');
    }
    const myNameDisplay = $('myPlayerNameDisplay');
    if (myNameDisplay) {
      myNameDisplay.textContent = state.players[0].name || (typeof playerName !== 'undefined' && playerName ? playerName : 'Kamu');
    }

    const meldTray = $('myMelds');
    meldTray.hidden = !state.players[0].melds.length;
    meldTray.innerHTML = state.players[0].melds.map((meld) => `<div class="meld-group"><span class="meld-name">${meld.kind.toUpperCase()}</span>${meld.tiles.map((t) => miniTile(t)).join('')}</div>`).join('');
    const active = state.active && state.current === 0 && ['draw', 'discard', 'claim'].includes(state.phase);
    $('turnIndicator').classList.toggle('active', active);
    $('turnIndicator').textContent = !state.active ? 'ROUND OVER' : state.phase === 'claim' ? 'CLAIM' : active ? 'YOUR TURN' : 'WAITING';
    $('drawnNote').innerHTML = state.phase === 'draw' ? 'Draw a tile from the wall to begin your turn.' :
      state.phase === 'discard' && state.current === 0 ? (state.selected === null ? 'Click a tile to select, or double-click to discard.' : `Selected: <strong>${tileName(displayedHand()[state.selected])}</strong> · Click Discard or tap tile again.`) :
      state.phase === 'claim' ? `Claim opportunity from ${NAMES[state.pending?.discarder]}! Choose action in dock or Pass.` :
      !state.active ? 'Round complete. Click New Round to play again.' : `Waiting for ${NAMES[state.current]}...`;
  }

  function renderActions() {
    const bar = $('actionBar');
    bar.replaceChildren();
    if (!state.active) {
      bar.append(createButton('↻ Play Again', 'primary-action btn-playagain', startNewGame));
    } else if (state.current === 0 && state.phase === 'draw') {
      bar.append(createButton('✦ Draw', 'primary-action btn-draw', playerDraw));
    } else if (state.current === 0 && state.phase === 'discard') {
      const player = state.players[0];
      const canWinTsumo = onlineSession ? !!state.canTsumo : isWinningHand(player.hand, player.melds.length);
      if (canWinTsumo) {
        bar.append(createButton('✿ MAHJONG! (Tsumo)', 'primary-action btn-tsumo', () => {
          if (onlineSession) {
            setStatus('Mendeklarasikan Tsumo...');
            socket?.emit('game:tsumo');
          } else {
            endRound(0, 'Tsumo');
          }
        }));
      }
      bar.append(createButton('Discard', 'primary-action btn-discard', playerDiscard, state.selected === null));
      if (onlineSession) {
        const kongTiles = Array.isArray(state.canKongTiles) ? state.canKongTiles : [];
        kongTiles.forEach((t) => {
          bar.append(createButton(`Kan: ${tileShort(t)}`, 'secondary-action btn-kan', () => {
            setStatus('Mendeklarasikan Kan...');
            socket?.emit('game:kong', { tile: t });
          }));
        });
      } else {
        const counts = countsFor(player.hand);
        counts.forEach((n, t) => {
          if (n >= 4 && state.wall.length)
            bar.append(createButton(`Kan: ${tileShort(t)}`, 'secondary-action btn-kan', () => playerClosedKan(t)));
        });
        player.melds.forEach((m) => {
          if (m.kind === 'pon') {
            const t = m.tiles[0];
            if (counts[t] >= 1 && state.wall.length)
              bar.append(createButton(`Kan: ${tileShort(t)}`, 'secondary-action btn-kan', () => playerPromotedKan(t)));
          }
        });
      }
    } else if (state.phase === 'claim' && state.pending) {
      const { discarder, tile, options } = state.pending;
      options.forEach((option, index) => {
        const name = option.kind === 'ron' ? '✿ RON (Mahjong!)' :
                     option.kind === 'chi' ? `CHI ${option.tiles.map(tileShort).join('·')}` :
                     option.kind === 'pon' ? 'PON' : 'KAN';
        const kindCls = option.kind === 'ron' ? 'btn-ron' : option.kind === 'chi' ? 'btn-chi' : 'btn-pon';
        bar.append(createButton(name, `primary-action ${kindCls}`, () => playerClaim(index)));
      });
      bar.append(createButton('Pass', 'secondary-action btn-pass', passClaim));
    } else {
      bar.append(createButton('Waiting...', 'soft-action btn-waiting', () => {}, true));
    }
    const claimBar = $('claimBar');
    claimBar.hidden = state.phase !== 'claim' || !state.pending;
    if (claimBar.hidden) { claimBar.replaceChildren(); return; }
    const { discarder, tile } = state.pending;
    claimBar.innerHTML = `<div class="claim-heading"><strong>${NAMES[discarder]} discards ${tileName(tile)}!</strong><span>Choose action in dock on the right or Pass.</span></div>`;
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
    const deadWall = state.deadWallCount !== undefined ? state.deadWallCount : 14;
    if ($('deadWallCount')) $('deadWallCount').textContent = deadWall;
    if ($('centerDeadWall')) $('centerDeadWall').textContent = `DW: ${deadWall}`;
    $('wallProgress').style.width = `${Math.min(100, (left / 92) * 100)}%`;
    $('turnCounter').textContent = `TURN ${state.turn}`;
    $('eventLog').innerHTML = state.log.slice(0, 8).map((event) => `<div class="event-line"><span class="event-dot">✦</span><span>${event}</span></div>`).join('');
  }

  function showModal({ icon, kicker, title, body, actions }) {
    $('modalIcon').textContent = icon;
    $('modalKicker').textContent = kicker;
    $('modalTitle').textContent = title;
    $('modalContent').innerHTML = body;
    $('modalActions').replaceChildren();
    actions.forEach((action) => {
      $('modalActions').append(createButton(action.text, action.primary ? '' : 'subtle', action.run, !!action.disabled));
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
      actions: [
        { text: '✦ Mulai Tutorial Interaktif', primary: true, run: startTutorialSafe },
        { text: 'Tutup', run: closeModal }
      ]
    });
  }

  function leaveOnlineRoom() {
    onlineSession = null;
    try {
      localStorage.removeItem('mahjongin_session');
    } catch (_) {}
    const bar = $('onlineBar');
    if (bar) bar.hidden = true;
  }

  function startTutorialSafe() {
    if (onlineSession) {
      if (!confirm('Kamu sedang berada di room online aktif. Keluar dari room untuk memulai tutorial?')) {
        return;
      }
      leaveOnlineRoom();
    }
    TutorialManager.start();
  }

  function renderTutorialTileBtn(t, isSelected, index, customAttr = '') {
    const col = tileColor(t);
    const label = tileName(t);
    const sel = isSelected ? 'selected' : '';
    return `<button type="button" class="tutorial-tile-btn ${col} ${sel}" data-idx="${index}" ${customAttr} title="${label}" aria-label="${label}">${tileArt(t)}</button>`;
  }

  function renderTutorialStepBar(step) {
    const pct = Math.round(((step + 1) / 8) * 100);
    return `
      <div class="tutorial-step-bar">
        <span class="tutorial-step-badge">LANGKAH ${step + 1} DARI 8</span>
        <div class="tutorial-progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="tutorial-progress-fill" style="width: ${pct}%"></div>
        </div>
        <span class="tutorial-step-badge">${pct}%</span>
      </div>
    `;
  }

  const TutorialManager = {
    active: false,
    step: 0,
    substep: 0,
    selectedTiles: [],
    lastHint: null,
    validated: false,
    quizSelected: null,

    isActive() {
      return this.active;
    },

    start(step = 0) {
      this.active = true;
      this.step = step;
      this.substep = 0;
      this.selectedTiles = [];
      this.lastHint = null;
      this.validated = false;
      this.quizSelected = null;
      this.render();
    },

    stop() {
      this.active = false;
    },

    next() {
      if (this.step < 7) {
        this.step++;
        this.substep = 0;
        this.selectedTiles = [];
        this.lastHint = null;
        this.validated = false;
        this.quizSelected = null;
        this.render();
      } else {
        this.complete();
      }
    },

    prev() {
      if (this.step > 0) {
        this.step--;
        this.substep = 0;
        this.selectedTiles = [];
        this.lastHint = null;
        this.validated = false;
        this.quizSelected = null;
        this.render();
      }
    },

    skip() {
      localStorage.setItem('mahjong-tutorial-dismissed', 'true');
      this.stop();
      closeModal();
      const banner = $('tutorialBanner');
      if (banner) banner.hidden = true;
    },

    complete() {
      localStorage.setItem('mahjong-tutorial-completed', 'true');
      this.stop();
      closeModal();
      const banner = $('tutorialBanner');
      if (banner) banner.hidden = true;
      startNewGame();
    },

    render() {
      const stepIcons = ['🀄', '東', '⚡', '🌸', '↻', '⚡', '🏆', '💰'];
      const stepKickers = [
        'TUTORIAL INTERAKTIF · LANGKAH 1 DARI 8',
        'TUTORIAL INTERAKTIF · LANGKAH 2 DARI 8',
        'TUTORIAL INTERAKTIF · LANGKAH 3 DARI 8',
        'TUTORIAL INTERAKTIF · LANGKAH 4 DARI 8',
        'TUTORIAL INTERAKTIF · LANGKAH 5 DARI 8',
        'TUTORIAL INTERAKTIF · LANGKAH 6 DARI 8',
        'TUTORIAL INTERAKTIF · LANGKAH 7 DARI 8',
        'TUTORIAL INTERAKTIF · LANGKAH 8 DARI 8'
      ];
      const stepTitles = [
        '1. Target Menang: 4 Melds + 1 Pair',
        '2. Mengenal 144 Tiles',
        '3. Membentuk Set (Chi, Pon, Kan)',
        '4. Tiles Bunga & Musim (Bonus Fan)',
        '5. Alur Giliran (Draw & Discard)',
        '6. Mengklaim Discard Lawan',
        '7. Kemenangan (Ron vs Tsumo) & Fan',
        '8. Perhitungan Skor & Aturan Shooter'
      ];

      let bodyHtml = renderTutorialStepBar(this.step);

      if (this.step === 0) {
        const tiles = [0, 1, 2, 12, 13, 14, 24, 25, 26, 31, 31, 31, 27, 27];
        const tilesHtml = tiles.map((t, idx) =>
          renderTutorialTileBtn(t, this.selectedTiles.includes(idx), idx)
        ).join('');
        let fbClass = 'neutral';
        let fbText = 'Pilih 2 tiles kembar identik yang berfungsi sebagai Pair (Mata).';
        if (this.selectedTiles.length === 2) {
          if (this.selectedTiles.includes(12) && this.selectedTiles.includes(13)) {
            fbClass = 'success';
            fbText = 'Tepat sekali! Dua tile Angin Timur ini adalah Pair (Mata) yang melengkapi 4 Melds menjadi 14 tiles kemenangan.';
          } else {
            fbClass = 'hint';
            fbText = 'Tile ini bagian dari Meld (set 3 tile). Cari 2 tile kembar identik yang berdiri sebagai Pair (Mata).';
          }
        }
        bodyHtml += `
          <div class="tutorial-desc">Dalam Mahjong, kamu memegang 13 tiles di Hand. Kamu menang saat berhasil mengumpulkan <strong>4 kelompok (Melds) + 1 pasang kembar identik (Pair / Mata)</strong> sehingga total menjadi 14 tiles.</div>
          <div class="tutorial-practice-card">
            <div class="tutorial-task-title"><span>✦</span> LATIHAN: TEMUKAN PAIR (MATA)</div>
            <div class="tutorial-task-desc">Di bawah adalah 14 tiles susunan menang (4 melds + 1 pair). Klik 2 tiles kembar identik yang menjadi Pair (Mata):</div>
            <div class="tutorial-tiles-wrap" id="tutTilesContainer">${tilesHtml}</div>
            <div id="tutFeedback" class="tutorial-feedback ${fbClass}">${fbText}</div>
          </div>
        `;
      } else if (this.step === 1) {
        const tiles = [0, 31, 13, 32, 22, 33, 27];
        const tilesHtml = tiles.map((t, idx) =>
          renderTutorialTileBtn(t, this.selectedTiles.includes(idx), idx)
        ).join('');
        let fbClass = 'neutral';
        let fbText = 'Pilih ketiga tile Naga (Merah, Hijau, Putih).';
        if (this.lastHint) {
          fbClass = 'hint';
          fbText = this.lastHint;
        }
        if (this.validated) {
          fbClass = 'success';
          fbText = 'Mantap! Tiga Naga (Merah, Hijau, Putih) adalah Honor Tiles bernilai tinggi yang bisa memberi Fan bonus.';
        }
        bodyHtml += `
          <div class="tutorial-desc">Mahjong Jakarta menggunakan 144 tiles: 3 suit <strong>Number Tiles</strong> (Wan/Karakter, Pin/Lingkaran, Sou/Bambu) angka 1-9 (masing-masing 4 copy), <strong>Honor Tiles</strong> (4 Angin & 3 Naga), serta <strong>8 Bunga & Musim</strong>.</div>
          <div class="tutorial-practice-card">
            <div class="tutorial-task-title"><span>✦</span> LATIHAN: IDENTIFIKASI NAGA</div>
            <div class="tutorial-task-desc">Pilih semua Honor Tiles jenis Naga (Merah, Hijau, Putih) dari pilihan berikut:</div>
            <div class="tutorial-tiles-wrap" id="tutTilesContainer">${tilesHtml}</div>
            <div id="tutFeedback" class="tutorial-feedback ${fbClass}">${fbText}</div>
          </div>
        `;
      } else if (this.step === 2) {
        const tiles = [3, 4, 5, 10, 10, 10, 28, 29];
        const tilesHtml = tiles.map((t, idx) =>
          renderTutorialTileBtn(t, this.selectedTiles.includes(idx), idx)
        ).join('');
        const titleDesc = this.substep === 0
          ? 'LATIHAN BAGIAN 1: BENTUK CHI'
          : 'LATIHAN BAGIAN 2: BENTUK PON';
        const taskDesc = this.substep === 0
          ? 'Pilih 3 tiles yang membentuk Chi (angka berurutan dalam satu suit):'
          : 'Bagus! Sekarang pilih 3 tiles yang membentuk Pon (kembar tiga identik):';
        let fbClass = 'neutral';
        let fbText = this.substep === 0
          ? 'Pilih 3 tiles berurutan (misal 4-5-6 Wan).'
          : 'Pilih 3 tiles kembar tiga identik.';
        if (this.lastHint) {
          fbClass = 'hint';
          fbText = this.lastHint;
        }
        if (this.validated) {
          fbClass = 'success';
          fbText = 'Luar biasa! 2-2-2 Pin adalah Pon. Ingat: Honor Tiles hanya bisa di-Pon atau Kan, tidak bisa di-Chi.';
        }
        bodyHtml += `
          <div class="tutorial-desc">Meld adalah kelompok tile di hand-mu: <strong>Chi</strong> = 3 angka berurutan sejenis (hanya Number Tiles). <strong>Pon</strong> = 3 tiles kembar identik. <strong>Kan</strong> = 4 tiles kembar identik. Honor Tiles tidak bisa di-Chi.</div>
          <div class="tutorial-practice-card">
            <div class="tutorial-task-title"><span>✦</span> ${titleDesc}</div>
            <div class="tutorial-task-desc">${taskDesc}</div>
            <div class="tutorial-tiles-wrap" id="tutTilesContainer">${tilesHtml}</div>
            <div id="tutFeedback" class="tutorial-feedback ${fbClass}">${fbText}</div>
          </div>
        `;
      } else if (this.step === 3) {
        const tiles = [34, 35, 36, 37, 39];
        const tilesHtml = tiles.map((t, idx) =>
          renderTutorialTileBtn(t, this.selectedTiles.includes(idx), idx)
        ).join('');
        let fbClass = 'neutral';
        let fbText = 'Pilih bunga yang memberi bonus Fan untuk Kursi Barat (3).';
        if (this.lastHint) {
          fbClass = 'hint';
          fbText = this.lastHint;
        }
        if (this.validated) {
          fbClass = 'success';
          fbText = 'Benar sekali! Bunga no 3 (Chrysanthemum) cocok dengan Kursi Barat (3), memberimu bonus +1 Fan saat menang!';
        }
        bodyHtml += `
          <div class="tutorial-desc">8 Bunga & Musim bukan bagian dari 14 hand tiles. Saat di-draw, bunga otomatis dibuka di meja dan kamu mengambil tile pengganti dari Wall. Jika nomor bunga cocok dengan kursimu, dapat <strong>bonus +1 Fan</strong>.</div>
          <table class="tutorial-info-table">
            <tr><td>Kursi 1 (Timur)</td><td>Bunga Plum (1) & Musim Semi (1)</td></tr>
            <tr><td>Kursi 2 (Selatan)</td><td>Bunga Orchid (2) & Musim Panas (2)</td></tr>
            <tr><td>Kursi 3 (Barat)</td><td>Bunga Chrysanthemum (3) & Musim Gugur (3)</td></tr>
            <tr><td>Kursi 4 (Utara)</td><td>Bunga Bamboo (4) & Musim Dingin (4)</td></tr>
          </table>
          <div class="tutorial-practice-card">
            <div class="tutorial-task-title"><span>✦</span> LATIHAN: COCOKKAN BUNGA KURSI</div>
            <div class="tutorial-task-desc">Skenario: Kamu duduk di <strong>Kursi Barat (Nomor 3)</strong>. Klik tile bunga yang memberikanmu bonus +1 Fan!</div>
            <div class="tutorial-tiles-wrap" id="tutTilesContainer">${tilesHtml}</div>
            <div id="tutFeedback" class="tutorial-feedback ${fbClass}">${fbText}</div>
          </div>
        `;
      } else if (this.step === 4) {
        let baseHand = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 31, 31];
        if (this.substep >= 1 && !this.validated) {
          baseHand.push(8); // 9 Wan
        }
        const tilesHtml = baseHand.map((t, idx) =>
          renderTutorialTileBtn(t, this.selectedTiles.includes(idx), idx)
        ).join('');
        const taskDesc = this.substep === 0
          ? 'Hand-mu berisi 13 tiles. Tekan tombol "Draw Tile" untuk mengambil 1 tile dari Wall:'
          : (this.validated
              ? 'Hand kembali rapi menjadi 13 tiles setelah discard.'
              : 'Hand kini 14 tiles! Tile 9 Wan masuk sendirian tanpa teman. Klik tile 9 Wan (paling kanan) lalu tekan "Discard Tile":');
        const actionBtnHtml = this.substep === 0
          ? '<button type="button" id="tutDrawBtn" class="primary-action small-btn">Draw Tile (Ambil)</button>'
          : (!this.validated
              ? `<button type="button" id="tutDiscardBtn" class="primary-action small-btn" ${this.selectedTiles.includes(13) ? '' : 'disabled'}>Discard Tile (Buang)</button>`
              : '');
        let fbClass = 'neutral';
        let fbText = this.substep === 0
          ? 'Mulai giliran dengan Draw Tile dari Wall.'
          : (this.validated
              ? 'Bagus! Tile 9 Wan dibuang ke Pond dan hand kembali ke 13 tiles siap menunggu giliran berikutnya.'
              : 'Pilih tile 9 Wan untuk di-discard.');
        if (this.validated) fbClass = 'success';
        bodyHtml += `
          <div class="tutorial-desc">Setiap giliran, urutan langkahmu: <strong>Draw 1 tile dari Wall</strong> (hand jadi 14 tiles) -> Cek kombinasi menang -> <strong>Discard 1 tile</strong> yang tidak terpakai ke Pond. Giliran berputar searah jarum jam.</div>
          <div class="tutorial-practice-card">
            <div class="tutorial-task-title"><span>✦</span> LATIHAN: DRAW DAN DISCARD</div>
            <div class="tutorial-task-desc">${taskDesc}</div>
            <div class="tutorial-tiles-wrap" id="tutTilesContainer">${tilesHtml}</div>
            <div class="tutorial-action-row">${actionBtnHtml}</div>
            <div id="tutFeedback" class="tutorial-feedback ${fbClass}">${fbText}</div>
          </div>
        `;
      } else if (this.step === 5) {
        const discardTile = 13; // 5 Pin
        const handTiles = [11, 12, 31, 31]; // 3 Pin, 4 Pin, Naga Merah, Naga Merah
        const handHtml = handTiles.map((t, idx) => renderTutorialTileBtn(t, false, idx)).join('');
        const discardHtml = renderTutorialTileBtn(discardTile, false, 99);
        let fbClass = 'neutral';
        let fbText = 'Pilih aksi klaim yang tepat.';
        if (this.lastHint) {
          fbClass = 'hint';
          fbText = this.lastHint;
        }
        if (this.validated) {
          fbClass = 'success';
          fbText = 'Mantap! 3-4 Pin di hand bergabung dengan 5 Pin dari pemain kiri membentuk Meld Chi (3-4-5 Pin) terbuka di meja.';
        }
        bodyHtml += `
          <div class="tutorial-desc">Saat lawan membuang tile, kamu bisa klaim: <strong>Chi</strong> hanya dari pemain tepat di sebelah kirimu. <strong>Pon, Kan, dan Ron</strong> bisa dari siapa saja. Setelah klaim, kamu langsung discard 1 tile tanpa draw dari Wall.</div>
          <div class="tutorial-practice-card">
            <div class="tutorial-task-title"><span>✦</span> LATIHAN: KLAIM DISCARD LAWAN</div>
            <div class="tutorial-task-desc">Pemain sebelah kirimu membuang tile:</div>
            <div class="tutorial-tiles-wrap">${discardHtml}</div>
            <div class="tutorial-task-desc" style="margin-top:8px;">Tiles di hand kamu:</div>
            <div class="tutorial-tiles-wrap">${handHtml}</div>
            <div class="tutorial-action-row">
              <button type="button" id="tutChiBtn" class="primary-action small-btn">Chi (3-4-5 Pin)</button>
              <button type="button" id="tutPonBtn" class="outline-small">Pon</button>
              <button type="button" id="tutPassBtn" class="text-button small-btn">Lewati (Pass)</button>
            </div>
            <div id="tutFeedback" class="tutorial-feedback ${fbClass}">${fbText}</div>
          </div>
        `;
      } else if (this.step === 6) {
        const hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 5, 5];
        const handHtml = hand.map((t, idx) => renderTutorialTileBtn(t, false, idx)).join('');
        const opts = [
          { key: 'A', text: 'Ping Hu (1 Fan)' },
          { key: 'B', text: 'Hun Yi Se (3 Fan)' },
          { key: 'C', text: 'Qing Yi Se (Murni Satu Jenis - 7 Fan)' },
          { key: 'D', text: 'Dui Dui Hu (3 Fan)' }
        ];
        const optsHtml = opts.map(opt => {
          let cls = '';
          if (this.quizSelected === opt.key) {
            cls = (opt.key === 'C') ? 'correct' : 'wrong';
          }
          return `<button type="button" class="tutorial-quiz-opt ${cls}" data-key="${opt.key}"><span class="tutorial-quiz-letter">${opt.key}</span> <span>${opt.text}</span></button>`;
        }).join('');
        let fbClass = 'neutral';
        let fbText = 'Pilih salah satu jawaban kuis di atas.';
        if (this.lastHint) {
          fbClass = 'hint';
          fbText = this.lastHint;
        }
        if (this.validated) {
          fbClass = 'success';
          fbText = 'Tepat sekali! Qing Yi Se bernilai 7 Fan (jackpot) karena seluruh 14 tiles murni dari satu suit tanpa campuran apapun.';
        }
        bodyHtml += `
          <div class="tutorial-desc"><strong>Ron</strong> = Menang dari discard lawan mana saja. <strong>Tsumo</strong> = Menang dari draw sendiri. Nilai kemenangan dihitung dengan <strong>Fan</strong>. Semakin sulit susunannya, semakin tinggi Fan yang didapat.</div>
          <div class="tutorial-practice-card">
            <div class="tutorial-task-title"><span>✦</span> KUIS FAN: QING YI SE</div>
            <div class="tutorial-task-desc">Hand kemenangan di bawah seluruhnya murni terdiri dari satu jenis Karakter (Wan):</div>
            <div class="tutorial-tiles-wrap">${handHtml}</div>
            <div class="tutorial-task-desc" style="margin-top:8px;">Kombinasi Fan spesial apa yang dicapai pada hand ini?</div>
            <div class="tutorial-quiz-list" id="tutQuizList">${optsHtml}</div>
            <div id="tutFeedback" class="tutorial-feedback ${fbClass}">${fbText}</div>
          </div>
        `;
      } else if (this.step === 7) {
        const opts = [
          { key: 'A', text: '80 pts' },
          { key: 'B', text: '160 pts' },
          { key: 'C', text: '320 pts (2x Base Points)' },
          { key: 'D', text: '480 pts' }
        ];
        const optsHtml = opts.map(opt => {
          let cls = '';
          if (this.quizSelected === opt.key) {
            cls = (opt.key === 'C') ? 'correct' : 'wrong';
          }
          return `<button type="button" class="tutorial-quiz-opt ${cls}" data-key="${opt.key}"><span class="tutorial-quiz-letter">${opt.key}</span> <span>${opt.text}</span></button>`;
        }).join('');
        let fbClass = 'neutral';
        let fbText = 'Pilih salah satu jawaban perhitungan poin di atas.';
        if (this.lastHint) {
          fbClass = 'hint';
          fbText = this.lastHint;
        }
        if (this.validated) {
          fbClass = 'success';
          fbText = 'Tepat sekali! 2 x 160 pts = 320 pts dibayar penuh oleh Shooter ke pemenang. Selamat, kamu telah menguasai dasar Mahjong Jakarta Lounge!';
        }
        bodyHtml += `
          <div class="tutorial-desc">Setiap pemain mulai dengan 10.000 pts. Total Fan dikonversi ke Base Points (1 Fan = 40, 2 Fan = 80, 3 Fan = 160, 4 Fan = 320, 5 Fan = 480). Di lounge Jakarta berlaku aturan Shooter: <strong>pemain yang membuang tile kemenangan (Ron) membayar 2x Base Points sendirian ke pemenang!</strong></div>
          <div class="tutorial-practice-card">
            <div class="tutorial-task-title"><span>✦</span> KUIS ATURAN SHOOTER</div>
            <div class="tutorial-task-desc">Skenario: Kamu menang Ron dengan 3 Fan (Base Point = 160 pts). Berapa poin yang harus dibayar oleh Shooter yang membuang tile kemenanganmu?</div>
            <div class="tutorial-quiz-list" id="tutQuizList">${optsHtml}</div>
            <div id="tutFeedback" class="tutorial-feedback ${fbClass}">${fbText}</div>
          </div>
        `;
      }

      const actions = [];
      if (this.step < 7) {
        if (this.step > 0) {
          actions.push({ text: 'Kembali', run: () => this.prev() });
        }
        actions.push({ text: 'Lewati', run: () => this.skip() });
        actions.push({
          text: 'Lanjut ➔',
          primary: true,
          disabled: !this.validated,
          run: () => this.next()
        });
      } else {
        actions.push({ text: '↻ Ulangi Tutorial', run: () => this.start(0) });
        actions.push({
          text: '▶ Main Sekarang',
          primary: true,
          disabled: !this.validated,
          run: () => this.complete()
        });
      }

      showModal({
        icon: stepIcons[this.step],
        kicker: stepKickers[this.step],
        title: stepTitles[this.step],
        body: bodyHtml,
        actions
      });

      this.bindEvents();
    },

    bindEvents() {
      const container = $('tutTilesContainer');
      if (container) {
        container.querySelectorAll('.tutorial-tile-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            this.handleTileClick(idx);
          });
        });
      }

      const quizList = $('tutQuizList');
      if (quizList) {
        quizList.querySelectorAll('.tutorial-quiz-opt').forEach(btn => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            this.handleQuizClick(key);
          });
        });
      }

      $('tutDrawBtn')?.addEventListener('click', () => {
        this.substep = 1;
        this.selectedTiles = [];
        this.render();
      });

      $('tutDiscardBtn')?.addEventListener('click', () => {
        if (this.selectedTiles.includes(13)) {
          this.validated = true;
          this.selectedTiles = [];
          this.render();
        }
      });

      $('tutChiBtn')?.addEventListener('click', () => {
        this.validated = true;
        this.lastHint = null;
        this.render();
      });

      $('tutPonBtn')?.addEventListener('click', () => {
        this.lastHint = 'Kamu tidak memiliki sepasang 5 Pin di hand untuk melakukan Pon.';
        this.render();
      });

      $('tutPassBtn')?.addEventListener('click', () => {
        this.lastHint = 'Bisa dilewati, tapi di sini kamu punya kesempatan emas untuk Chi (3-4-5 Pin).';
        this.render();
      });
    },

    handleTileClick(idx) {
      if (this.step === 0) {
        const pos = this.selectedTiles.indexOf(idx);
        if (pos > -1) {
          this.selectedTiles.splice(pos, 1);
        } else if (this.selectedTiles.length < 2) {
          this.selectedTiles.push(idx);
        }
        this.validated = (this.selectedTiles.length === 2 && this.selectedTiles.includes(12) && this.selectedTiles.includes(13));
        this.render();
      } else if (this.step === 1) {
        const pos = this.selectedTiles.indexOf(idx);
        if (pos > -1) {
          this.selectedTiles.splice(pos, 1);
          this.lastHint = null;
        } else {
          this.selectedTiles.push(idx);
          if ([0, 2, 4].includes(idx)) {
            this.lastHint = 'Itu Number Tile (angka), bukan Naga.';
          } else if (idx === 6) {
            this.lastHint = 'Itu Honor Tile jenis Angin, bukan Naga.';
          } else {
            this.lastHint = null;
          }
        }
        const dragons = [1, 3, 5];
        const hasAllDragons = dragons.every(d => this.selectedTiles.includes(d));
        const hasNoOthers = this.selectedTiles.every(d => dragons.includes(d));
        this.validated = (hasAllDragons && hasNoOthers);
        this.render();
      } else if (this.step === 2) {
        const pos = this.selectedTiles.indexOf(idx);
        if (pos > -1) {
          this.selectedTiles.splice(pos, 1);
        } else if (this.selectedTiles.length < 3) {
          this.selectedTiles.push(idx);
        }
        if (this.substep === 0) {
          if (this.selectedTiles.length === 3) {
            const isChi = [0, 1, 2].every(i => this.selectedTiles.includes(i));
            if (isChi) {
              this.substep = 1;
              this.selectedTiles = [];
              this.lastHint = null;
            } else {
              this.lastHint = 'Chi harus berupa 3 angka berurutan sejenis (misal 4-5-6 Wan).';
            }
          } else {
            this.lastHint = null;
          }
        } else if (this.substep === 1) {
          if (this.selectedTiles.length === 3) {
            const isPon = [3, 4, 5].every(i => this.selectedTiles.includes(i));
            if (isPon) {
              this.validated = true;
              this.lastHint = null;
            } else {
              this.lastHint = 'Pon harus berupa 3 tile kembar identik (misal 2-2-2 Pin).';
            }
          } else {
            this.lastHint = null;
          }
        }
        this.render();
      } else if (this.step === 3) {
        this.selectedTiles = [idx];
        if (idx === 2) {
          this.validated = true;
          this.lastHint = null;
        } else {
          this.validated = false;
          this.lastHint = 'Bunga nomor itu cocok untuk kursi lain. Ingat: Kursi Barat adalah nomor 3 (Chrysanthemum / Autumn).';
        }
        this.render();
      } else if (this.step === 4) {
        if (this.substep === 1 && !this.validated) {
          if (idx === 13) {
            const pos = this.selectedTiles.indexOf(13);
            if (pos > -1) this.selectedTiles.splice(pos, 1);
            else this.selectedTiles.push(13);
            this.render();
          }
        }
      }
    },

    handleQuizClick(key) {
      this.quizSelected = key;
      if (this.step === 6) {
        if (key === 'C') {
          this.validated = true;
          this.lastHint = null;
        } else {
          this.validated = false;
          if (key === 'A') this.lastHint = 'Ping Hu hanya bernilai 1 Fan dan tidak memperhitungkan kemurnian satu suit.';
          else if (key === 'B') this.lastHint = 'Hun Yi Se mengharuskan campuran antara satu suit angka DAN Honor Tiles (Angin/Naga).';
          else if (key === 'D') this.lastHint = 'Dui Dui Hu adalah hand yang semua kelompoknya berupa Pon kembar tiga.';
        }
        this.render();
      } else if (this.step === 7) {
        if (key === 'C') {
          this.validated = true;
          this.lastHint = null;
        } else {
          this.validated = false;
          this.lastHint = 'Ingat aturan Shooter: pemain yang membuang tile kemenangan membayar 2x Base Points (2 x 160 pts) sendirian!';
        }
        this.render();
      }
    }
  };

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
    state.deadWallCount = s.deadWallCount || 14;
    state.canTsumo = !!s.canTsumo;
    state.canKongTiles = Array.isArray(s.canKongTiles) ? [...s.canKongTiles] : [];
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
      score: s.myScore,
      isBot: false,
      isConnected: true
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
        score: opp.score,
        isBot: !!opp.isBot,
        isConnected: opp.isConnected !== false
      };
    });

    if (s.phase === 'waiting') {
      setStatus(`Meja Online #${s.roomCode}. Tunggu pemain lain atau tekan Isi Bot & Mulai Game.`);
    } else if (state.current === 0 && state.phase === 'draw') {
      setStatus('Giliranmu! Tekan Ambil Ubin.');
    } else if (state.current === 0 && state.phase === 'discard') {
      setStatus((s.canTsumo || isWinningHand(state.players[0].hand, state.players[0].melds.length)) ? 'Mahjong! Tanganmu sudah lengkap.' : 'Pilih satu ubin lalu tekan Buang Ubin.');
    } else if (state.phase === 'claim' && s.pendingClaim) {
      setStatus(`Kesempatan klaim ${tileName(s.pendingClaim.tile)}!`);
    } else {
      setStatus(`Menunggu giliran lawan...`);
    }

    render();
    renderOnlineBar();
  }

  function handleServerGameOver(payload, maybeFanSummary) {
    state.active = false;
    state.phase = 'over';

    let winnerSeat = null;
    let fanSummary = null;
    let isDraw = false;
    let isTsumo = false;

    if (payload && typeof payload === 'object' && ('winner' in payload || 'isDraw' in payload)) {
      winnerSeat = payload.winner;
      fanSummary = payload.fanSummary;
      isDraw = !!payload.isDraw;
      isTsumo = !!payload.isTsumo;
    } else {
      winnerSeat = payload;
      fanSummary = maybeFanSummary;
    }

    if (isDraw || winnerSeat === null || winnerSeat === undefined) {
      addLog('Tumpukan habis. Ronde online berakhir seri (Exhaustive Draw).');
      setStatus('Ronde seri: seluruh ubin di Live Wall telah habis.');
      render();
      const scoreBoardHtml = state.players.map((p) => `<div class="score-pill"><span>${WIND_SIGNS[p.seat] || '✦'} ${p.name}</span><strong>${(p.score || 0).toLocaleString('id-ID')} pts</strong></div>`).join('');
      showModal({
        icon: '⚐',
        kicker: 'RONDE ONLINE SELESAI',
        title: 'Ronde Seri (Tembok Habis)',
        body: `
          <div class="winner-summary">
            <p>Seluruh ubin di Live Wall telah habis ditarik dan tidak ada pemain yang menyelesaikan tangan (Exhaustive Draw).</p>
            <div class="score-table-label" style="margin-top:12px;">SKOR SAAT INI:</div>
            <div class="score-pill-container">${scoreBoardHtml}</div>
            <p class="table-disclaimer" style="margin-top:12px;">Tidak ada perolehan Fan atau transfer poin pada ronde seri.</p>
          </div>
        `,
        actions: [
          {
            text: 'Mulai Ronde Baru',
            primary: true,
            run: () => {
              closeModal();
              socket?.emit('game:start');
            }
          },
          { text: 'Tutup', run: closeModal }
        ]
      });
      return;
    }

    const relWinner = (winnerSeat - (onlineSession?.seat || 0) + 4) % 4;
    const winnerName = relWinner === 0 ? 'Kamu' : (NAMES[relWinner] || `Pemain ${winnerSeat}`);
    const totalFan = fanSummary?.totalFan ?? 0;
    const items = Array.isArray(fanSummary?.items) ? fanSummary.items : [];
    const basePoints = fanSummary?.basePoints ?? 0;
    const winTitle = isTsumo
      ? (relWinner === 0 ? 'Mahjong! Tsumo (Menang Sendiri)!' : `${winnerName} Tsumo!`)
      : (relWinner === 0 ? 'Mahjong! Kamu menang!' : `${winnerName} menang!`);

    showModal({
      icon: relWinner === 0 ? '✿' : (WIND_SIGNS[winnerSeat] || '✦'),
      kicker: 'RONDE ONLINE SELESAI',
      title: winTitle,
      body: `
        <div class="winner-summary">
          <p><strong>${winnerName}</strong> memenangkan ronde meja online!</p>
          <div class="fan-box">
            <div class="fan-header"><span>RINCIAN FAN</span><strong>TOTAL: ${totalFan} FAN</strong></div>
            <div class="fan-items">${items.map((it) => `<div class="fan-row"><span>✦ ${it.name}</span><strong>+${it.fan} Fan</strong></div>`).join('')}</div>
          </div>
          <div class="winner-big">${basePoints.toLocaleString('id-ID')} <small style="font-size:14px;font-weight:normal;">poin dasar</small></div>
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
        },
        { text: 'Tutup', run: closeModal }
      ]
    });
  }

  function showOnlineLobby() {
    const isConn = socket?.connected;
    let savedSession = null;
    try {
      const raw = localStorage.getItem('mahjongin_session');
      if (raw) savedSession = JSON.parse(raw);
    } catch (_) {}

    const reconnectCard = (savedSession && savedSession.roomCode && savedSession.sessionToken) ? `
      <div style="margin-bottom:14px;padding:12px;background:rgba(218,165,32,0.12);border:1px solid #bca473;border-radius:10px;text-align:left;">
        <div style="font-size:11px;color:#f5d485;font-weight:bold;letter-spacing:0.04em;">SESI SEBELUMNYA DITEMUKAN</div>
        <p style="font-size:11px;color:#ded1b2;margin:4px 0 8px;">Tergabung di meja <strong>#${savedSession.roomCode}</strong> (Kursi ${WINDS[savedSession.seat] || 'Pemain'}).</p>
        <button id="modalReconnectBtn" class="primary-action" style="width:100%;font-size:12px;padding:8px 14px;">↻ Sambung Ulang ke Meja #${savedSession.roomCode}</button>
      </div>
    ` : '';

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

          ${reconnectCard}

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
      $('modalReconnectBtn')?.addEventListener('click', () => {
        if (!savedSession?.roomCode || !savedSession?.sessionToken) return;
        if (!socket?.connected) {
          alert('Belum terhubung ke server online. Tunggu sebentar...');
          return;
        }
        socket.emit('room:reconnect', {
          roomCode: savedSession.roomCode,
          sessionToken: savedSession.sessionToken
        });
      });

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
        const payload = { roomCode, name };
        if (savedSession && savedSession.roomCode === roomCode && savedSession.sessionToken) {
          payload.sessionToken = savedSession.sessionToken;
        }
        socket.emit('room:join', payload);
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

        try {
          const rawSession = localStorage.getItem('mahjongin_session');
          if (rawSession) {
            const saved = JSON.parse(rawSession);
            if (saved?.roomCode && saved?.sessionToken) {
              console.log('Mencoba reconnect otomatis ke meja:', saved.roomCode);
              socket.emit('room:reconnect', {
                roomCode: saved.roomCode,
                sessionToken: saved.sessionToken
              });
            }
          }
        } catch (_) {}
      });

      socket.on('disconnect', () => {
        console.log('Terputus dari server.');
        updateServerStatus('disconnected', 'TERPUTUS (SOLO)');
      });

      socket.on('connect_error', () => {
        updateServerStatus('disconnected', 'SERVER TIDUR (SOLO)');
      });

      socket.on('room:joined', ({ roomCode, seat, sessionToken }) => {
        onlineSession = { roomCode, seat, sessionToken };
        if (sessionToken) {
          try {
            localStorage.setItem('mahjongin_session', JSON.stringify({ roomCode, seat, sessionToken }));
          } catch (_) {}
        }
        addLog(`Masuk meja online #${roomCode} sebagai kursi ${WINDS[seat]}.`);
        closeModal();
        showGameView('online');
      });

      socket.on('game:state', (serverState) => {
        applyServerGameState(serverState);
      });

      socket.on('game:over', (payload) => {
        handleServerGameOver(payload);
      });

      socket.on('error', (msg) => {
        if (typeof msg === 'string' && (msg.includes('tidak ditemukan') || msg.includes('tidak valid') || msg.includes('berakhir'))) {
          try {
            localStorage.removeItem('mahjongin_session');
          } catch (_) {}
          onlineSession = null;
          renderOnlineBar();
        }
        alert(msg);
      });
    } catch (err) {
      console.warn('Socket initialization failed:', err);
      updateServerStatus('disconnected', 'OFFLINE');
    }
  }

  function showMenuView() {
    if (document.body) {
      document.body.classList.remove('in-game-view');
      document.body.classList.add('in-menu-view');
    }
    const menuView = $('menuView');
    const gameView = $('gameView');
    const backBtn = $('backToMenuBtn');
    if (menuView) menuView.hidden = false;
    if (gameView) gameView.hidden = true;
    if (backBtn) backBtn.hidden = true;

    try {
      const rawSession = localStorage.getItem('mahjongin_session');
      const bannerWrap = $('reconnectBannerWrap');
      const roomText = $('reconnectRoomText');
      if (rawSession && bannerWrap && roomText) {
        const saved = JSON.parse(rawSession);
        if (saved?.roomCode && saved?.sessionToken) {
          roomText.textContent = `#${saved.roomCode}`;
          bannerWrap.hidden = false;
        } else {
          bannerWrap.hidden = true;
        }
      } else if (bannerWrap) {
        bannerWrap.hidden = true;
      }
    } catch (_) {}

    const nameInput = $('menuPlayerNameInput');
    if (nameInput) {
      nameInput.value = localStorage.getItem('mahjong-player-name') || 'Kamu';
    }
  }

  function showGameView(mode = 'solo') {
    if (document.body) {
      document.body.classList.remove('in-menu-view');
      document.body.classList.add('in-game-view');
    }
    const menuView = $('menuView');
    const gameView = $('gameView');
    const backBtn = $('backToMenuBtn');
    if (menuView) menuView.hidden = true;
    if (gameView) gameView.hidden = false;
    if (backBtn) backBtn.hidden = false;

    const badge = $('gameModeBadge');
    if (mode === 'solo') {
      if (badge) badge.textContent = 'MEJA SOLO · VS 3 BOT';
      if ($('onlineBar')) $('onlineBar').hidden = true;
      startNewGame();
    } else if (mode === 'online') {
      if (badge) badge.textContent = `ONLINE · MEJA #${onlineSession?.roomCode || ''}`;
      renderOnlineBar();
      render();
    } else if (mode === 'tutorial') {
      if (badge) badge.textContent = 'LATIHAN TUTORIAL (8 LANGKAH)';
      TutorialManager.start();
    }
  }

  function handleBackToMenu() {
    if (TutorialManager.isActive()) {
      if (confirm('Keluar dari latihan tutorial dan kembali ke menu utama?')) {
        TutorialManager.stop();
        closeModal();
        showMenuView();
      }
      return;
    }
    if (onlineSession) {
      if (confirm('Keluar dari meja online dan kembali ke menu utama?')) {
        leaveOnlineRoom();
        showMenuView();
      }
      return;
    }
    showMenuView();
  }

  $('rulesTop').addEventListener('click', showRules);
  $('rulesSide')?.addEventListener('click', showRules);
  $('newGame')?.addEventListener('click', confirmNewGame);
  $('modalClose')?.addEventListener('click', closeModal);
  $('overlay')?.addEventListener('click', (event) => { if (event.target === $('overlay')) closeModal(); });
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
    leaveOnlineRoom();
    showMenuView();
  });
  $('startTutorialBannerBtn')?.addEventListener('click', startTutorialSafe);
  $('dismissTutorialBannerBtn')?.addEventListener('click', () => {
    localStorage.setItem('mahjong-tutorial-dismissed', 'true');
    const banner = $('tutorialBanner');
    if (banner) banner.hidden = true;
  });

  $('startSoloGameBtn')?.addEventListener('click', () => showGameView('solo'));
  $('openOnlineLobbyBtn')?.addEventListener('click', showOnlineLobby);
  $('startTutorialMenuBtn')?.addEventListener('click', () => showGameView('tutorial'));
  $('openRulesMenuBtn')?.addEventListener('click', showRules);
  $('backToMenuBtn')?.addEventListener('click', handleBackToMenu);
  $('gameBackMenuBtn')?.addEventListener('click', handleBackToMenu);
  $('brandLogo')?.addEventListener('click', (e) => { e.preventDefault(); handleBackToMenu(); });

  $('toggleSidebarBtn')?.addEventListener('click', () => {
    const gView = $('gameView');
    if (gView) {
      gView.classList.toggle('show-sidebar');
      const isShown = gView.classList.contains('show-sidebar');
      $('toggleSidebarBtn')?.classList.toggle('active', isShown);
    }
  });

  $('menuPlayerNameInput')?.addEventListener('input', (e) => {
    const name = (e.target?.value || '').trim() || 'Kamu';
    localStorage.setItem('mahjong-player-name', name);
  });

  $('menuReconnectBtn')?.addEventListener('click', () => {
    try {
      const rawSession = localStorage.getItem('mahjongin_session');
      if (rawSession) {
        const saved = JSON.parse(rawSession);
        if (saved?.roomCode && saved?.sessionToken) {
          if (!socket?.connected) {
            alert('Belum terhubung ke server online. Tunggu sebentar...');
            return;
          }
          socket.emit('room:reconnect', {
            roomCode: saved.roomCode,
            sessionToken: saved.sessionToken
          });
        }
      }
    } catch (_) {}
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (TutorialManager.isActive()) {
        if (confirm('Keluar dari latihan tutorial?')) {
          TutorialManager.stop();
          closeModal();
        }
        return;
      }
      closeModal();
    }
    if (!$('overlay').hidden || !state.active) return;
    if (event.key.toLowerCase() === 'd' && state.phase === 'draw' && state.current === 0) playerDraw();
    if (event.key === 'Enter' && state.phase === 'discard' && state.selected !== null) playerDiscard();
  });

  function applyZoom(zoomLevel) {
    const gameSide = $('gameSide') || (typeof document.querySelector === 'function' ? document.querySelector('.game-side') : null);
    if (!gameSide) return;
    if (gameSide.classList) {
      ['zoom-100', 'zoom-120', 'zoom-140'].forEach((c) => gameSide.classList.remove(c));
      gameSide.classList.add(`zoom-${zoomLevel}`);
    }

    if (typeof document.querySelectorAll === 'function') {
      const buttons = document.querySelectorAll('.zoom-btn');
      buttons.forEach((b) => {
        b.classList?.toggle('active', b.dataset?.zoom === String(zoomLevel));
      });
    }
  }

  function initZoomControls() {
    let savedZoom = '140';
    try {
      savedZoom = localStorage.getItem('mahjongin_zoom') || '140';
    } catch (_) {}
    applyZoom(savedZoom);

    const switcher = $('zoomSwitcher');
    if (!switcher) return;
    switcher.addEventListener('click', (e) => {
      const btn = e.target.closest('.zoom-btn');
      if (!btn) return;
      const zoomLevel = btn.dataset.zoom;
      if (zoomLevel) {
        applyZoom(zoomLevel);
        try {
          localStorage.setItem('mahjongin_zoom', zoomLevel);
        } catch (_) {}
      }
    });
  }

  function checkTutorialPrompt() {
    try {
      const completed = localStorage.getItem('mahjong-tutorial-completed');
      const dismissed = localStorage.getItem('mahjong-tutorial-dismissed');
      const banner = $('tutorialBanner');
      if (!banner) return;
      banner.hidden = !!(completed || dismissed);
    } catch {
      // In case localStorage is blocked in iframe/sandbox
    }
  }

  showMenuView();
  initZoomControls();
  checkTutorialPrompt();
  initSocket();
})();
