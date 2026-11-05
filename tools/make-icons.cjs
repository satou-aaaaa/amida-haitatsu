// アプリのアイコン（icon-192.png・icon-512.png）を作る。縦の道3本に、朱色の横線1本と手紙。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#e3ece6"/>
      <g stroke="#26323a" stroke-width="6" stroke-linecap="round"><line x1="25" y1="22" x2="25" y2="72"/><line x1="50" y1="22" x2="50" y2="72"/><line x1="75" y1="22" x2="75" y2="72"/><line x1="25" y1="36" x2="50" y2="36"/></g>
      <line x1="50" y1="56" x2="75" y2="56" stroke="#d2492f" stroke-width="7" stroke-linecap="round"/>
      <rect x="15" y="9" width="20" height="14" rx="2" fill="#fffdf7" stroke="#d2492f" stroke-width="2.5"/><path d="M15 10 l10 7 l10 -7" fill="none" stroke="#d2492f" stroke-width="2.5"/>
      <path d="M65 84 l10 -9 l10 9 v10 h-20 z" fill="#fffdf7" stroke="#2f8a5b" stroke-width="3" stroke-linejoin="round"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
