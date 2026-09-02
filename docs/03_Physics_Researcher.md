# 🌊 Member 3 — Physics Researcher

> **PS:** SIH26143 — Satellite Oil-Spill Detection + AIS Vessel Attribution (NTRO, Space Tech, Software)
> **Your one-line job:** Own the question *"WHERE did this oil come from?"* — master the physics of how oil moves on the sea, run the backward-in-time simulations, and hand the team an **origin probability map** plus the defensible numbers behind it.

---

## 🎯 Your Mission in Plain Words

The satellite shows a slick NOW. Ships have moved on. You rewind: given today's currents + winds + waves, where was that oil 2–12 hours ago? The answer is never a point — it's a **probability cloud**. Ships inside that cloud (at that time) become suspects. Your output is the evidence backbone of the whole project.

---

## 🧪 Part 1 — The Physics You Must Be Able to Explain on a Whiteboard

### 1.1 What pushes an oil particle? Four forces

**Total drift = ocean current + wind drift + wave (Stokes) drift**, then the slick also *spreads* and *weathers*.

| Force | Size | Rule of thumb |
|---|---|---|
| 🌊 Ocean current | ~100% of current speed | The dominant transporter |
| 💨 Wind drift | **1–6% of wind speed at 10 m**, deflected 0–45° to the right (Northern Hemisphere) | Classic range from Fay 1971 / Elliott 1986 / Spaulding 1988; a 2025 Brazilian MEDSLIK-II validation found best fit at **6% factor + 35–45° angle** |
| 〰️ Stokes drift (waves pumping water forward) | grows with wind; significant when wind > 4–5 m/s, can add over half the wind-drift contribution | Lags wind changes by ~2 h |
| 🎲 Turbulent diffusion | random walk spread | Handled by model's diffusion settings |

> 🇮🇳 Northern-Hemisphere detail judges love: wind-pushed surface layers deflect **rightward** (Ekman spiral). Oil doesn't drift straight downwind.

### 1.2 "How far does oil spread in one hour?" (worked example — memorize the method)

Transport displacement ≈ (current × 1.0 + wind × WDF) × time:

```
current = 0.40 m/s
wind    = 8.00 m/s × 3% (WDF)      → 0.24 m/s
total   ≈ 0.64 m/s                 → 0.64 × 3600 s ≈ 2.3 km in ONE HOUR
```
Plus spreading: the slick itself widens (Fay stages below), and diffusion smears particles. So after 6 h expect **10–15 km displacement + a slick several km wide** — which is exactly why the suspect zone is a probability cloud, not a pin.

### 1.3 Fay spreading stages (why slick shape changes)

| Stage | Driver | Timescale | Radius growth |
|---|---|---|---|
| Gravity–inertia | initial dump momentum | minutes | r ∝ t^(2/3) |
| Gravity–viscous | gravity vs water viscosity | first hours | r ∝ t^(3/4) |
| Surface-tension–viscous | interfacial tension | later | r ∝ t^(1/8), then stops |

Termination: evaporation + dissolution raise interfacial tension until spreading ceases (film ~µm thick).

### 1.4 Weathering timeline (temperature matters! — your teammate's intuition, validated)

| Hours after spill | What happens | Why we care |
|---|---|---|
| 0–6 h | Evaporation of light fractions (faster when warmer); viscosity starts rising | Slick still fresh — SAR dark signature strongest |
| 6–24 h | Emulsification ("mousse"), viscosity climbs sharply | Detection & drift behavior change |
| 12+ h | Dispersion into water column, breakup | Hindcast reliability decays |

**This bounds our hindcast window: slicks persist usefully ~2–12 h.** Backtracking beyond that = honesty problem, not just accuracy problem.

---

## ⏪ Part 2 — Backward Hindcast: The Heart of the Project

OpenDrift/OpenOil simulates Lagrangian particles (virtual oil blobs). Key magic: **negative time step = simulate backwards in time.**

Workflow:
1. Seed N=500–2000 particles across the detected slick polygon (ML guy gives polygon via `seed_from_gml` or GeoJSON)
2. Run with `time_step = -300` (5-min steps backwards) for 2–12 h
3. Collect where particles ended up at t_origin → density map = **origin PDF**
4. Ensemble spread (particles scattering apart) IS your uncertainty — show it honestly

```python
from opendrift.models.openoil import OpenOil
o = OpenOil(loglevel=20)
o.add_readers_from_list([currents_nc, winds_nc])
o.seed_elements(lon=[...], lat=[...], number=1000, radius=2000,
                time=slick_observation_time)
o.set_config("seed:wind_drift_factor", 0.03)   # ← YOUR knob (2–6%)
o.set_config("drift:advection_scheme", "runge-kutta")
o.run(time_step=-300, duration=timedelta(hours=6),
      outfile="hindcast_6h.nc")                # negative step = rewind
```

## 🔧 Your OpenDrift Knobs (own these)

| Config key | Meaning | Your call |
|---|---|---|
| `seed:wind_drift_factor` | % of wind added to motion | test {0.02, 0.03, 0.06} |
| `drift:advection_scheme` | Euler vs runge-kutta | RK for accuracy |
| `time_step` (+/-) | sign = direction of time | −300 s for hindcast |
| `drift:horizontal_diffusion` | random-walk spread | enable; report effect |
| readers (currents/winds NetCDF) | forcing data | Data researcher supplies |
| `o.animation()` / `plot()` | MP4 + figures for demo | yes, please |

Docs: [opendrift.github.io](https://opendrift.github.io/) · tutorial + example gallery live in the repo ([tutorial.rst](https://github.com/OpenDrift/opendrift/blob/master/docs/source/tutorial.rst)). `pip install opendrift` (Python ≥3.9; if native Windows install fights you, Backend helps isolate it in its own venv/WSL — don't burn days).

---

## 🔬 Part 3 — Sensitivity Experiments (this is what makes judges nod)

Run the SAME incident through a parameter grid:

```
WDF        : {2%, 3%, 6%}
Drift angle: {0°, 20°, 40°}     (set per literature; OpenDrift default scheme handles rotation)
Hindcast   : {-2h, -6h, -12h}
→ 27 runs; measure how far origin-cloud centroids wander
```

Deliverables:
- 📈 Spread plots: origin-PDF overlap across parameter sets
- ✅ Recommended defaults for demo (literature suggests start: **WDF 3%, angle 20°, hindcast ≤ 6 h**)
- 📄 One-page honest statement: *"origin uncertainty radius grows roughly X km per hour of hindcast"*

## ✅ Part 4 — Validation With a Real Answer Key

**MSC ELSA III**: capsized 38 nm off Kochi, **May 25 2025**, oil spilled in SE Arabian Sea; NOAA GNOME trajectory study published Mar 2026 ([S235248552600099X](https://www.sciencedirect.com/science/article/pii/S235248552600099X)).
→ Reproduce their trajectory with OpenDrift using Data-researcher's ERA5/current files for those dates. If your forward run matches a published study, judges see validated physics, not vibes. Also cite INCOIS's operational trajectory bulletins as India-side precedent.

---

## 📅 Week-by-Week Plan

| Days | Task |
|---|---|
| 1–2 | Install OpenDrift; run tutorial example with bundled NorKyst data end-to-end |
| 3–4 | Swap in real current/wind files from Data researcher; forward-run ELSA III scenario |
| 5–7 | Backward runs on synthetic slicks; build origin-PDF export (NetCDF + GeoJSON heatmap) |
| 8–10 | Full 27-run sensitivity grid; write findings + recommended params (`params.json`) |
| 11–12 | Wire outputs to Backend contract; polish animation MP4 for demo |
| 13–14 | Physics cheat-sheet for all teammates + judge Q&A answers |

## 🤝 Handoffs

- **You give:** `params.json` (recommended WDF/angle/duration), `hindcast_*.nc` + origin-PDF GeoJSON per incident, validation-vs-GNOME comparison figure, demo animation MP4
- **You need:** slick polygons in lat/lon (ML guy), current/wind NetCDFs covering incident window ±12 h (Data guy), agreed output schema with Backend

## ⚠️ Pitfalls That Kill Teams

1. Running backward without realizing missing reader variables get silent fallback values (e.g., Stokes=0) — check `o.list_configspec()` + run logs.
2. Presenting ONE arrow instead of a cloud — reviewers destroy single-trajectory claims.
3. Hindcasting 48 h because it looks impressive — beyond ~12 h the physics honesty collapses.
4. Forgetting land: particles can beach; note OpenDrift's stranding handling in your assumptions slide.
5. Mixing up u/v sign conventions between datasets (eastward/northward positive) — sanity-plot arrows once.

## 🛡️ Judge Q&A (your domain)

- **Why probability, not certainty?** Chaotic turbulent flow + parameter uncertainty; ensemble forecasting standard (same reason weather forecasts are probabilistic).
- **How accurate is backward tracking?** Validated parameter ranges (MEDSLIK-II Brazil case: errors ~21–23 km over long drift with tuned parameters); our windows are shorter (2–12 h) so tighter.
- **Why not just INCOIS bulletins?** They do FORWARD response support, manually triggered; we automate BACKWARD attribution — complementary, not competing.
