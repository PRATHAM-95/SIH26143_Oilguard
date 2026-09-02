# 🖥️ Member 4/5 — Frontend Developer

> **PS:** SIH26143 — Satellite Oil-Spill Detection + AIS Vessel Attribution (NTRO, Space Tech, Software)
> **Your one-line job:** Turn JSON evidence into the moment judges remember — a live map where the ocean **rewinds**, ships light up, and one suspect turns red.

---

## 🎯 Your Mission in Plain Words

Three screens:

1. **Dashboard** — list of monitored zones/incidents + India overview map
2. **Incident view** — the star of the demo: slick polygon, drift animation, AIS tracks, and a **time slider that plays BACKWARDS**
3. **Suspect dossier** — ranked cards, per-factor score bars, one-click PDF case file

Good news: your stack is already installed in this repo (`frontend/package.json`):

| Already there | Used for |
|---|---|
| React 19 + Vite + Tailwind CSS v4 | app shell + styling |
| `react-leaflet` + `leaflet` | all map layers |
| `recharts` | score bars, timeline charts |
| `lucide-react` | icons |
| `motion` | smooth animations |
| `axios` | API calls |
| `react-router-dom` | routing |
| `html2canvas` + `jspdf` + `jspdf-autotable` | PDF case-file export |

---

## 🗺️ Route Map

```
/                  → Dashboard (zones grid + mini India map)
/incident/:id      → THE map view (layers + rewind slider)
/suspects/:id      → Ranked dossiers for an incident
```

```tsx
// src/App.tsx
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/incident/:id" element={<IncidentMap />} />
  <Route path="/suspects/:id" element={<SuspectDossiers />} />
</Routes>
```

Suggested structure:

```
src/
├── components/
│   ├── map/        MapShell, SlickLayer, DriftAnimation, AisTracks, SuspectMarkers
│   ├── dossier/    SuspectCard, FactorBars, EvidenceChips
│   └── controls/   TimeSlider, PlayButton, LayerToggles
├── pages/          Dashboard, IncidentMap, SuspectDossiers
├── api/            client.ts, types.ts, endpoints.ts
└── mocks/          incident.json, suspects.json   ← build UI BEFORE backend exists
```

---

## 🌊 The Map Layers (bottom to top)

| Layer | Source | Render as |
|---|---|---|
| Basemap | OSM tiles (dark style preferred) | `TileLayer` |
| Slick polygon | `/api/incidents/:id` → GeoJSON | `Polygon` red fill, opacity 0.45 |
| Origin heatmap | drift output frames | `CircleMarker` grid colored by probability |
| AIS tracks | clean tracks per vessel | `Polyline` per MMSI, muted colors |
| Suspects | top-ranked vessels | pulsing `CircleMarker` — #1 red, rest amber |

⚠️ Classic Vite+Leaflet bug on Day 1 — marker icons vanish. Fix once globally:

```ts
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
const DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow });
L.Marker.prototype.options.icon = DefaultIcon;
```

Performance rule: hundreds of track points → pass `renderer={L.canvas()}` to the Map; never render 10k markers as DOM nodes.

## ⏪ The Rewind Slider — Your Demo Weapon

Backend gives drift output as N time-frames (GeoJSON point-sets per timestep). You pre-load them, then step through on a timer:

```tsx
const [frame, setFrame] = useState(frames.length - 1);
useEffect(() => {
  if (!playing) return;
  const t = setInterval(() => {
    setFrame(f => (f - 1 + frames.length) % frames.length); // REVERSE = default!
  }, 400);
  return () => clearInterval(t);
}, [playing]);
```

UI requirements:
- Slider bound to frame index; label shows `T−6h … T0` going backwards
- ▶️ button toggles play; direction defaults to **rewind**
- Particles visually converge → origin zone glows → suspect markers pop in (`motion` scale/fade)
- This 15-second sequence is the pitch — rehearse it

## 📁 Suspect Dossier Panel

Each card: rank badge, MMSI + vessel name, total score, four factor bars via recharts:

```tsx
<BarChart data={[{ f: "Proximity", v: p * 100 }, { f: "Consistency", v: c * 100 },
                { f: "Dark window", v: d * 100 }, { f: "Anomaly", v: a * 100 }]}>
  <Bar dataKey="v" fill="#ef4444" />
</BarChart>
```

Plus evidence chips (e.g., `AIS gap 47 min`, `3.1 km from origin mode`) and a confidence note: *"Ranked evidence, not a verdict."*

## 📄 PDF Case-File Export (jsPDF already installed)

Button → `html2canvas(mapContainer)` screenshot + autoTable of suspect factors → `doc.save("case_file.pdf")`. Judges get a physical artifact — cheap to build, huge perceived value.

---

## 🔌 API Contract You Consume (agree EXACT shapes with Backend Day 2)

```ts
export interface Suspect {
  mmsi: string; vesselName: string; rank: number;
  score: number;
  factors: { proximity: number; consistency: number; darkWindow: number; anomaly: number };
  evidence: { label: string; detail: string }[];
}
export interface Incident {
  id: string; name: string; observedAt: string;
  slickGeojson: object; originFrames: object[]; suspects: Suspect[];
}
```

Endpoints: `GET /api/zones` · `GET /api/incidents/:id` · `GET /api/suspects/:id` · proxy `/api/* → :8000` already configured in `vite.config.ts`.

**Mock-first strategy:** build every screen against `src/mocks/*.json` so frontend progress NEVER blocks on backend.

---

## 📅 Week-by-Week Plan

| Days | Task |
|---|---|
| 1–2 | Routes + Dashboard shell + Leaflet fix; mock JSON schema agreed |
| 3–5 | Incident map: slick layer + AIS polylines + layer toggles |
| 6–8 | Rewind slider + drift-frame animation + suspect markers pop-in |
| 9–10 | Dossier cards + factor bars + PDF export |
| 11–12 | Real API wiring behind feature flags (mock↔live switch), loading/error states |
| 13–14 | Polish, dark theme, responsive check, demo rehearsal ×10 |

## ⚠️ Pitfalls That Kill Teams

1. Leaflet marker-icon crash in Vite (fix above) — burns half a day if met cold.
2. Building against imagined API shapes — lock contract Day 2 in writing.
3. Re-rendering the whole map per animation frame — swap only layer data, memoize.
4. Demo laptop ≠ dev laptop — test fullscreen projector resolution early.
5. No offline fallback — keep a mock-data mode toggle for venue Wi-Fi failures.

## 🛡️ Judge Q&A (your domain)

- **Why not QGIS/GIS desktop?** Operators need zero-install, browser-based triage; we serve GeoJSON natively.
- **Is the animation real data or decoration?** Frames come directly from OpenDrift ensemble outputs.
- **What does an officer actually click first?** Zone → latest incident → watch rewind → open top dossier → export case file. Four clicks to conviction-grade evidence.
