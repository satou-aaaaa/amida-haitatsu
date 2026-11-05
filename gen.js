// あみだ配達：あみだくじに横線を足して、上の手紙をそれぞれ同じ字の家へ届ける。make(seed, L) が種から問題を作る。
(function (root) {
  "use strict";
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 大きさ：縦線の数 n・段の数 R・はじめからある横線 fix・工事中で引けない所 block・足す横線の最少の数 min
  const SIZES = [
    { name: "小道", n: 4, R: 6, fix: 2, block: 2, min: [2, 3] },
    { name: "町", n: 5, R: 7, fix: 3, block: 4, min: [3, 5] },
    { name: "大通り", n: 6, R: 8, fix: 4, block: 6, min: [5, 7] },
  ];
  const HARD = { name: "上級", n: 7, R: 9, fix: 5, block: 8, min: [7, 10] };
  const NAMES = "あいうえおかき";
  // 横線の置き場所は [段, すき間]。cell[r][g]：0 空き・1 はじめからある横線・2 工事中
  // 並び arr[列] = その列にいる手紙。横線 g は arr[g] と arr[g+1] を入れかえる
  const swapRow = (arr, gaps) => { const a = arr.slice(); for (const g of gaps) [a[g], a[g + 1]] = [a[g + 1], a[g]]; return a; };
  // 1段で足せる横線の組（はじめからの横線と合わせて、となり合わない）
  function rowOptions(row) {
    const n1 = row.length, out = [];
    for (let m = 0; m < 1 << n1; m++) {
      const add = []; let ok = true;
      for (let g = 0; g < n1 && ok; g++) if (m >> g & 1) { if (row[g] !== 0) ok = false; else add.push(g); }
      if (!ok) continue;
      const all = row.map((v, g) => v === 1 || add.includes(g));
      if (all.some((x, g) => x && all[g + 1])) continue;
      out.push({ add, all: all.flatMap((x, g) => (x ? [g] : [])) });
    }
    return out;
  }
  // 上から1段ずつ、どの並びに何本で着けるか（最少）。並びは1列3ビットの数にまとめて速く数える。back で道をたどれる
  const pack = (a) => a.reduce((v, x, i) => v | (x << (3 * i)), 0);
  const unpack = (v, n) => [...Array(n)].map((_, i) => (v >> (3 * i)) & 7);
  function swapPacked(v, gaps) { for (const g of gaps) { const s = 3 * g, a = (v >> s) & 7, b = (v >> (s + 3)) & 7; v = (v & ~(63 << s)) | (b << s) | (a << (s + 3)); } return v; }
  function solve(cell, n) {
    let cur = new Map([[pack([...Array(n).keys()]), { d: 0, back: null, add: [] }]]);
    const layers = [cur];
    for (const row of cell) {
      const opts = rowOptions(row), nx = new Map();
      for (const [v, st] of cur) for (const o of opts) {
        const w = swapPacked(v, o.all), d = st.d + o.add.length, old = nx.get(w);
        if (!old || d < old.d) nx.set(w, { d, back: st, add: o.add });
      }
      cur = nx; layers.push(cur);
    }
    return layers;
  }
  // 手紙 i が届く家の列 → 着いたときの並び（arr[列] = 手紙）
  const goalArr = (target) => { const a = []; target.forEach((col, i) => { a[col] = i; }); return a; };
  // ある横線の置き方（はじめから＋足した横線）で、手紙がどの列に着くか
  function run(cell, n, added) {
    let arr = [...Array(n).keys()];
    cell.forEach((row, r) => { arr = swapRow(arr, row.flatMap((v, g) => (v === 1 || added.some((x) => x[0] === r && x[1] === g) ? [g] : []))); });
    const where = []; arr.forEach((letter, col) => { where[letter] = col; });
    return where;
  }
  // いちばん少ない本数で届く足し方の1つ（上の段から）
  function bestAdd(cell, n, target) {
    const layers = solve(cell, n), last = layers[layers.length - 1].get(pack(goalArr(target)));
    if (!last) return null;
    const out = []; let st = last, r = cell.length - 1;
    while (st.back) { st.add.forEach((g) => out.push([r, g])); st = st.back; r--; }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  function make(seed, L) {
    const R = rng(seed), n1 = L.n - 1;
    for (let t = 0; t < 400; t++) {
      const cell = [...Array(L.R)].map(() => Array(n1).fill(0));
      // はじめからある横線：となり合わないように
      for (let k = 0, tries = 0; k < L.fix && tries < 200; tries++) { const r = Math.floor(R() * L.R), g = Math.floor(R() * n1); if (cell[r][g] || cell[r][g - 1] === 1 || cell[r][g + 1] === 1) continue; cell[r][g] = 1; k++; }
      for (let k = 0, tries = 0; k < L.block && tries < 200; tries++) { const r = Math.floor(R() * L.R), g = Math.floor(R() * n1); if (cell[r][g]) continue; cell[r][g] = 2; k++; }
      const layers = solve(cell, L.n), ends = [...layers[layers.length - 1]].filter(([, s]) => s.d >= L.min[0] && s.d <= L.min[1]);
      if (!ends.length) continue;
      const [v, end] = ends[Math.floor(R() * ends.length)], target = [];
      unpack(v, L.n).forEach((letter, col) => { target[letter] = col; });
      if (target.every((c, i) => c === i)) continue;
      return { n: L.n, R: L.R, cell, target, d: end.d, name: L.name };
    }
    return null;
  }
  const B = { rng, seedOf, SIZES, HARD, NAMES, rowOptions, solve, pack, run, goalArr, bestAdd, make };
  if (typeof module !== "undefined") module.exports = B; else root.AMI = B;
})(this);
