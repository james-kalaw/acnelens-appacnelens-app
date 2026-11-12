// node validation/pdf.cjs input.html output.pdf [landscape]
const { chromium } = require("playwright"); const path = require("path");
(async () => {
  const [, , inp, out] = process.argv; const b = await chromium.launch(); const p = await b.newPage();
  await p.goto("file://" + path.resolve(inp)); await p.waitForLoadState("networkidle");
  await p.pdf({ path: out, preferCSSPageSize: true, printBackground: true }); await b.close();
})();
