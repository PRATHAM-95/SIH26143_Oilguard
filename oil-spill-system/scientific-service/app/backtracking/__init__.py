"""Backtracking / backward source estimation module.

Provides ensemble backward Lagrangian particle simulation using OpenDrift's
native backward mode (negative timestep), combined with KDE-based source
region estimation and multi-dimensional confidence metrics.

Public API:
    run_backtrack_ensemble  - run ensemble backward simulation
    estimate_source         - estimate source region from endpoints
    compute_source_time_range - compute source time window
"""
