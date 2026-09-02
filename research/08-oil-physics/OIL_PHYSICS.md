# Oil Physics Strategy

## Use OpenDrift/OpenOil (VERIFIED)

**NOT recommended:** Build your own oil drift model.

### OpenDrift/OpenOil (GPL-2.0)
- **Repository:** https://github.com/OpenDrift/opendrift
- **Stars:** 312 | **Maintained by:** MET Norway
- **License:** GPL-2.0
- **Backward mode:** Built-in (negative timestep)

```python
from opendrift.models.openoil import OpenOil
from datetime import timedelta

o = OpenOil(weathering_model='noaa')
o.add_reader([current_reader, wind_reader])

# Configure processes
o.set_config('processes:evaporation', True)
o.set_config('processes:emulsification', True)

# Seed oil at spill location
o.seed_elements(lon=72.5, lat=10.0, z=0, radius=100,
                number=500, time=start_time,
                oil_type='GENERIC CRUDE')

# Run forward simulation
o.run(duration=timedelta(hours=6))
```

## Physics Included in OpenOil
| Process | Method | Reference |
|---------|--------|-----------|
| **Advection** | Currents + wind drift (0-6%) + Stokes drift | Standard |
| **Horizontal diffusion** | Random walk, configurable | Okubo |
| **Vertical mixing** | Turbulent + buoyancy | James SC |
| **Wave entrainment** | Li & Johansen (2017) | Peer-reviewed |
| **Evaporation** | NOAA PyGNOME algorithm | NOAA |
| **Emulsification** | NOAA PyGNOME algorithm | NOAA |
| **Dispersion** | Wave-breaking droplet formation | Johansen (2015) |
| **Beaching** | Coastline interaction | Configurable |

## Oil Types (NOAA ADIOS Database)
1000+ oil types with properties:
- API gravity, density, viscosity
- Pour point, interfacial tension
- Wax content, asphaltene content
- Distillation cuts

## What's Feasible in a Hackathon
- [x] Basic advection (current + wind drift)
- [x] Forward simulation (6-24 hours)
- [x] Backward tracking (OpenDrift negative timestep)
- [x] Oil type selection (generic crude)
- [x] Basic mass balance (evaporation, emulsification)
- [ ] Full weathering (simplified)
- [ ] Subsurface plume (not needed)
- [ ] Chemical fingerprinting (not required by PS)

## Alternative Models
| Model | Stars | License | Backward | Oil Weathering |
|-------|-------|---------|----------|----------------|
| **OpenDrift** | 312 | GPL-2.0 | Yes (built-in) | Yes (NOAA) |
| **PyGNOME** | 75 | Public domain | Hind-casting | Yes (ADIOS) |
| **MEDSLIK-II** | Community | Free | Yes | Yes |
| **Parcels** | 350 | MIT | Yes (custom kernels) | No (custom) |
| **MOHID** | GPL-3.0 | GPL-3.0 | Not primary | Yes |

## Key References
1. Dagestad et al. (2018) — "OpenDrift v1.0" — GMD
2. Rohrs et al. (2018) — "Vertical mixing on drift" — Ocean Science
3. Li & Johansen (2017) — Wave entrainment model
4. NOAA PyGNOME — Official operational model
