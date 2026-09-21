# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shots.pw.ts >> Viewport 1440x900 >> /backtracking — no overflow, no errors, attribution readable
- Location: scripts\shots.pw.ts:58:7

# Error details

```
Error: [1440x900] /backtracking: attribution element not found

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  17  | import { fileURLToPath } from 'url'
  18  | 
  19  | const __filename = fileURLToPath(import.meta.url)
  20  | const __dirname = path.dirname(__filename)
  21  | 
  22  | const ROUTES = ['/', '/simulation', '/investigation', '/backtracking', '/attribution', '/report']
  23  | 
  24  | const VIEWPORTS = [
  25  |   { label: '1920x1080', width: 1920, height: 1080 },
  26  |   { label: '1440x900', width: 1440, height: 900 },
  27  |   { label: '1280x800', width: 1280, height: 800 },
  28  |   { label: '768x1024', width: 768, height: 1024 },
  29  | ]
  30  | 
  31  | const BASE_URL = 'http://localhost:3000'
  32  | const SHOT_DIR = path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots')
  33  | 
  34  | /** Route slug for use in filenames. */
  35  | function routeSlug(route: string): string {
  36  |   return route === '/' ? 'command-center' : route.replace(/^\//, '').replace(/\//g, '-')
  37  | }
  38  | 
  39  | /** Collect console errors logged during page load. */
  40  | function collectErrors(page: Page): string[] {
  41  |   const errs: string[] = []
  42  |   page.on('console', (msg) => {
  43  |     if (msg.type() === 'error') errs.push(msg.text())
  44  |   })
  45  |   return errs
  46  | }
  47  | 
  48  | // Ensure screenshot directories exist before tests run
  49  | test.beforeAll(() => {
  50  |   for (const vp of VIEWPORTS) {
  51  |     fs.mkdirSync(path.join(SHOT_DIR, vp.label), { recursive: true })
  52  |   }
  53  | })
  54  | 
  55  | for (const vp of VIEWPORTS) {
  56  |   test.describe(`Viewport ${vp.label}`, () => {
  57  |     for (const route of ROUTES) {
  58  |       test(`${route} — no overflow, no errors, attribution readable`, async ({ browser }) => {
  59  |         const context: BrowserContext = await browser.newContext({
  60  |           viewport: { width: vp.width, height: vp.height },
  61  |         })
  62  |         const page = await context.newPage()
  63  |         const consoleErrors = collectErrors(page)
  64  | 
  65  |         await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30_000 })
  66  |         // Give React one extra tick to paint
  67  |         await page.waitForTimeout(600)
  68  | 
  69  |         // Capture screenshot
  70  |         const shotPath = path.join(SHOT_DIR, vp.label, `${routeSlug(route)}.png`)
  71  |         await page.screenshot({ path: shotPath, fullPage: false })
  72  | 
  73  |         // ── Assertion 1: No horizontal overflow ──────────────────────────────
  74  |         const overflow = await page.evaluate(() => {
  75  |           return document.body.scrollWidth > document.body.clientWidth + 2
  76  |         })
  77  |         expect(overflow, `[${vp.label}] ${route}: horizontal overflow detected`).toBe(false)
  78  | 
  79  |         // ── Assertion 2: No console errors ───────────────────────────────────
  80  |         // Filter out known benign map-tile 4xx that appear in dev mode
  81  |         const realErrors = consoleErrors.filter(
  82  |           (e) =>
  83  |             !e.includes('Failed to load resource') &&
  84  |             !e.includes('ERR_BLOCKED_BY_RESPONSE') &&
  85  |             !e.includes('chrome-extension'),
  86  |         )
  87  |         expect(realErrors, `[${vp.label}] ${route}: console errors`).toHaveLength(0)
  88  | 
  89  |         // ── Assertion 3 & 4: Attribution (map pages only) ────────────────────
  90  |         const isMapRoute = route !== '/report'
  91  |         if (isMapRoute) {
  92  |           // Wait briefly for MapLibre to paint
  93  |           await page.waitForTimeout(800)
  94  | 
  95  |           const attrResult = await page.evaluate(() => {
  96  |             // MapLibre renders the attribution inside .maplibregl-ctrl-attrib
  97  |             const el = document.querySelector('.maplibregl-ctrl-attrib') as HTMLElement | null
  98  |             if (!el) return { found: false, clipped: false, covered: false }
  99  | 
  100 |             const rect = el.getBoundingClientRect()
  101 |             // Assertion 3: content not clipped (scrollWidth should equal or be < clientWidth)
  102 |             const clipped = el.scrollWidth > el.clientWidth + 2
  103 | 
  104 |             // Assertion 4: the element at the centre of the attribution rect should be
  105 |             // the attribution element itself (or a child of it), not an overlay panel
  106 |             const cx = Math.round(rect.left + rect.width / 2)
  107 |             const cy = Math.round(rect.top + rect.height / 2)
  108 |             const topEl = document.elementFromPoint(cx, cy)
  109 |             const covered = !el.contains(topEl)
  110 | 
  111 |             return { found: true, clipped, covered }
  112 |           })
  113 | 
  114 |           expect(
  115 |             attrResult.found,
  116 |             `[${vp.label}] ${route}: attribution element not found`,
> 117 |           ).toBe(true)
      |             ^ Error: [1440x900] /backtracking: attribution element not found
  118 | 
  119 |           expect(
  120 |             attrResult.clipped,
  121 |             `[${vp.label}] ${route}: attribution text is clipped`,
  122 |           ).toBe(false)
  123 | 
  124 |           // "covered" is informational — log but don't hard-fail
  125 |           // (overlapping the attribution with the HUD on mobile is a known trade-off)
  126 |           if (attrResult.covered) {
  127 |             console.warn(`[${vp.label}] ${route}: attribution element is covered by another element`)
  128 |           }
  129 |         }
  130 | 
  131 |         await context.close()
  132 |       })
  133 |     }
  134 |   })
  135 | }
  136 | 
```