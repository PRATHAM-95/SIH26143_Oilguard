# 🤖 Member 1 — AI/ML Engineer

> **PS:** SIH26143 — Satellite Oil-Spill Detection + AIS Vessel Attribution (NTRO, Space Tech, Software)
> **Your one-line job:** Train the AI that **sees oil slicks in satellite radar images**, and build the scoring brain that turns ship tracks into a **ranked suspect list**.

---

## 🎯 Your Mission in Plain Words

A satellite radar image comes in → your model paints the oily areas pixel-by-pixel (and refuses to get fooled by algae or calm wind that LOOK like oil). Separately, when physics tells you *where* the spill was born, your scoring model checks every ship that was nearby and outputs: **"Ship #3 is suspect #1, here's why."**

You own TWO models:

| Model | Input | Output | Feeds |
|---|---|---|---|
| **A. Slick Segmentation** | Sentinel-1 SAR tile (VV+VH) | Oil-slick polygon (GeoJSON) + confidence | Physics team seeds drift from your polygons |
| **B. Suspect Scoring** | Ship track features + origin heatmap | Score per ship (0–100) + factor breakdown | Backend ranks & serves to frontend |

---

## 📦 Datasets You Will Use (all free, verified)

| Dataset | What's inside | Size | Link |
|---|---|---|---|
| ⭐ Zenodo Part I | 1,200 spill images + pixel masks | 40.7 GB | [zenodo.org/records/8346860](https://zenodo.org/records/8346860) |
| Zenodo Part II | 685 look-alike / clean images + masks | ~20 GB | [zenodo.org/records/8253899](https://zenodo.org/records/8253899) |
| Zenodo Part III | Held-out test: 150 oil / 150 look-alike / 150 clean | 9.9 GB | [zenodo.org/records/13761290](https://zenodo.org/records/13761290) |
| Refined SOS | 6,455 train / 1,615 val labeled patches (newer, cleaner) | — | [zenodo.org/records/15298010](https://zenodo.org/records/15298010) |
| DARTIS negatives | 2,290 look-alike samples (low-wind "NW", natural slicks "NC") — your false-positive killer | small | [doi.pangaea.de/10.1594/PANGAEA.980773](https://doi.pangaea.de/10.1594/PANGAEA.980773) |
| CSIRO OSD | 5,630 oil/non-oil chips (extra diversity) | small | [data.csiro.au/collection/csiro:57430](https://data.csiro.au/collection/csiro:57430) |

> 💡 **Start trick:** download **Part III first** (smallest) so evaluation is wired before training data even arrives.

---

## 🧰 Your Toolkit (install these Day 1)

```bash
pip install torch torchvision segmentation-models-pytorch albumentations
pip install rasterio tifffile scikit-learn matplotlib pytorch-grad-cam
```

| Tool | What it does for you |
|---|---|
| `segmentation_models_pytorch` (smp) | U-Net / DeepLabV3+ with pretrained encoders in 3 lines |
| `albumentations` | Fast augmentation (flips/rotations ONLY — never color tricks on radar) |
| `rasterio` | Read 2048×2048 GeoTIFFs; geolocation so polygons map to Earth |
| `pytorch-grad-cam` | Explainability heatmap judges love |
| `scikit-learn` IsolationForest | Anomaly scoring for weird ship behavior |

Train on **Google Colab** (free T4 GPU is enough).

---

## 🪜 Model Ladder — Build Bottom-Up, Never Skip Rung 0

### Rung 0 — Baseline U-Net (working by Day 3)

```python
import torch
import segmentation_models_pytorch as smp

model = smp.Unet(
    encoder_name="resnet34",       # pretrained ImageNet encoder
    encoder_weights="imagenet",
    in_channels=2,                 # VV + VH polarizations = 2 channels
    classes=1,                     # binary: oil vs not-oil
)
loss = (smp.losses.DiceLoss(mode="binary")
        + smp.losses.SoftBCEWithLogitsLoss(pos_weight=torch.tensor([5.0])))
```

**Training recipe that works:**
- Tile each 2048×2048 image into **512×512 crops** (Colab can't eat full tiles)
- Augmentations: horizontal/vertical flip + 90° rotations ONLY
- AdamW, lr `1e-4`, cosine schedule, batch 16, AMP mixed precision
- Early-stop on validation IoU of the **OIL class** specifically
- Speckle noise: simple Lee filter OR rely on augmentation — don't over-engineer

### Rung 1 — Look-alike Killer: Two-Stage Hard-Negative Fine-Tuning ⭐ (your differentiator)

Mirrors the published DeepLabV3 method ([jinhonav/SAR_Oil_Spill_Segmentation_Deeplearning](https://github.com/jinhonav/SAR_Oil_Spill_Segmentation_Deeplearning) — MIT license, Colab notebooks included):

1. **Stage 1:** Train DeepLabV3-ResNet50 on Refined-SOS (6,455 imgs), ~10 epochs
2. **Stage 2:** Fine-tune ~5 epochs mixing hard negatives — DARTIS NW/NC + CSIRO no-oil — at ratio **5 : 1 : 1** (oil : negative : clean)

Their finding: baseline alone floods offshore regions with false positives; hard-negative tuning suppresses them while keeping the main slick intact. **This is exactly the failure mode judges will probe.**

Reference points from literature (cite in your report):
- Improved U-Net (FA-MobileUNet): mIoU > 80%, oil IoU **75.85%**, look-alike IoU 72.67% ([paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11207802))
- GSCAT-UNET (*Marine Pollution Bulletin*, Mar 2025): attention-gated U-Net, strong look-alike separation
- DS-UNet dual-stream (IEEE 2024): local+global feature fusion

### Rung 2 — Fallback insurance (do Day 1, costs nothing)

Pretrained model exists ready-made: [links-ads sar-oilspill-detection](https://huggingface.co/spaces/links-ads/sar-oilspill-detection) — U-Net with ConvNeXt backbone, weights downloadable, live demo online. Keep it wired as Plan-B inference so the demo NEVER dies if your training run misbehaves.

---

## 🎯 Target Metrics (write these on the wall)

| Metric | Target | Measured on |
|---|---|---|
| Oil-class IoU | **≥ 0.80** | Zenodo Part III |
| Look-alike false-positive rate | reported separately, aim < 15% after Stage-2 | Part III look-alike split |
| Dice | ≥ 0.85 | Part III |
| Confusion matrix | ALL classes shown, always | report PDF |

⚠️ **Never** report plain accuracy — 95% of pixels are water; accuracy lies.

## 🔥 Explainability (judges ask *"why trust it?"*)

```python
from pytorch_grad_cam import GradCAM
# target_layers = [model.encoder.blocks[-1]]
```
Overlay CAM on the SAR image in the dashboard — *"the model looked HERE because capillary waves are dampened"* wins instant credibility.

---

## 🚢 Model B — Suspect Scoring Engine (practical spec)

For every vessel track near the incident window compute 4 features (each 0–1):

| Factor | How to compute | Weight |
|---|---|---|
| 📍 Proximity | closest approach distance to origin-PDF high-probability zone | 0.40 |
| 🧭 Consistency | heading/speed match vs what backward-drift implies | 0.25 |
| 🌑 Dark window | AIS silent during emission window, weighted by distance-from-shore | 0.20 |
| ⚠️ Anomaly | IsolationForest score on [Δspeed, Δcourse, gap-length] | 0.15 |

```python
from sklearn.ensemble import IsolationForest

iso = IsolationForest(contamination=0.05, random_state=42)
iso.fit(df[["delta_speed", "delta_course", "gap_min"]])
df["anomaly"] = -iso.score_samples(df[["delta_speed", "delta_course", "gap_min"]])

suspect_score = 100 * (0.40*p + 0.25*c + 0.20*d + 0.15*a)
```
Weights live in a config file — Backend and Physics must tweak them WITHOUT touching your code.

---

## 📅 Week-by-Week Plan (deadline Sept 20, 2026)

| Days | Task |
|---|---|
| 1–2 | Download Part III + Refined-SOS subset; wire dataset/dataloader; run links-ads fallback end-to-end |
| 3–5 | Train Rung-0 U-Net → IoU ≥ 0.70; eval script + confusion matrix ready |
| 6–8 | Full-data training + Stage-2 hard-negative fine-tune → push IoU ≥ 0.80 |
| 9–10 | Polygonizer: mask → GeoJSON (`rasterio.features.shapes`) in real lat/lon; hand sample to Backend |
| 11–12 | Model B scorer + synthetic-AIS test scenarios with Data researcher |
| 13–14 | Grad-CAM overlays, metrics report, freeze weights, draft judge Q&A |

## 🤝 Handoffs

- **You give:** `model.pth` + `infer.py` (image path → GeoJSON polygons + confidence), scoring function, metrics report
- **You need:** tiled data pipeline (Data researcher), WGS84 lat/lon convention agreed with Physics, API shape agreed with Backend

## ⚠️ Pitfalls That Kill Teams

1. Training on look-alikes as positives → model "detects" algae. Use Part II properly.
2. Images are 2-channel (VV/VH) — silently feeding 3 channels breaks everything.
3. Validating only on training distribution — keep Part III untouched until final week.
4. OneDrive syncing gigabytes of tiles mid-training — keep `data/` OUTSIDE OneDrive folders.

## 🛡️ Judge Q&A (your domain)

- **Why U-Net, not transformers?** Limited labeled data (~7k images); CNN encoders transfer better at this scale; literature confirms U-Net family still SOTA here.
- **How do you avoid false accusations?** Look-alike rejection trained explicitly + honest FPR reporting + scores presented as evidence weights, never verdicts.
- **What if the model misses a slick?** Sentinel revisit cadence + human triage loop; recall numbers shown openly.
