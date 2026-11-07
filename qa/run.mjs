// あみだ配達の検査。問題の作り方（いちばん少ない本数を別の数え方で数え直す）・3問の組み方（1年分）・引く/消す/戻す/ヒント・続きから・上級・配達帳・実績・記録・スマホ幅・PWA。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const T = createRequire(import.meta.url)(path.join(root, "gen.js"));
const LVS = [...T.SIZES, T.HARD];

// 別の数え方：1段の中を左から1つずつ「引く・引かない」を決めていく（gen.js は1段まとめて数える）
function minByCells(cell, n, target) {
  const goal = []; target.forEach((c, i) => { goal[c] = i; });
  let st = new Map([[[...Array(n).keys()].join(), 0]]);
  for (const row of cell) {
    // 状態：[並び, 左のすき間に横線があるか]
    let cur = new Map([...st].map(([k, d]) => [k + "|0", d]));
    for (let g = 0; g < n - 1; g++) {
      const nx = new Map(), put = (k, d) => { if (!nx.has(k) || nx.get(k) > d) nx.set(k, d); };
      for (const [k, d] of cur) {
        const [a, left] = k.split("|"), arr = a.split(",").map(Number);
        const swap = () => { const b = arr.slice(); [b[g], b[g + 1]] = [b[g + 1], b[g]]; return b.join(); };
        if (row[g] === 1) { if (left === "0") put(swap() + "|1", d); continue; } // はじめからの横線は必ず通る（左がつながっていたら、その並びはありえない）
        put(a + "|0", d); // 引かない
        if (row[g] === 0 && left === "0") put(swap() + "|1", d + 1); // 引く
      }
      cur = nx;
    }
    st = new Map();
    for (const [k, d] of cur) { const a = k.split("|")[0]; if (!st.has(a) || st.get(a) > d) st.set(a, d); }
  }
  return st.has(goal.join()) ? st.get(goal.join()) : Infinity;
}
// もう1つ：小道だけは、空いた所の選び方を全部試す
function minBrute(cell, n, target) {
  const free = []; cell.forEach((row, r) => row.forEach((v, g) => { if (v === 0) free.push([r, g]); }));
  let best = Infinity;
  for (let m = 0; m < 1 << free.length; m++) {
    let bits = 0; for (let x = m; x; x &= x - 1) bits++;
    if (bits >= best) continue;
    const add = free.filter((_, j) => m >> j & 1), on = (r, g) => cell[r][g] === 1 || add.some((x) => x[0] === r && x[1] === g);
    if (add.some(([r, g]) => (g > 0 && on(r, g - 1)) || (g < n - 2 && on(r, g + 1)))) continue;
    const w = T.run(cell, n, add);
    if (w.every((c, i) => c === target[i])) best = bits;
  }
  return best;
}
// 1. 問題の作り方（ブラウザを使わない）
{
  const bad = [], minBad = [], brute = [], bestBad = [], same = [], dist = {};
  LVS.forEach((L, lv) => {
    const N = lv === 3 ? 150 : 400;
    for (let s = 0; s < N; s++) {
      const seed = T.seedOf(`qa:${lv}:${s}`), p = T.make(seed, L);
      if (!p) { bad.push(`${L.name}:${s}:作れない`); continue; }
      const fixAdj = p.cell.some((row) => row.some((v, g) => v === 1 && row[g + 1] === 1));
      const nFix = p.cell.flat().filter((v) => v === 1).length, nBlk = p.cell.flat().filter((v) => v === 2).length;
      if (p.n !== L.n || p.R !== L.R || fixAdj || nFix !== L.fix || nBlk !== L.block || p.d < L.min[0] || p.d > L.min[1] || p.target.every((c, i) => c === i) || new Set(p.target).size !== p.n) bad.push(`${L.name}:${s}`);
      const m2 = minByCells(p.cell, p.n, p.target); if (m2 !== p.d) minBad.push(`${L.name}:${s}:${p.d}/${m2}`);
      if (lv === 0 && s < 150) { const m3 = minBrute(p.cell, p.n, p.target); if (m3 !== p.d) brute.push(`${s}:${p.d}/${m3}`); }
      const b = T.bestAdd(p.cell, p.n, p.target), on = (r, g) => p.cell[r][g] === 1 || b.some((x) => x[0] === r && x[1] === g);
      if (!b || b.length !== p.d || b.some(([r, g]) => p.cell[r][g] !== 0 || (g > 0 && on(r, g - 1)) || (g < p.n - 2 && on(r, g + 1))) || T.run(p.cell, p.n, b).some((c, i) => c !== p.target[i])) bestBad.push(`${L.name}:${s}`);
      if (s < 30 && JSON.stringify(T.make(seed, L)) !== JSON.stringify(p)) same.push(`${L.name}:${s}`);
      dist[L.name] = dist[L.name] || {}; dist[L.name][p.d] = (dist[L.name][p.d] || 0) + 1;
    }
  });
  check("問題は道の数・段・はじめからの横線（となり合わない）・工事中の数が決まりどおりで、いちばん少ない本数は決めた幅・家の並びは入れかわっている（小道・町・大通り400問、上級150問）", bad.length === 0, bad.slice(0, 3).join(","));
  check("いちばん少ない本数を、1つずつ決める別の数え方で数え直しても同じ", minBad.length === 0, minBad.slice(0, 3).join(","));
  check("小道は空いた所の選び方を全部試しても、いちばん少ない本数が同じ（150問）", brute.length === 0, brute.slice(0, 3).join(","));
  check("ヒントのもとになる引き方は、空いた所だけ・となり合わない・その本数でちゃんと届く", bestBad.length === 0, bestBad.slice(0, 3).join(","));
  check("同じ種からは同じ問題になる（だれでも同じ問題）", same.length === 0, same.join(","));
  check("いちばん少ない本数がばらける（同じ本数ばかりにならない）", Object.values(dist).every((d) => Object.keys(d).length >= 2), JSON.stringify(dist));
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
check("別のタブで先に進んだ引き方を、古いタブの引き方で上書きしない（2026-11-04 CodeRabbit）", /!\(old && old\.moves > cur\.moves\)\)/.test(html));
{ // ひな形を写したリポジトリで、README・AGENTS.md に前のゲームの名前や URL が残らない（2026-11-05 CodeRabbit）
  const docs = ["README.md", "AGENTS.md", "manifest.webmanifest", "sw.js", "index.html"].map((f) => [f, readFileSync(path.join(root, f), "utf8")]);
  const left = docs.filter(([, t]) => /しりとり|shiritori|ことばならべ|kotoba|words\.js|言葉帳|github\.io\/(?!amida-haitatsu\/)[a-z0-9-]+\//.test(t)).map(([f]) => f);
  check("README・AGENTS.md・manifest・sw.js・画面はこのゲームの名前と URL だけ（写し元のゲームが残らない）", left.length === 0 && /^# あみだ配達/.test(docs[0][1]) && /satou-aaaaa\.github\.io\/amida-haitatsu\//.test(docs[0][1]), left.join(",")); }
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習の問題の種だけ（今日の3問・上級は日付の種）", (html.match(/Math\.random/g) || []).length === 1 && /mode === "h" \? hardList\(k\) : \[\{ lv: opt, seed: Math\.floor\(Math\.random\(\)/.test(html) && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/amida-haitatsu/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）・フォーム名は4字以上（3字以下だと GitHub がフォームを出さない。2026-11-05 CodeRabbit）", [...((fy.match(/^name: (.+)$/m) || [])[1] || "")].length > 3 && /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  { const st = await checkSwStall(sw); check("PWA：本文の途中で通信が止まっても4秒で保存したものを返す・ふつうはネットの返事", st.ok, JSON.stringify(st)); }
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./transfer.js", "./gen.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
  const local = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => "./" + m[1]);
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(new Promise\(\(r\) => \{ saved = r; \}\)\)/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し（画面が読むスクリプトも全部）、外へ何も送らない", need.concat(local).every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "あみだ配達" && mf.icons.length >= 2 && mf.start_url === "./"); }
{ const src = html + readFileSync(path.join(root, "gen.js"), "utf8");
  const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
  check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
const FIXED = new Date(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) + "T03:00:00Z");
async function newPage(w = 390, h = 844) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.stack));
  page.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
  await page.clock.setFixedTime(FIXED); // 時計を今日の昼（日本時間）に止める。QA の途中で0時をまたいでも「今日」が変わらない（2026-11-05 CodeRabbit）
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  return page;
}
const curT = (page) => page.evaluate(() => { const c = window.__am.cur(); return { p: c.p, add: c.add.map((x) => x.slice()), hint: c.hint.map((x) => x.slice()), hints: c.hints, moves: c.moves, done: c.done, hard: c.hard }; });
const cellSel = (r, g) => `#board rect.hit[data-r="${r}"][data-g="${g}"]`;
// 横線を引ける空いた所（となりも空いている所）
async function freeCell(page) {
  const c = await curT(page), p = c.p;
  for (let r = 0; r < p.R; r++) for (let g = 0; g < p.n - 1; g++) if (p.cell[r][g] === 0 && p.cell[r][g - 1] !== 1 && p.cell[r][g + 1] !== 1 && !c.add.some((x) => x[0] === r && Math.abs(x[1] - g) <= 1)) return cellSel(r, g);
}
// ヒントの線を残して、いちばん少ない引き方で引き直して配達する
async function solveNow(page, extra = false) {
  if (await page.locator("#clear:not([disabled])").count()) await page.click("#clear");
  const c = await curT(page), p = c.p;
  const cell = p.cell.map((row, r) => row.map((v, g) => (v === 0 && c.hint.some((x) => x[0] === r && x[1] === g) ? 1 : v)));
  const best = await page.evaluate((a) => window.__am.T.bestAdd(a.cell, a.n, a.target), { cell, n: p.n, target: p.target });
  for (const [r, g] of best) await page.click(cellSel(r, g));
  await page.click("#answer");
}
const KEY = "amida-haitatsu-v1";
try {
  const page = await newPage();
  // 2. 3問の組み方（日付の種）
  const sel = await page.evaluate(() => {
    const g = window.__am, out = { bad: [], same: 0, hsame: 0 };
    let prev = null;
    for (let n = 0; n < 365; n++) {
      const k = new Date(Date.parse("2026-11-05") + n * 864e5).toISOString().slice(0, 10);
      const d = g.dailyList(k).map(g.probOf), h = g.hardList(k).map(g.probOf);
      if (d.some((p) => !p) || h.some((p) => !p) || d.map((p) => p.n).join() !== "4,5,6" || h.map((p) => p.n).join() !== "7,7") { out.bad.push(k); continue; }
      const sig = JSON.stringify(d.map((p) => [p.cell, p.target]));
      if (sig === prev) out.same++; prev = sig;
      if (JSON.stringify(h[0]) === JSON.stringify(h[1])) out.hsame++;
    }
    out.d1201 = JSON.stringify(g.dailyList("2026-12-01").map(g.probOf));
    return out;
  });
  check("今日の3問は毎日4本・5本・6本の道、上級は7本を2つ（1年分）", sel.bad.length === 0, sel.bad.slice(0, 3).join(","));
  check("前の日と同じ問題にならない・上級の2つは別の町（1年分）", sel.same === 0 && sel.hsame === 0);
  { const ctx = await browser.newContext(); const p2 = await ctx.newPage(); await p2.goto(url);
    const d2 = await p2.evaluate(() => { const g = window.__am; return JSON.stringify(g.dailyList("2026-12-01").map(g.probOf)); });
    await ctx.close();
    check("同じ日は別のブラウザで開いても同じ3問", sel.d1201 === d2); }

  // 3. 通しで遊ぶ
  check("初めて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  await page.keyboard.press("Escape"); await page.waitForTimeout(100); check("遊び方を Esc で閉じられる", await page.locator("#howto[open]").count() === 0);
  await page.reload(); await page.waitForTimeout(200); check("遊び方を Esc で閉じても、開き直したとき出ない", await page.locator("#howto[open]").count() === 0);
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(200); await page.click("#howto-ok"); await page.reload(); await page.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない", await page.locator("#howto[open]").count() === 0);
  { let again = 0; for (let i = 0; i < 10; i++) { await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(200); await page.keyboard.press("Escape"); await page.reload(); await page.waitForTimeout(200); again += await page.locator("#howto[open]").count(); } check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0); }
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(200); check("「わかった」を押したその場で「見た」が残る", await page.locator("#howto-ok").evaluate((b) => { b.click(); return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); }));
  await page.click("#go-d");
  let c = await curT(page);
  check("1問目は4本の道：手紙4通・家4軒・押す所は段×3、配達ボタンは押せない・いちばん少ない本数が出る", (await page.locator("#board .letter").count()) === 4 && (await page.locator("#board .house").count()) === 4 && (await page.locator("#board rect.hit").count()) === c.p.R * 3 && (await page.locator("#answer[disabled]").count()) === 1 && (await page.textContent("#ask")).includes(`${c.p.d}本`));
  const f1 = await freeCell(page);
  await page.click(f1);
  let n1 = await curT(page);
  check("空いた所を押すと横線が引ける（朱色の線が出る）", n1.add.length === 1 && (await page.locator("#board line.add").count()) === 1 && (await page.textContent("#left")).includes("横線 1本"));
  await page.click(f1);
  n1 = await curT(page);
  check("もう一度押すと消える", n1.add.length === 0 && (await page.locator("#board line.add").count()) === 0);
  { // となりに引けない・はじめからの横線と工事中は押しても変わらない
    const p = c.p; let adj = null, fix = null, blk = null;
    for (let r = 0; r < p.R; r++) for (let g = 0; g < p.n - 1; g++) { if (!adj && g < p.n - 2 && p.cell[r][g] === 0 && p.cell[r][g + 1] === 0 && p.cell[r][g - 1] !== 1 && p.cell[r][g + 2] !== 1) adj = [r, g]; if (!fix && p.cell[r][g] === 1) fix = [r, g]; if (!blk && p.cell[r][g] === 2) blk = [r, g]; }
    await page.click(cellSel(...adj)); await page.click(cellSel(adj[0], adj[1] + 1));
    const a1 = (await curT(page)).add.length;
    await page.click(cellSel(...fix)); await page.click(cellSel(...blk));
    const a2 = (await curT(page)).add.length;
    check("横線はとなり合わせに引けない・はじめからの横線は消せない・工事中には引けない", a1 === 1 && a2 === 1, `${a1} ${a2}`);
    await page.click(cellSel(...adj)); }
  // 手紙を押すと道が太くなる
  await page.click('#board .letter[data-i="0"]');
  check("手紙の字を押すと、その手紙の道が太くなる", await page.evaluate(() => window.__am.cur().sel === 0 && [...document.querySelectorAll("#board polyline")].some((e) => e.getAttribute("stroke-width") === "6")));
  await page.click("#hint");
  n1 = await curT(page);
  check("ヒント1回目で、いちばん少ない引き方の横線が1本（金色）引かれる", n1.hints === 1 && n1.hint.length === 1 && n1.add.length === 1 && T.bestAdd(c.p.cell, c.p.n, c.p.target) && minByCells(c.p.cell.map((row, r) => row.map((v, g) => (r === n1.hint[0][0] && g === n1.hint[0][1] ? 1 : v))), c.p.n, c.p.target) === c.p.d - 1);
  await page.click(cellSel(...n1.hint[0]));
  check("ヒントの横線は押しても消えない", (await curT(page)).add.length === 1);
  await page.click("#hint");
  n1 = await curT(page);
  check("ヒント2回目でもう1本、ヒントはもう押せない", n1.hints === 2 && n1.hint.length === 2 && (await page.locator("#hint[disabled]").count()) === 1);
  { // 色だけで分けない（routines/game-dev.md A1・WCAG 1.4.1）：横線の種類・着いた手紙・押す所の状態が、形・字・名前でも分かる
    const v = await page.evaluate(() => { const g = window.__am, c = g.cur(), p = c.p, b = document.getElementById("board"), fix = p.cell.flat().filter((x) => x === 1).length;
      const hits = [...b.querySelectorAll(".hit")], st = (r, gg) => (hits.find((h) => +h.dataset.r === r && +h.dataset.g === gg) || {}).getAttribute?.("aria-label") || "";
      const w = g.T.run(p.cell, p.n, c.add), houses = [...b.querySelectorAll(".house")];
      const dots = [...document.querySelectorAll(".dots i")].map((i) => i.getBoundingClientRect().height);
      return { hintMark: b.querySelectorAll(".hintmark").length === c.hint.length, pins: b.querySelectorAll(".pin").length === fix * 2,
        hitState: hits.every((h) => /：(横線なし|横線あり|ヒントの横線|はじめからの横線|工事中)$/.test(h.getAttribute("aria-label"))) && st(c.hint[0][0], c.hint[0][1]).endsWith("ヒントの横線"),
        arr: houses.length === p.n && houses.every((h, col) => { const t = h.querySelector(".arr").textContent, got = w.indexOf(col); return h.classList.contains("ok") ? t === "✓着" : t === "着" + g.T.NAMES[got]; }) && houses.every((h) => h.querySelector("title")),
        letters: [...b.querySelectorAll(".letter")].every((l, i) => l.getAttribute("role") === "button" && l.getAttribute("tabindex") === "0" && l.classList.contains("c" + i) && /家に着く/.test(l.getAttribute("aria-label"))),
        routes: [...b.querySelectorAll("polyline")].every((e, i) => e.classList.contains("rt") && e.classList.contains("c" + i)),
        dots: dots.length === 3 && dots[0] > dots[1] && dots[0] > dots[2] };
    });
    check("色だけで分けない：ヒントの横線に○・はじめからの横線の両はしに●・家の下に着いた手紙の字（✓着／着○）", v.hintMark && v.pins && v.arr, JSON.stringify(v));
    check("色だけで分けない：押す所の名前に状態（横線なし・あり・ヒント・はじめから・工事中）、手紙は押せる部品で着く家を名前で言う", v.hitState && v.letters && v.routes, JSON.stringify(v));
    check("色だけで分けない：進み具合の点は、いまの問題が高い（形でも分かる）", v.dots, JSON.stringify(v));
    const cvd = await page.evaluate(() => { document.documentElement.classList.add("a11y-cvd"); const ls = [...document.querySelectorAll("#board polyline")].map((e) => getComputedStyle(e).strokeDasharray + "|" + getComputedStyle(e).stroke); document.documentElement.classList.remove("a11y-cvd"); return ls; });
    check("「色の見分けを助ける」で手紙の道ごとに線の模様と色の組が替わる（どれもちがう）", new Set(cvd.map((x) => x.split("|")[0])).size === cvd.length && new Set(cvd.map((x) => x.split("|")[1])).size === cvd.length, cvd.join(" / "));
    const f0 = await freeCell(page);
    await page.focus(f0); await page.keyboard.press("Enter"); await page.waitForTimeout(120);
    const kb = await page.evaluate(() => ({ n: window.__am.cur().add.length, live: document.getElementById("live").textContent, role: document.getElementById("live").getAttribute("role") }));
    check("キーボード（Enter）でも横線を引け、知らせ（role=status）に文字で出る", kb.n === 3 && kb.role === "status" && /横線を引いた/.test(kb.live), JSON.stringify(kb));
    await page.focus(f0); await page.keyboard.press(" "); await page.waitForTimeout(60);
    await page.focus('#board .letter[data-i="1"]'); await page.keyboard.press("Enter");
    check("キーボードで手紙を選べる（Enter）", (await curT(page)).add.length === 2 && (await page.evaluate(() => window.__am.cur().sel)) === 1);
    await page.focus('#board .letter[data-i="1"]'); await page.keyboard.press("Enter"); }
  await page.reload(); await page.click("#go-d");
  n1 = await curT(page);
  check("途中で閉じても、引いた横線・ヒントはそのまま（続きから）", n1.hints === 2 && n1.hint.length === 2 && n1.add.length === 2 && (await page.textContent("#left")).includes("ヒント 2"));
  await page.click("#back"); await page.click("#go-p"); await page.locator(".lv button").first().click(); await page.click("#back"); await page.click("#go-d");
  check("練習を始めても、今日の途中経過は消えない", (await curT(page)).hints === 2 && (await page.evaluate(() => window.__am.mode())) === "d");
  await solveNow(page);
  n1 = await curT(page);
  check("全部届くと配達でき、ヒント2回でいちばん少ない本数なら★1", n1.done && (await page.locator(".verdict .stars .off").textContent()).length === 2 && (await page.locator("#board.win").count()) === 1);
  check("取れなかった星は ☆（色だけで分けない）", (await page.locator(".verdict .stars .off").textContent()) === "☆☆" && (await page.locator(".verdict[role=status]").count()) === 1);
  await page.click("#next");
  // 別のタブで先に進んでいたら、古い画面の答えは足さない
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.push({ m: 0, h: 0 }); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await solveNow(page);
  check("別のタブで先に進んでいたら、古い画面の答えは足さず今の問題を出し直す", (await page.evaluate(() => window.__am.load().runs.d.res.length)) === 2 && (await page.textContent("header")).includes("3/3"));
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.pop(); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload(); await page.click("#go-d");
  { // 届かないうちは配達できない。余分な横線（同じすき間に2本続けて＝もとに戻る）は★を減らす
    const c2 = await curT(page);
    check("2問目は5本の道で、全部届くまで配達ボタンは押せない", c2.p.n === 5 && (await page.locator("#answer[disabled]").count()) === 1);
    await solveNow(page); await page.click("#next");
    await solveNow(page); await page.click("#next"); }
  const share = await page.textContent(".share");
  const r3 = await page.evaluate(() => { const g = window.__am; return g.load().days[g.todayKey()].r; });
  check("3問で結果・シェアの文は番号と色だけ", /あみだ配達 #\d+/.test(share) && /^💡🟩🟩/.test(share.split("\n")[1] || "") && r3.length === 3 && r3[0].m === 0 && r3[0].h === 2);
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("結果に3つの町と本数が出る", (await page.locator(".res div").count()) === 3 && (await page.textContent(".res")).includes(`いちばん少ないと${c.p.d}本`));
  check("ヒントを使った日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  check("今日の3問を終えると、取れた実績が結果に出る", (await page.textContent(".newach")).includes("はじめての配達"));
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる・届けた手紙3", (await page.textContent(".stats")).includes("1連続の日") && (await page.textContent(".stats")).includes("3届けた手紙") && (await page.textContent("#go-d")).includes("結果"));
  // 上級
  await page.click("#go-h");
  check("上級は7本の道・ヒントのボタンが無い", (await page.locator("#board .letter").count()) === 7 && (await page.locator("#hint").count()) === 0);
  await solveNow(page); await page.click("#next");
  check("上級の2つ目も7本の道", (await page.locator("#board .letter").count()) === 7);
  await solveNow(page); await page.click("#next");
  check("上級を全部いちばん少ない本数で初めて終えると、結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1 && (await page.textContent(".big")).includes("いちばん少ない"));
  check("上級を2つともぴったりで終えると、実績「上級に挑む」「七本道の名人」が出る", /上級に挑む/.test(await page.textContent(".newach")) && /七本道の名人/.test(await page.textContent(".newach")));
  await page.click("#back"); await page.click("#go-h");
  check("2回目に結果を開いても Ko-fi のひとことは出ない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  // 練習：余分な横線2本（同じすき間に上下続けて引くと、もとに戻る）で★2
  // 練習の問題は乱数なので、検査では「上下続けて2本引ける所」がある種を先に選んで練習の回に入れる（検査の期待値を乱数に頼らない）
  const pairOf = (p) => { const best = T.bestAdd(p.cell, p.n, p.target), on = (r, g) => g >= 0 && g < p.n - 1 && (p.cell[r][g] === 1 || best.some((x) => x[0] === r && x[1] === g)); for (let r = 0; r + 1 < p.R; r++) for (let g = 0; g < p.n - 1; g++) if ([r, r + 1].every((rr) => p.cell[rr][g] === 0 && !on(rr, g) && !on(rr, g - 1) && !on(rr, g + 1))) return { best, pair: [[r, g], [r + 1, g]] }; return null; };
  let pseed = 1; while (!pairOf(T.make(pseed, T.SIZES[0]))) pseed++;
  await page.evaluate(([k, seed]) => { const s = JSON.parse(localStorage.getItem(k)), d = window.__am.todayKey(); s.runs.p = { mode: "p", date: d, list: [{ lv: 0, seed }], res: [], cur: null, id: "qa" }; localStorage.setItem(k, JSON.stringify(s)); window.__am.play("p"); }, [KEY, pseed]);
  { const p = (await curT(page)).p, { best, pair } = pairOf(p);
    for (const [r, g] of best.concat(pair || [])) await page.click(cellSel(r, g));
    await page.click("#answer");
    check("いちばん少ない本数より2本多く引いて届けると★2（練習）", !!pair && (await curT(page)).done && (await page.locator(".verdict .stars .off").textContent()).length === 1 && (await page.textContent(".verdict")).includes(`いちばん少ないと${p.d}本`), JSON.stringify(pair));
    await page.click("#next"); }
  const after = await page.evaluate(() => { const s = window.__am.load(); return { days: Object.keys(s.days).length, total: s.total, cnt0: s.cnt[0], perf0: s.perf[0] || 0 }; });
  check("練習は今日の記録を増やさず、届けた手紙と配達帳には入る（ぴったりでないものは、ぴったりの数に入れない）", after.days === 1 && after.total === 6 && after.cnt0 === 2 && after.perf0 === 0 && (await page.locator(".share").count()) === 0, JSON.stringify(after));
  await page.click("#back"); await page.click("#go-ach");
  { const got = await page.locator(".achs div.got").count(), txt = await page.textContent(".achs");
    check("実績の画面：取れたものは★、まだのものは進み具合（ぴったりの数は今日・上級だけで練習を数えない）", got >= 3 && txt.includes("4/10") && txt.includes("6/100"), `${got} ${txt.slice(0, 80)}`); }
  check("続けて遊んだ日の最長は、日付が1日ずつ続くところだけ数える", await page.evaluate(() => window.__am.maxStreak({ "2026-01-01": 1, "2026-01-02": 1, "2026-01-04": 1, "2026-01-05": 1, "2026-01-06": 1 }) === 3 && window.__am.maxStreak({}) === 0));
  await page.click("#back"); await page.click("#go-dex");
  check("配達帳に道の数ごとの届けた数が出る", (await page.locator(".res div").count()) === 4 && (await page.textContent(".res")).includes("2通") && (await page.textContent("h1")).includes("6通"));
  await page.close();

  // 4. スマホ幅：はみ出さない・押せる所は44px以上・上級の7本でも盤の押す所は40×44以上
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); const fb2 = await p3.evaluate(() => { const a = document.querySelector("#howto #fb2"); return a ? a.getBoundingClientRect().height : 0; }); check(`幅${w}px：遊び方の「感想を送る」も高さ44px以上`, fb2 >= 44, `${fb2}px`); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id || e.textContent.trim().slice(0, 6)) }));
    check(`幅${w}px：横にはみ出さず、押せる所は高さ44px以上`, homeOk && !r.over && r.small.length === 0, r.small.join(","));
    await p3.click("#back"); await p3.click("#go-p"); await p3.click('.lv button[data-lv="3"]');
    const r7 = await p3.evaluate(() => { const h = [...document.querySelectorAll("#board rect.hit")].map((e) => e.getBoundingClientRect()); return { minW: Math.min(...h.map((b) => b.width)), minH: Math.min(...h.map((b) => b.height)), over: document.documentElement.scrollWidth > innerWidth, font: Math.min(...[...document.querySelectorAll("#board text")].map((t) => t.getBoundingClientRect().height)) }; });
    check(`幅${w}px：上級の7本でも盤の押す所は40×44px以上・はみ出さない・字は9px以上`, r7.minW >= 40 && r7.minH >= 44 && !r7.over && r7.font >= 9, JSON.stringify(r7));
    await p3.close();
  }
  { // 保存してあった引き方が壊れていたら使わない
    const pv = await newPage(); await pv.click("#howto-ok");
    const broken = await pv.evaluate((k) => {
      const g = window.__am, d = g.todayKey(), list = g.dailyList(d), p = g.probOf(list[0]);
      let fix = null, blk = null, adj = null, free = null;
      for (let r = 0; r < p.R; r++) for (let x = 0; x < p.n - 1; x++) { if (!fix && p.cell[r][x] === 1) fix = [r, x]; if (!blk && p.cell[r][x] === 2) blk = [r, x]; if (!adj && x < p.n - 2 && p.cell[r][x] === 0 && p.cell[r][x + 1] === 0) adj = [[r, x], [r, x + 1]]; if (!free && p.cell[r][x] === 0) free = [r, x]; }
      const cases = [{ add: [fix], hint: [] }, { add: [blk], hint: [] }, { add: adj, hint: [] }, { add: [free, free], hint: [] }, { add: [[99, 0]], hint: [] }, { add: [], hint: [free], hints: 1 }, { add: "x", hint: [] }];
      const out = cases.map((cc) => g.valid(p, Object.assign({ hints: 0, moves: 1 }, cc)));
      out.push(!g.valid(p, { add: [free], hint: [free], hints: 1, moves: 2 })); // 正しいものは使う（反対にして並べる）
      localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list, res: [], cur: { i: 0, add: [fix], hint: [], hints: 1, moves: 3 }, id: "a" } } }));
      return out; }, KEY);
    await pv.reload(); await pv.click("#go-d");
    check("壊れた途中経過（はじめからの横線・工事中・となり合わせ・同じ所2回・盤の外・ヒントの線が無い・形がちがう）は使わず、はじめから", broken.every((x) => x === false) && (await curT(pv)).add.length === 0 && (await curT(pv)).hints === 0, JSON.stringify(broken));
    await pv.close(); }
  { // 別のタブで同じ問題のヒントが多く保存されていたら、古いタブで配達しても多いほうを記録する
    const pz = await newPage(); await pz.click("#howto-ok"); await pz.click("#go-d");
    await pz.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.cur = { i: 0, add: [], hint: [], hints: 2, moves: 999 }; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    await solveNow(pz);
    const rz = await pz.evaluate(() => window.__am.load().runs.d.res[0]);
    check("別のタブで保存したヒントの数を、古いタブで配達しても消さない（★を増やさない。2026-11-05 CodeRabbit）", rz && rz.m === 0 && rz.h === 2 && (await pz.locator(".verdict .stars .off").textContent()).length === 2, JSON.stringify(rz));
    await pz.close(); }
  { // 同じ回数で古いタブが保存しても、保存済みのヒントの数を消さない
    const py = await newPage(); await py.click("#howto-ok"); await py.click("#go-d");
    await py.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.cur = { i: 0, add: [], hint: [], hints: 1, moves: 1 }; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    const free = await py.evaluate(() => { const c = window.__am.cur().p.cell; for (let r = 0; r < c.length; r++) for (let g = 0; g < c[r].length; g++) if (!c[r][g] && !(c[r][g - 1]) && !(c[r][g + 1])) return [r, g]; return null; });
    await py.click(cellSel(free[0], free[1]));
    const ry = await py.evaluate(() => window.__am.load().runs.d.cur);
    check("同じ回数で古いタブが保存しても、保存済みのヒントの多いほうを残す（2026-11-05 CodeRabbit）", ry && ry.hints === 1 && ry.moves === 1 && ry.add.length === 1, JSON.stringify(ry));
    await py.close(); }
  { // 保存できないブラウザでも遊べる
    const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pb.on("pageerror", (e) => errors.push(e.message));
    await pb.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
    await pb.goto(url); await pb.click("#howto-ok"); await pb.click("#go-d");
    await pb.click(await freeCell(pb));
    check("保存できないブラウザでも、今日の1問目で横線を引ける", (await pb.textContent("header")).includes("1/3") && (await curT(pb)).add.length === 1);
    await solveNow(pb);
    check("保存できないブラウザでも、1問目を配達できる", (await curT(pb)).done);
    await pb.click("#back");
    check("保存できないブラウザでも、遊び方が何度も開かない", !(await pb.locator("#howto[open]").count()));
    await pb.close(); }
  { // 前の記録が残っていて、書き込みだけ失敗するとき
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pq.on("pageerror", (e) => errors.push(e.message));
    await pq.addInitScript(() => { const orig = Storage.prototype.setItem; orig.call(localStorage, "amida-haitatsu-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: {} })); Storage.prototype.setItem = () => { throw new Error("full"); }; });
    await pq.goto(url); await pq.click("#go-d");
    check("前の記録があり書き込みだけ失敗しても、今日の1問目が始まる", (await pq.textContent("header")).includes("1/3"));
    await pq.close(); }
  { const pc = await newPage();
    await pc.evaluate((k) => { const g = window.__am, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pc.reload();
    check("最後の1問のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__am; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  { const pm = await newPage();
    await pm.evaluate((k) => { const g = window.__am, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pm.reload();
    const had = await pm.locator("#go-h").count();
    await pm.evaluate(() => { const RD = Date, off = 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; });
    if (had) await pm.click("#go-h");
    check("結果を開いたまま日付が変わったら、上級のボタンを押しても翌日の上級は始まらない", had > 0 && (await pm.evaluate(() => window.__am.mode())) !== "h");
    await pm.close(); }
  { const pn = await newPage();
    await pn.evaluate((k) => { const g = window.__am, d = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pn.reload();
    check("前の日に終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__am; return !!g.load().days[new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10)] && !g.load().runs.d; }));
    check("前の日の結果の画面からは、今日の上級を始められない（今日の分を先に）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__am, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, KEY));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残し、配達帳の数は多いほう", await pn.evaluate((K) => { const g = window.__am, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": 1 }, cnt: { 0: 9 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 }, cnt: { 0: 2 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"] && r.cnt["0"] === 9; }, KEY));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__am, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, lv: 0, idx: 0 }], id: "x", res: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: { d: Object.assign({}, base) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: { d: Object.assign({}, base, { res: [{ m: 0, h: 0 }] }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（その日を終えた記録があれば null を使う・終えた回は日ごとの結果に残す）", await pn.evaluate((K) => { const g = window.__am, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b, dd) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }, dd ? { days: Object.assign({}, s0.days, dd) } : {}))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }, { "2000-01-01": 1 }), r3 = put({ d: base }, { d: null }), r4 = put({ d: done }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null && !!r3.runs.d && r3.runs.d.date === "2000-01-01" && r4.runs.d === null && !!r4.days["2000-01-01"]; }, KEY));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__am, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, KEY));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__am, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, KEY));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__am, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, KEY));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, KEY));
    check("進み具合は終えた問題の数を先に比べる（横線を引いた回数が多くても、終えた問題のある記録を消さない）", await pn.evaluate((K) => { const g = window.__am, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, lv: 0, idx: 0 }, { seed: 2, lv: 0, idx: 1 }], id: "x" }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { res: [], cur: { i: 0, add: [], hint: [], hints: 0, moves: 1500 } }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: Object.assign({}, base, { res: [{ m: 0, h: 0 }], cur: null }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("できたときに別のタブで回が変わって保存できなかったら、できた画面を出さない", await pn.evaluate(() => /let saved = false/.test(deliver.toString()) && /if \(!saved\)/.test(deliver.toString())));
    await pn.evaluate(() => { location.hash = ""; }); await pn.reload(); await pn.click("#go-p"); await pn.click('.lv button[data-lv="3"]');
    check("練習の上級（7本）も、ヒントのボタンが無い", (await pn.locator("#hint").count()) === 0 && (await pn.evaluate(() => window.__am.cur().hard)) === true);
    await pn.close(); }
} catch (e) {
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  try { // 引き継ぎコード（別の端末へ記録を移す。shared-workflows template/qa/transfer-check.mjs）
    await checkTransfer({ browser, url, game: "amida-haitatsu", sample: { "amida-haitatsu-v1": JSON.stringify({ v: 1, tut: true }) }, check, open: async (p) => { await p.click("#howto-ok", { timeout: 1500 }).catch(() => {}); } });
  } catch (e) { check("引き継ぎコード", false, e.message.split("\n")[0]); }
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し。routines/game-dev.md「だれでも遊べるように」）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# あみだ配達 QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
