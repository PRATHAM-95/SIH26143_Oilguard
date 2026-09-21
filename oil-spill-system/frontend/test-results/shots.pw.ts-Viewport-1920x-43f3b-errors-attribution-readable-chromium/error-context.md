# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shots.pw.ts >> Viewport 1920x1080 >> / — no overflow, no errors, attribution readable
- Location: scripts\shots.pw.ts:60:7

# Error details

```
Error: [1920x1080] /: attribution element not found

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
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
  41  |   const consoleErrors: string[] = []
  42  |   page.on('pageerror', (err) => consoleErrors.push(err.message))
  43  |   page.on('console', (msg) => {
  44  |     if (msg.type() === 'error') consoleErrors.push(msg.text())
  45  |     else console.log(`[PAGE CONSOLE] ${msg.text()}`)
  46  |   })
  47  |   return consoleErrors
  48  | }
  49  | 
  50  | // Ensure screenshot directories exist before tests run
  51  | test.beforeAll(() => {
  52  |   for (const vp of VIEWPORTS) {
  53  |     fs.mkdirSync(path.join(SHOT_DIR, vp.label), { recursive: true })
  54  |   }
  55  | })
  56  | 
  57  | for (const vp of VIEWPORTS) {
  58  |   test.describe(`Viewport ${vp.label}`, () => {
  59  |     for (const route of ROUTES) {
  60  |       test(`${route} — no overflow, no errors, attribution readable`, async ({ browser }) => {
  61  |         const context: BrowserContext = await browser.newContext({
  62  |           viewport: { width: vp.width, height: vp.height },
  63  |         })
  64  |         const page = await context.newPage()
  65  |         const consoleErrors = collectErrors(page)
  66  | 
  67  |         await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30_000 })
  68  |         // Give React one extra tick to paint
  69  |         await page.waitForTimeout(600)
  70  | 
  71  |         // Capture screenshot
  72  |         const shotPath = path.join(SHOT_DIR, vp.label, `${routeSlug(route)}.png`)
  73  |         await page.screenshot({ path: shotPath, fullPage: false })
  74  | 
  75  |         // ── Assertion 1: No horizontal overflow ──────────────────────────────
  76  |         const overflow = await page.evaluate(() => {
  77  |           return document.body.scrollWidth > document.body.clientWidth + 2
  78  |         })
  79  |         expect(overflow, `[${vp.label}] ${route}: horizontal overflow detected`).toBe(false)
  80  | 
  81  |         // ── Assertion 2: No console errors ───────────────────────────────────
  82  |         // Filter out known benign map-tile 4xx that appear in dev mode
  83  |         const realErrors = consoleErrors.filter(
  84  |           (e) =>
  85  |             !e.includes('Failed to load resource') &&
  86  |             !e.includes('ERR_BLOCKED_BY_RESPONSE') &&
  87  |             !e.includes('chrome-extension'),
  88  |         )
  89  |         expect(realErrors, `[${vp.label}] ${route}: console errors`).toHaveLength(0)
  90  | 
  91  |         // ── Assertion 3 & 4: Attribution (map pages only) ────────────────────
  92  |         const isMapRoute = route !== '/report'
  93  |         if (isMapRoute) {
  94  |           // Wait for MapLibre attribution to mount
  95  |           const mapLocator = page.locator('.maplibregl-map')
  96  |           await mapLocator.waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {})
  97  |           await page.waitForTimeout(500)
  98  | 
  99  |           const attrResult = await page.evaluate(() => {
  100 |             const mapEl = document.querySelector('.maplibregl-map')
  101 |             if (mapEl) console.log("MAP_DOM:", mapEl.innerHTML)
  102 |             
  103 |             // MapLibre renders the attribution inside .maplibregl-ctrl-attrib
  104 |             const el = document.querySelector('.maplibregl-ctrl-attrib') as HTMLElement | null
  105 |             if (!el) return { found: false, clipped: false, covered: false }
  106 | 
  107 |             const rect = el.getBoundingClientRect()
  108 |             // Assertion 3: content not clipped (scrollWidth should equal or be < clientWidth)
  109 |             const clipped = el.scrollWidth > el.clientWidth + 2
  110 | 
  111 |             // Assertion 4: the element at the centre of the attribution rect should be
  112 |             // the attribution element itself (or a child of it), not an overlay panel
  113 |             const cx = Math.round(rect.left + rect.width / 2)
  114 |             const cy = Math.round(rect.top + rect.height / 2)
  115 |             const topEl = document.elementFromPoint(cx, cy)
  116 |             const covered = topEl ? !el.contains(topEl) : false
  117 | 
  118 |             return { found: true, clipped, covered }
  119 |           })
  120 | 
  121 |           expect(
  122 |             attrResult.found,
  123 |             `[${vp.label}] ${route}: attribution element not found`,
> 124 |           ).toBe(true)
      |             ^ Error: [1920x1080] /: attribution element not found
  125 | 
  126 |           expect(
  127 |             attrResult.clipped,
  128 |             `[${vp.label}] ${route}: attribution text is clipped`,
  129 |           ).toBe(false)
  130 | 
  131 |           // "covered" is informational — log but don't hard-fail
  132 |           // (overlapping the attribution with the HUD on mobile is a known trade-off)
  133 |           if (attrResult.covered) {
  134 |             console.warn(`[${vp.label}] ${route}: attribution element is covered by another element`)
  135 |           }
  136 |         }
  137 | 
  138 |         await context.close()
  139 |       })
  140 |     }
  141 |   })
  142 | }
  143 | 
```