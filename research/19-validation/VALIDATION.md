# Validation & Ground Truth Strategy

## 10 Ground-Truth Validation Scenarios

### Scenario 1: Arabian Sea Tanker (Easy)
- **Location:** 10.5°N, 72.5°E
- **Vessel:** VLCC tanker, 25 knots
- **Wind:** 5 m/s, NW
- **Ocean current:** 0.3 knots, NE
- **Oil type:** Medium crude
- **Difficulty:** Easy — clear vessel, short backtrack
- **Expected error:** <3 km position, <20 min time

### Scenario 2: Bay of Bengal Cargo (Medium)
- **Location:** 14.0°N, 85.0°E
- **Vessel:** Container ship, 18 knots
- **Wind:** 8 m/s, SW
- **Ocean current:** 0.5 knots, E
- **Oil type:** Heavy fuel oil
- **Difficulty:** Medium — complex currents
- **Expected error:** <5 km, <30 min

### Scenario 3: Malacca Strait (Hard)
- **Location:** 3.0°N, 100.5°E
- **Vessel:** Bulk carrier, 12 knots
- **Wind:** 3 m/s, variable
- **Ocean current:** 0.8 knots, variable
- **Oil type:** Light crude
- **Difficulty:** Hard — high traffic, variable currents
- **Expected error:** <8 km, <45 min

### Scenario 4: Lakshadweep (Accidental)
- **Location:** 10.5°N, 72.0°E
- **Vessel:** Fishing trawler, 8 knots
- **Wind:** 2 m/s, calm
- **Oil type:** Diesel
- **Difficulty:** Medium — low wind, low current
- **Expected error:** <5 km, <30 min

### Scenario 5: Tamil Nadu Coast (Illegal Dumping)
- **Location:** 9.5°N, 79.5°E
- **Vessel:** Offshore supply vessel, 15 knots
- **Wind:** 10 m/s, SE
- **Ocean current:** 0.6 knots, S
- **Difficulty:** Medium — strong wind
- **Expected error:** <5 km, <30 min

### Scenario 6: Offshore Platform (Stationary)
- **Location:** 15.0°N, 70.0°E
- **Platform:** Fixed structure
- **Wind:** 6 m/s, W
- **Ocean current:** 0.4 knots, NW
- **Oil type:** Crude
- **Difficulty:** Easy — no vessel movement
- **Expected error:** <2 km, <15 min

### Scenario 7: Goa Coast (Accidental)
- **Location:** 15.5°N, 73.8°E
- **Vessel:** Tug boat, 6 knots
- **Wind:** 4 m/s, SW
- **Oil type:** Bunker C
- **Difficulty:** Medium — nearshore
- **Expected error:** <4 km, <25 min

### Scenario 8: Gujarat Coast (Illegal)
- **Location:** 22.5°N, 68.5°E
- **Vessel:** Chemical tanker, 20 knots
- **Wind:** 7 m/s, NW
- **Ocean current:** 0.3 knots, N
- **Oil type:** Crude
- **Difficulty:** Medium — strong wind
- **Expected error:** <4 km, <25 min

### Scenario 9: Kerala Coast (Accidental)
- **Location:** 8.5°N, 76.5°E
- **Vessel:** Passenger ferry, 18 knots
- **Wind:** 5 m/s, W
- **Oil type:** Marine diesel
- **Difficulty:** Easy — clear conditions
- **Expected error:** <3 km, <20 min

### Scenario 10: Andaman Sea (Illegal)
- **Location:** 10.0°N, 96.0°E
- **Vessel:** Fishing vessel, 10 knots
- **Wind:** 3 m/s, NE
- **Ocean current:** 0.5 knots, NE
- **Oil type:** Crude
- **Difficulty:** Hard — long backtrack distance
- **Expected error:** <8 km, <45 min

## What We Will Show
- Position error (km)
- Time error (minutes)
- Score ranking correctness
- Confidence score
- Visual side-by-side comparison

## What We Will NOT Claim
- "Perfect accuracy" — show uncertainty
- "Real-time satellite processing" — show reanalysis mode
- "Continuous monitoring" — show snapshot analysis
- "Indian Ocean operational" — show proof-of-concept
