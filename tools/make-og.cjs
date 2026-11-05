// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題は入れず、見本のあみだだけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const X = [720, 820, 920, 1020], C = ["#d2492f", "#2f6fb0", "#2f8a5b", "#9b4fb0"], L = ["あ", "い", "う", "え"];
  const svg = `<svg width="460" height="470" viewBox="660 100 460 470" style="position:absolute;left:660px;top:100px">
    <g stroke="#26323a" stroke-width="7" stroke-linecap="round">${X.map((x) => `<line x1="${x}" y1="190" x2="${x}" y2="470"/>`).join("")}<line x1="720" y1="250" x2="820" y2="250"/><line x1="920" y1="300" x2="1020" y2="300"/></g>
    <g stroke="#d2492f" stroke-width="9" stroke-linecap="round"><line x1="820" y1="360" x2="920" y2="360"/><line x1="720" y1="420" x2="820" y2="420"/></g>
    ${X.map((x, i) => `<rect x="${x - 30}" y="120" width="60" height="60" rx="12" fill="${C[i]}"/><text x="${x}" y="164" font-size="36" font-weight="900" fill="#fff" text-anchor="middle">${L[i]}</text>`).join("")}
    ${X.map((x) => `<path d="M${x - 30} 520 l30 -26 l30 26 v40 h-60 z" fill="#fffdf7" stroke="#26323a66" stroke-width="4"/>`).join("")}</svg>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 80px;background:#e3ece6;color:#26323a;position:relative;overflow:hidden">
    <div style="font-size:34px;color:#9b3220;letter-spacing:.1em">だれでも同じ 1日3問・3分</div>
    <div style="font-size:100px;font-weight:900;margin-top:16px;letter-spacing:.04em">あみだ配達</div>
    <div style="font-size:40px;margin-top:18px;line-height:1.5">いちばん少ない横線で、<br>手紙を届けられる？</div>
    ${svg}
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
