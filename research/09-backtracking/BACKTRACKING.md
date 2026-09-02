# Backtracking / Reverse Modelling Strategy

## Terminology (CORRECT Scientific Terms)
| Term | When to Use |
|------|-------------|
| **Backtracking** | Most common, scientifically accepted |
| **Backward-in-time tracking** | Formal term (Batchelder 2006) |
| **Hindcasting** | Running model from known end state |
| **Inverse modelling** | Broader statistical framework |
| **Source estimation** | Specific application of backtracking |

**Do NOT say:** "reverse physics", "reverse simulation", "time reversal"

## Method: OpenDrift Backward Mode (VERIFIED)

From Dagestad et al. (2018, Geoscientific Model Development):
> "All instances of OpenDrift can be run in reverse by reversing the sign of the advective increment. Diffusive properties are kept in the forward sense."

```python
# Forward: positive timestep
o.run(duration=timedelta(hours=6), time_step=900)  # 15-min steps

# Backward: negative timestep
o_back = OpenOil()
o_back.add_reader([current_reader, wind_reader])
o_back.seed_elements(lon=slick_lon, lat=slick_lat, number=500,
                     time=slick_obs_time)
o_back.run(duration=timedelta(hours=6), time_step=-900)  # BACKWARD
```

## Why Backtracking Works for Demo
1. **Short periods (<6h):** Very accurate, well-validated
2. **Environmental data available:** ERA5/Copernicus provide historical currents/winds
3. **Uncertainty quantifiable:** Run ensemble with perturbed parameters
4. **Scientifically defensible:** Published in GMD, used operationally by MET Norway

## Methods Comparison
| Method | How It Works | Pros | Cons |
|--------|-------------|------|------|
| **Naive backward** (OpenDrift) | Reverse sign of displacement | Simple, fast | Cannot handle nonlinear processes |
| **BAKTRAK** (Breivik 2012) | Iterative forward breeding | Uses unaltered forward model | Computationally expensive |
| **Bayesian MCMC** (El Mohtar 2021) | Forward model in MCMC sampling | Estimates source + time + uncertainty | Complex implementation |
| **Ensemble backtracking** | Multiple flow field realizations | Probabilistic, robust | Requires multiple model runs |

## Uncertainty Representation
```
Predicted origin: 10.42N, 72.31E
Estimated uncertainty: +/-3.4 km
Estimated spill time: 14:37 +/- 22 min
Confidence: 87%
```

### How to Produce These Values
1. Run ensemble of 50-100 particles with perturbed:
   - Wind drift factor (2.5-4.5%)
   - Diffusion coefficient (50-200 m2/s)
   - Current field uncertainty (+/-10%)
2. Calculate spatial spread of converged particles
3. Report mean +/- standard deviation
4. Confidence = fraction of particles converging within X km

## Key Limitations
1. **Time irreversibility:** Oil weathering (evaporation, emulsification) cannot be reversed
2. **Flow divergence:** In strongly convergent/divergent flows, backward trajectories diverge
3. **Predictability horizon:** 1-2.5 days for typical ocean conditions
4. **Wind field accuracy:** Backtracking requires accurate historical wind fields
5. **Oil type uncertainty:** Without knowing oil type, predictions are less reliable

## Scientific Validation
- Breivik et al. (2012): BAKTRAK validated for North Sea
- El Mohtar et al. (2021): Bayesian MCMC for source estimation
- MEDSLIK-II validation: 1-2.5 day predictability
- OpenDrift validation: 50+ peer-reviewed papers

## Key Papers
1. Batchelder (2006) — "FITT/BITT Modeling" — JTECH
2. Breivik et al. (2012) — "BAKTRAK" — Ocean Dynamics
3. El Mohtar et al. (2021) — "Bayesian source identification" — MPB
4. Ciappa & Costabile (2014) — "Reverse trajectory risk" 
5. Li et al. (2024) — "Deep learning wind correction" — Frontiers
6. Chen et al. (2025) — "Review of Backtracking Methods"
