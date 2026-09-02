# Scientific Feasibility Assessment

## What's Scientifically Valid
- **SAR oil spill detection:** Well-established, 40+ years of research, operational systems (EMSA CleanSeaNet)
- **Oil drift modelling:** Mature science, operational models (OpenDrift, PyGNOME, MEDSLIK-II)
- **Backtracking/source identification:** Validated in peer-reviewed literature (Breivik 2012, El Mohtar 2021)
- **AIS vessel correlation:** Proven method used by EMSA, NOAA, coast guards worldwide
- **Lagrangian particle tracking:** Foundational oceanography technique, mathematically rigorous

## What's Simplified
- **Oil weathering in reverse:** Cannot reverse evaporation/emulsification — backward models disable these
- **Chemical fingerprinting:** PS doesn't require it, but real investigations use it as primary method
- **Look-alike discrimination:** Biogenic slicks vs mineral oil is an open research problem
- **Subsurface oil:** Surface models don't capture deep plumes
- **Oil thickness estimation:** Very difficult from SAR alone

## What's Potentially Unrealistic
- **Real-time satellite processing:** Sentinel-1 revisit is 6-12 days, not continuous
- **Perfect source identification:** Uncertainty is inherent, especially >24h backtracking
- **Continuous AIS coverage:** Terrestrial AIS range ~50km; satellite AIS has gaps
- **Exact oil volume estimation:** SAR detects presence, not precise volume

## Hackathon-Achievable Approximations
| Real Capability | Hackathon Approximation |
|----------------|------------------------|
| Real SAR processing | Pre-trained model + synthetic SAR |
| Real ocean currents | ERA5/Copernicus data for demo region |
| Real AIS data | Simulated Indian Ocean AIS tracks |
| Full oil physics | Simplified advection + wind drift |
| Chemical analysis | Not included (PS doesn't require) |
| Real-time monitoring | Offline batch processing |

## What NOT to Claim
- "Real-time satellite monitoring" (say "satellite-based detection capability")
- "Perfect accuracy" (say "with quantified uncertainty")
- "Continuous ocean monitoring" (say "snapshot analysis")
- "Production-ready system" (say "proof-of-concept / prototype")
- "Novel approach" (say "integrated pipeline combining established methods")

## Expert Challenge Responses
| Expert Type | Challenge | Our Response |
|-------------|-----------|-------------|
| Oceanographer | "Backtracking accuracy degrades with time" | Present uncertainty, use ensemble methods |
| Remote Sensing | "Look-alikes cause false positives" | Use multi-feature classification, wind data filtering |
| AIS Expert | "AIS gaps and spoofing exist" | Acknowledge, show confidence scores |
| Software Judge | "How is this different from existing tools?" | Integrated pipeline + visual investigation + attribution |
| Environmental | "Oil volume estimation is unreliable from SAR" | Present ranges, not point estimates |
