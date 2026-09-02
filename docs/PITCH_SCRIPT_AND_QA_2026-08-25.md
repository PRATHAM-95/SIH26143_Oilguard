# 🎤 SIH26143 — Pitch Script + Judge Q&A Battle Pack

> **For:** Presentation day — Tuesday, 25 August 2026 *(prepared Monday, 24 August 2026)*
> **PS:** Satellite Oil-Spill Detection + AIS Vessel Attribution
> **Contents:** §1 Two-speaker 3-minute script · §2 EASY tier · §3 MEDIUM tier · §4 Non-technical bank · §5 Cheat sheet · Appendix: advanced armor
> **Fact rule:** every number below is either verified live (see `VERIFICATION_REPORT_2026-08-24.md`) or taken directly from your approved deck. Nothing invented.
> **How to use:** memorize §2 cold (any judge can ask these). Skim §3 twice. Appendix = only if a domain expert presses deep.

---

# §1 — THE 3-MINUTE SCRIPT (Two speakers, word-for-word)

**Legend:** `[→B]` hand-off cue · `…` short pause (1 s) · **bold** = punch the word · `(gesture)` = optional body cue
**Pace:** ~145 words/min. Do NOT rush. Rehearse with a stopwatch ×10.

---

### BEAT 1 — COLD OPEN · 0:00 – 0:30 · **Speaker A**

> On the 25th of May, 2025, at 7:50 in the morning, a container ship called **MSC Elsa-3** sank off the Kochi coast, spilling fuel oil into the Arabian Sea. Within days, oil and containers were washing up on Kerala's beaches…
>
> Now imagine that oil didn't come from a wreck. Imagine a tanker **flushing its tanks at night**, quietly, and sailing away. Hundreds of ships pass through those waters. **Which one was it?**
>
> The sea knows. Today… **nobody asks it.**

*(pause 2 s — let the silence land)*

### BEAT 2 — PROBLEM · 0:30 – 0:55 · **Speaker A**

> India has **7,500 kilometres** of coastline, and about **three-quarters** of our oil arrives by sea. But when there's a spill, finding the source is still **manual detective work**. Remember **Ennore, 2017**: two ships, **251 tonnes** of oil — and **years** of litigation, because nobody could *prove* who was responsible. `[→B]`
>
> **That** is the gap we close.

### BEAT 3 — SOLUTION PIPELINE · 0:55 – 1:50 · **Speaker B**

> We turn satellite radar into courtroom evidence — in **four steps**.
>
> Step one — **DETECT**. Our AI reads Sentinel-1 **radar** images — radar sees at night, through clouds — and paints the oil slick pixel by pixel. It's trained on thousands of expert-labelled scenes, and it refuses to be fooled by **look-alikes** — algae blooms, calm wind — that fool other systems.
>
> Step two — **REWIND** …this is our heart. Oil drifts with currents and wind, and that physics runs **backwards just as well as forwards**. So we take the slick and simulate the ocean **in reverse** — two to twelve hours back. The output is not one guess. It's a **probability map** of everywhere that oil could have been born.
>
> Step three — **ATTRIBUTE**. Every nearby ship broadcasting AIS gets cross-scored against that map: Did you pass close? Does your course match the drift? And the killer question — did your signal go **dark** during the spill window?
>
> Step four — **PROVE**. Out comes a ranked suspect list, factor by factor, exportable as a case file.

### BEAT 4 — WHY NOBODY ELSE HAS THIS · 1:50 – 2:20 · **Speaker B, tag by A**

> **[B]** Europe's CleanSeaNet? Analysts review images **by hand**, and it serves only member states. India's own INCOIS does excellent **forward** forecasting — *where will the oil go* — but it's triggered manually, case by case.
>
> **[A]** We automate the question nobody answers automatically: **where did it come FROM.** End-to-end. Open-source. **India-first.**

### BEAT 5 — FEASIBILITY · 2:20 – 2:50 · **Speaker A**

> And feasibility is our strongest card. **Every single input is free**, and named in the problem statement itself — labelled radar scenes from Zenodo, ocean currents from Copernicus Marine, winds from ERA5. **Zero data risk.** It trains on a free Colab GPU, inference takes under five minutes a scene, and we are walking in with a **working prototype** today.

### BEAT 6 — CLOSE · 2:50 – 3:00 · **Speaker B**

> The next time the sea is wounded, our responders won't be asking *"who did this?"* into the dark…
>
> **We'll have a name ready.** Thank you.

---

### ⚡ EMERGENCY 60-SECOND CUT (if the jury cuts your time)

> **[A]** Ships illegally flush oil at night; India has no automated way to name them — Ennore 2017 meant years of litigation.
> **[B]** Ours: AI detects the slick in radar → ocean physics runs **backwards** to a probability map of the origin → AIS tracks are scored against it — proximity, course, and **dark windows** — → a ranked, evidence-backed suspect list.
> **[A]** Every input is free and problem-statement-sanctioned. Prototype working today.
> **[B]** CleanSeaNet uses analysts; INCOIS forecasts forward. We answer **backwards, automatically** — India-first. We'll have a name ready.

---

# §2 — EASY TIER 🟢 (ANY judge can ask these — memorize cold)

One-to-two-sentence answers. Deliver them slowly and confidently.

**E1. What is SAR?**
A radar camera on a satellite. It sends microwave pulses and listens for the echo — so it works at night and straight through clouds, unlike normal cameras.

**E2. Why does oil look dark in your images?**
Radar echoes bounce off tiny wind ripples on the sea surface. Oil smooths those ripples away, so the slick reflects almost nothing back — it appears as a calm dark patch.

**E3. What is AIS?**
A mandatory transponder every large ship broadcasts — its ID, position, speed and course, every few seconds. It exists for collision avoidance; for us it's also an evidence trail.

**E4. What is a "dark vessel"?**
A ship that switched its AIS off. Silence mid-sea during exactly the spill window is suspicious — that's precisely what we flag.

**E5. What is U-Net in one line?**
A standard deep-learning model that paints every pixel of an image — here: "oil" or "not oil" — instead of labelling the whole picture at once.

**E6. Where do satellite images come from? What do they cost?**
European Sentinel-1 radar via Copernicus — free and open, and named in the problem statement itself. Training datasets are free on Zenodo too.

**E7. Is your software paid? Any licenses to buy?**
Nothing paid. Fully open-source stack — PyTorch, OpenDrift, FastAPI, React. A student can reproduce the whole thing at zero rupees.

**E8. Did you build anything, or is this just an idea?**
A working prototype: dashboard with slick polygons and ranked suspects, detection training running on a free Colab GPU, and real drift hindcasts running with OpenDrift.

**E9. What if it's cloudy or raining when the spill happens?**
No problem — that's exactly why we chose radar: it sees through clouds, day or night.

**E10. You claim "under 30 minutes" — break that down.**
Detection under five minutes per image; the backward drift runs in the background for a few minutes; scoring against ship tracks is instant once data loads. Total comfortably under 30.

**E11. Who does what in your team?**
Five roles: AI/ML (detection + scoring), Data engineering (satellite/currents/wind/AIS pipelines), Physics (drift modelling), Frontend (dashboard), Backend (API and job handling).

**E12. Explain "backward simulation" like I've never heard of it.**
Currents and winds are recorded history, like weather archives. We start from today's slick location and run the physics movie backwards to see where the patches could have started.

**E13. Why show an area instead of one exact point?**
Because wind and waves make many drift paths possible. One point would be a guess; the honest answer is a zone with confidence levels — like a weather forecast.

**E14. Is there any real incident you test against?**
Yes — MSC ELSA-III, which sank off Kochi in May 2025. A peer-reviewed trajectory study exists for it, and we reproduce that scenario with our own tools.

**E15. Where do the Ennore 2017 numbers come from?**
Public reporting of the two-ship collision: 251 tonnes spilled, litigation ran for years because the culprit question stayed unresolved — the manual-guesswork cost we highlight.

**E16. What's new compared to just… looking at a satellite image?**
Seeing a slick tells you *that* there's oil — not *who*. We add the physics rewind and the ship-track evidence chain, fully automatic, no analyst needed.

---

# §3 — MEDIUM TIER 🟡 (semi-technical judges — understand, don't memorize)

**M1. Walk me through the pipeline end-to-end.**
Sentinel-1 radar image → clean it (calibration, speckle filter, land mask) → U-Net paints the slick → polygon with confidence score → seed ~100 virtual particles into OpenDrift with recorded currents (Copernicus Marine) and winds (ERA5), running backwards 2–12 hours → origin probability map → score every nearby ship track: proximity .40, course-match .25, dark-window .20, anomaly .15 → ranked suspect dossier, exportable as PDF/GeoJSON.

**M2. Look-alike slicks fool most systems. Your defence?**
Three layers: dual-polarization radar input (oil and look-alikes damp ripples differently); dedicated training classes for biogenic films, rain cells and low-wind zones; plus fine-tuning with thousands of known *negative* examples (DARTIS 2,290 no-oil patches + CSIRO 5,630 chips) so the model learns what "not-oil" really looks like.

**M3. How do you measure accuracy? Why not plain accuracy?**
SAR scenes are ~95% water — a model saying "no oil anywhere" scores 95% accuracy while detecting nothing. So we report overlap-based metrics: oil-class IoU target ≥ 0.80, Dice ≥ 0.85, false-positive rate shown separately, full confusion matrix always.

**M4. How does going backwards in time actually work?**
The movement equations are time-reversible: give OpenDrift a negative time-step and advection reverses direction (weathering processes correctly switch off for backward runs — it's handled in the framework). The ensemble of particles spreading apart *is* our uncertainty estimate.

**M5. What physically moves the oil?**
Ocean current first (the dominant carrier), then wind drift — only 1–6% of wind speed but deflected rightward in our hemisphere — plus wave-induced drift and turbulent spread. We run several parameter combinations rather than trusting one value.

**M6. Why limit rewinding to 2–12 hours?**
After half a day the oil itself changes (evaporation, emulsification) and forcing errors pile up. Beyond that window results stop being honest — so we bound it openly instead of showing off.

**M7. Justify the scoring weights .40/.25/.20/.15.**
Proximity dominates because the probability map comes from physics. Course-consistency checks plausibility; darkness mid-sea mid-spill is strong-but-not-conclusive; the last 15% is an anomaly detector over speed/course jumps. They live in a config file so domain experts can tune them without code — and output is always "ranked evidence", never a verdict.

**M8. Two ships pass inside your probability zone — who's guilty?**
The ranking still separates them: distance to the highest-probability core, how well each course matches the implied drift, dark-window presence, behaviour anomalies. If they're genuinely indistinguishable, we report both scores honestly and investigators decide. Honest ambiguity beats fake certainty.

**M9. How will you prove your drift physics is trustworthy?**
We reproduce the published MSC ELSA-III Kochi trajectory study (Regional Studies in Marine Science, DOI 10.1016/j.rsma.2026.104844) using our own open tools, plus a sensitivity grid — wind-drift factor × deflection angle × rewind length — reporting how many km the origin cloud shifts per hour rewound.

**M10. Your free AIS data covers US waters only. Indian demo?**
The problem statement explicitly permits synthetic AIS for evaluation. We generate realistic traffic with one vessel given a deliberate dark window near the true origin — giving us ground truth to catch, with generator parameters documented. Real Indian feeds are a provisioning step later; formats are identical worldwide.

**M11. Sentinel revisits every 6–12 days. Isn't that too slow?**
Detection cadence is set by the satellite, not us — attribution begins the moment a scene shows a slick, and our 2–12-hour rewind window is designed to still be valid then. INCOIS forward advisories cover immediate response meanwhile; future satellite tasking shrinks the gap.

**M12. Describe your software architecture in one breath.**
React + Leaflet dashboard → FastAPI backend → MongoDB storage; heavy work (AI inference, drift simulation) runs in separate processes with progress polling so the UI never freezes; exports GeoJSON and a court-ready PDF case file.

---

# §4 — NON-TECHNICAL BANK 🔵 (impact · legal · adoption · simple explanations)

## Impact & Cost

**N1. What does this cost to run?**
For the prototype: effectively zero — free satellite data, free weather/ocean archives, free GPUs, open-source software. Production adds only ordinary server hosting.

**N2. Who benefits, and how?**
Coast Guard reaches the right vessel/port in hours instead of days; courts get verifiable evidence; fishing and tourism economies get protection; polluter-pays becomes enforceable.

**N3. Is this really a frequent problem?**
About 75% of India's oil travels by sea along 7,500 km of coast. Even one Ennore-scale event means crores in damage and years of unresolved blame — and deterrence applies to every voyage before any spill happens.

**N4. Does this replace Coast Guard expertise?**
No — it aims their expertise faster. We produce leads and evidence; trained officers act on them.

## Legal & Accountability

**N5. Would your report survive in court?**
Every layer is independently checkable — the radar image, the physics run with published parameters, the AIS records. We align the case-file format with MARPOL/Merchant-Shipping-Act expectations, and authorized officers always make the final call.

**N6. If it points at the wrong ship, who's responsible?**
The system assigns no blame — it ranks evidence with visible confidence. Accountability stays with human investigators, exactly today; what changes is their guess becomes a transparent, reproducible trail.

**N7. Privacy concerns?**
Minimal: AIS is a public safety broadcast required by law, analyzed only within specific incident windows. No personal tracking involved.

## Adoption & Roadmap

**N8. Will authorities actually use it?**
It complements existing systems: INCOIS already issues forward-trajectory advisories; we add the missing backward-attribution layer behind a browser dashboard with PDF export — fitting current workflows, not replacing them.

**N9. How does deterrence work?**
Polluters rely on anonymity, especially night dumps with AIS off. Cheap automatic attribution removes that cover — the risk calculus shifts before any spill occurs.

**N10. Post-hackathon roadmap?**
Pilot on historical Indian incidents (ELSA-III first) with Coast Guard feedback → integrate official AIS feeds and Indian forcing models → operational dashboards per coastal zone, pipeline published open-source for academia and startups.

## Reference-Slide Traps (from Backup deck Slide 6)

**N11. You listed Google Earth Engine / AISHub / MarineTraffic — explain those choices.**
Early exploration options: GEE for fast prototyping access to imagery; AISHub and MarineTraffic are commercial AIS aggregators we evaluated. Our final build stays 100% free — direct Copernicus access plus MarineCadastre/synthetic AIS — honouring our zero-cost promise.

**N12. Summarize one paper from your references.**
Safe template for ANY paper they pick — Purpose: what problem it solves · Method: the technique in one sentence · Link: "it supports our choice of X". Example — the 2022 deep-learning SAR paper: CNNs outperform hand-crafted features for slick detection, which anchors our U-Net decision; the 2018 IEEE AIS survey defines the track-cleaning thresholds we apply.

**N13. Sentinel-1 vs Sentinel-2 — why radar over optical?**
Optical needs daylight and clear skies; spills often happen at night or in monsoon cloud. Radar sees through both — Sentinel-2 optical is only an occasional confirmation backup.

## Simple Explanations

**N14. Explain the whole system like I'm twelve.**
It's CCTV replay for the ocean. The satellite camera spots spilled oil. We replay the recording — currents and winds — backwards until we reach when the spill started. Then we check whose ship ID badges were near that place at that time — and whose badge went missing. Top score = prime suspect.

**N15. How long from spotting oil to naming a suspect?**
Minutes. Detection under five per image, rewind a few minutes in the background, ranking instant once tracks load. An officer watches the ocean rewind and gets a ranked list before their coffee cools.

**N16. Is AI replacing officers?**
The opposite — it hands them evidence faster. The officer still decides; we just make sure they decide with a map, a timeline and names, not a hunch.

---

# §5 — CHEAT SHEET

## 🔢 Numbers to Memorize (only these 12)

| # | Fact |
|---|---|
| 1 | 7,500 km coastline · ~75% of oil arrives by sea |
| 2 | Ennore 2017 — 2 ships · 251 tonnes · years of litigation |
| 3 | ELSA-III sank **25 May 2025, 07:50 IST**, off Kochi |
| 4 | Hindcast window: **2–12 hours** (never beyond) |
| 5 | Wind-drift factor: **1–6%** of wind speed, rightward deflection |
| 6 | Scoring weights: **.40 / .25 / .20 / .15** |
| 7 | Targets: oil-class **IoU ≥ 0.80**, Dice ≥ 0.85 |
| 8 | Zenodo: 1,200 + 685 + 685 train imgs + 450 test ≈ 3,000 annotated scenes |
| 9 | Negatives: DARTIS **2,290** no-oil patches · CSIRO **5,630** chips |
| 10 | Sentinel-1 revisit: **6–12 days** · GRD 10 m · VV+VH |
| 11 | Inference < 5 min/scene on free Colab T4 · end-to-end < 30 min |
| 12 | Validation: ELSA-III paper DOI 10.1016/j.rsma.2026.104844 |

## 🗣️ Ten Delivery Rules

1. Rehearse with stopwatch **×10 minimum**; assign one teammate as silent timekeeper (signal at 2:00).
2. First line lands on silence — don't start while judges are shuffling papers.
3. Slow down 20% on every **number**; numbers are credibility.
4. Eye contact: split the panel into left/center/right; one sentence each.
5. Never read slides; slides are backdrop, script is yours.
6. Handoffs `[→B]` must be seamless — B looks up at A's second-to-last word, not last.
7. Bridge phrases for tough questions: *"Great question — short answer is X, and here's why…"*
8. Unknown fact? Say: *"I don't want to quote a figure I can't verify — but here's how we'd measure it."* Never bluff.
9. Never badmouth competitors — CleanSeaNet/INCOIS are "**complements we extend**", always.
10. Close on the money line from memory, eyes up: *"We'll have a name ready."*

## 🚫 Red-Team List — NEVER Say

- ~~"Obviously…"~~ / ~~"As everyone knows…"~~ (judges test arrogance)
- ~~"Our AI will identify the culprit."~~ → say "**ranked suspects / evidence weights**"
- ~~"Accuracy is high because the dataset is large."~~ (accuracy lies on imbalanced SAR — invite the kill)
- ~~"It works for all of India tomorrow."~~ → say "**pilot-ready architecture; feeds are a provisioning step**"
- ~~Anything negative about INCOIS/NTRO/Coast Guard~~ (they may be in the room)

---

# APPENDIX A — ADVANCED ARMOR 🟥 (only if a domain expert presses deep)

Condensed from the verified technical bank — deploy only when the question is genuinely expert-level.

## Machine Learning

- **Why U-Net over transformers?** ~3,000 labelled scenes favor ImageNet-pretrained CNN encoders; ViTs need more data. U-Net family remains literature SOTA for SAR slick segmentation.
- **Hard-negative recipe:** Stage-1 train on positives (~10 epochs), Stage-2 fine-tune with oil:negative:clean ≈ 5:1:1 (DARTIS NW/NC + CSIRO no-oil), mirroring the published DeepLabV3 method (jinhonav repo, MIT).
- **2-channel handling:** `in_channels=2` (VV+VH); smp adapts first conv weights; never fabricate a third channel.
- **Explainability:** Grad-CAM overlays on encoder's last block — show dampened-capillary-wave regions driving detection.
- **Test hygiene:** Zenodo Part III locked until final week; report FPR on its look-alike split separately.

## Physics & Drift

- **Backward mechanics:** negative `time_step` flips advection; `time_step.days < 0` branches skip weathering/budgets in OpenDrift source; Leeway-backtracking example uses `time_step=-900`.
- **Force budget:** current (100%) + wind drift 1–6% @ 10 m deflected 0–45° right (Ekman, NH) + Stokes drift + diffusion; ensemble over WDF {2,3,6%} × angle {0,20,40°} × duration {-2,-6,-12h} = 27-run grid; report origin-centroid wander per hour.
- **Validation targets:** match ELSA-III GNOME study trajectory; cite MEDSLIK-II tuned-error ~21–23 km over long drifts as context for short-window tightness.

## Data & AIS

- **Cleaning order:** dedup → SOG sanity (0–30 kn) → jump/land-crossing removal → acceleration check → split tracks at >10 min gaps → drop <1 kn stationary → resample 1-min (MovingPandas `TrajectoryStopDetector` for stops).
- **Anomaly engine:** IsolationForest on [Δspeed, Δcourse, gap-length], contamination 0.05; score = −`score_samples`.
- **Dark-window factor:** silence weighted by distance-from-shore within emission window (weight .20).

## Systems

- **Latency budget:** detect s–min/scene (T4-class, AMP tiles 512²); drift minutes async via BackgroundTasks + job registry polling `/api/jobs/{id}`; subprocess isolation (crash-proof API).
- **Windows reality:** OpenDrift isolated in own venv/conda/WSL, invoked by explicit python path.
- **Licensing:** datasets CC-BY(-SA); code MIT/BSD; OpenDrift GPL-2.0 compliant (open project, separate process); react-leaflet Hippocratic-2.1 OK for public-interest use.

## Expert Traps

- **"Wrong accusation?"** → ranked evidence, quantified uncertainty, human decides — strengthens due process vs today's undocumented guesswork.
- **"Foreign data for Indian waters?"** → PS names these sources; physics is location-agnostic; sovereignty = owning the analysis layer; Indian feeds drop-in post-hackathon.

---
*Prepared 2026-08-24 · All external claims verified live on 2026-08-24 — see `docs/VERIFICATION_REPORT_2026-08-24.md`.*
