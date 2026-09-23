"""Oil Spill Scientific Service — FastAPI application.

Serves the frozen SYSTEM_SPEC §15.2 Python API:

    POST /api/forward-drift          -> §15.2 Forward Drift contract.
    GET  /api/forward-drift/preview  -> available oil types & env availability.
    GET  /api/environment/availability -> which real-data providers can run.
    POST /api/sar/detect             -> SAR oil-slick observation.
    POST /api/backtrack              -> Ensemble backward trajectory + source estimation.
    GET  /api/ais/availability       -> which AIS providers can run.
    POST /api/ais/query              -> AIS provider query (reconstructed traffic).
    POST /api/ais/filter             -> window/filter/reconstruct -> candidates.
    POST /api/score-vessels          -> frozen five-factor vessel attribution.
    POST /api/attribution/validate   -> controlled recovery scenarios.

Live environmental data (free, no-key internet feeds):

    GET  /api/environment/live-weather -> Open-Meteo wind + waves snapshot.
    GET  /api/environment/incidents   -> NASA EONET marine incident feed.
    GET  /api/environment/depth       -> ETOPO1 ocean depth at a coordinate.
"""

from __future__ import annotations

import logging
import os
import time as _time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response

load_dotenv()

log = logging.getLogger("oilspill.main")

from .drift.engine import (
    DRIFT_MODEL_VERSION,
    ForwardDriftEngine,
    _openoil_model,
    _time_varying_reader_class,
    list_valid_oil_types,
    resolve_oil_type,
)
from .environment.config import report_environment_availability
from .environment.live import fetch_depth, fetch_incidents, fetch_live_weather
from .models.forward_drift import (
    ForwardDriftRequest,
    ForwardDriftResponse,
    PreviewResponse,
)
from .models.sar import (
    SarCatalogResponse,
    SarDetectRequest,
    SarDetectResponse,
    SarPreviewResponse,
)
from .sar.catalog import (
    report_catalog_availability,
    search_stac_grd,
)
from .sar.config import report_sar_availability
from .sar.contract import ProvenanceState
from .sar.pipeline import OBSERVATION_MODEL_VERSION, process_observation
from .backtracking.engine import (
    BACKTRACK_MODEL_VERSION,
    BacktrackConfig,
    compute_source_time_range,
    make_run_id,
    run_backtrack_ensemble,
)
from .backtracking.source import estimate_source
from .models.backtrack import BacktrackRequest, BacktrackResponse
from .ais.config import report_ais_availability
from .ais.filters import filter_candidates
from .ais.providers import resolve_ais_provider
from .ais.scoring import ScoreContext, rank_vessels
from .ais.validation import run_all_scenarios
from .models.ais import (
    AisCandidateOut,
    AisFilterRequest,
    AisFilterResponse,
    AisMessageOut,
    AisQueryRequest,
    AisQueryResponse,
    AisTrackOut,
    AnomalyOut,
    AttributionValidateRequest,
    AttributionValidateResponse,
    ScoreVesselsRequest,
    ScoreVesselsResponse,
)
from .observability import instrument_app

APP_VERSION = "0.6.0"
APP_TITLE = "Oil Spill Scientific Service"

# "Slow start, fast runtime": when SCIENTIFIC_PRELOAD != "0" the service warms
# the heavy science stack (OpenDrift import + oil-type probe + reader subclass +
# SAR fixture caches) inside the FastAPI lifespan, BEFORE it accepts traffic.
# The first drift/backtrack/preview request then never pays the import cost.
# If the stack is missing the warm-up degrades gracefully (logs a warning, keeps
# the existing lazy path) so tooling/tests without OpenDrift still boot.
_PRELOAD_DISABLED = os.getenv("SCIENTIFIC_PRELOAD", "1").strip() == "0"

# Set to True as soon as the warm-up has run (or was skipped/degraded). Drives
# /api/ready so launchers can health-gate traffic on a warm, ready service.
_warm = False


def _warm_fixture() -> None:
    """Warm the deterministic SAR fixture caches (cheap) at boot."""
    try:
        from .sar.fixture import build_fixture_scene

        build_fixture_scene()
        log.info("sar fixture preloaded")
    except Exception as exc:  # noqa: BLE001 - never block startup on the demos
        log.warning("sar fixture preload failed: %s", exc)


def _warm_startup() -> None:
    """Eagerly load/import the heavy science components once, at boot time.

    Every call here is functionally a no-op if OpenDrift is not installed
    (they fall back to lazy ``(None, None)`` internally), but when it IS
    installed the first science request goes from paying a 10-30s import to
    an instant call.
    """
    global _warm
    if _PRELOAD_DISABLED:
        log.info("scientific-service preload disabled (SCIENTIFIC_PRELOAD=0); staying lazy")
        _warm = True
        return
    t0 = _time.monotonic()
    try:
        _openoil_model()
        _time_varying_reader_class()
        oil_types = list(list_valid_oil_types())
        _warm_fixture()
        log.info(
            "scientific-service warm-up done in %.1fs (%d oil types cached)",
            _time.monotonic() - t0,
            len(oil_types),
        )
    except Exception as exc:  # noqa: BLE001 - degraded warm start is still a start
        log.warning("scientific-service warm-up degraded (%s); running lazy", exc)
    finally:
        _warm = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    _warm_startup()
    yield


app = FastAPI(title=APP_TITLE, version=APP_VERSION, lifespan=lifespan)

instrument_app(app)

# Engine is stateless and thread-safe to construct per call; keep one shared
# instance for config reuse, constructing OpenOil inside each run() call.
_engine = ForwardDriftEngine()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "UP", "service": "oil-spill-scientific-service", "version": APP_VERSION}


@app.get("/api/ready")
def ready(response: Response) -> Dict[str, Any]:
    """Liveness-with-warmth gate for launchers/load balancers.

    200 once the warm-up has finished, 503 while the heavy stack is still
    being preloaded. Traffic should not be sent to this service before 200.
    """
    if not _warm:
        response.status_code = 503
        return {"status": "LOADING", "warm": False, "service": APP_TITLE}
    return {"status": "UP", "warm": True, "service": APP_TITLE}


@app.get("/api/environment/availability")
def environment_availability() -> Dict[str, Any]:
    return report_environment_availability()


@app.get("/api/environment/live-weather")
def environment_live_weather(lat: float, lon: float) -> Dict[str, Any]:
    """Live wind + wave snapshot from Open-Meteo (free, no credentials).

    Honest UNAVAILABLE (200 with ``available=False``) when the feed is
    unreachable — the UI never treats an offline feed as data.
    """
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="lon/lat out of range")
    return fetch_live_weather(lat, lon)


@app.get("/api/environment/incidents")
def environment_incidents(
    west: float, south: float, east: float, north: float
) -> Dict[str, Any]:
    """Live marine incident feed from NASA EONET v3 (keyword-filtered)."""
    if west >= east or south >= north:
        raise HTTPException(status_code=400, detail="Invalid bbox: west<east and south<north")
    return fetch_incidents(bbox=(west, south, east, north))


@app.get("/api/environment/depth")
def environment_depth(lat: float, lon: float) -> Dict[str, Any]:
    """Live ocean depth (m) from ETOPO1 via OpenTopoData."""
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="lon/lat out of range")
    return fetch_depth(lat, lon)


@app.get("/api/forward-drift/preview")
def forward_drift_preview() -> PreviewResponse:
    valid = list_valid_oil_types()
    generic = [t for t in valid if t.startswith("GENERIC")]
    return PreviewResponse(
        oil_types=list(valid),
        default_oil_type=resolve_oil_type("GENERIC BUNKER C"),
        environment_availability=report_environment_availability(),
        model_version=DRIFT_MODEL_VERSION,
    )


@app.post("/api/forward-drift")
def forward_drift(req: ForwardDriftRequest) -> ForwardDriftResponse:
    """Execute a forward-oil-drift simulation (frozen §15.2 contract)."""
    # Validate origin st on a plausible globe point (reject Antarctica/N pole
    # sentinel values politely).
    if req.origin.lat == 0.0 and req.origin.lon == 0.0:
        raise HTTPException(status_code=400, detail="origin (0,0) is not a valid spill location")

    try:
        result = _engine.run(
            origin_lat=req.origin.lat,
            origin_lon=req.origin.lon,
            start_time=req.time,
            duration_hours=req.duration_hours,
            particle_count=req.particleCount,
            oil_type=req.oilType,
            currents=req.currents,
            wind=req.wind,
            environment_source=req.environmentSource,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return result


def _candidate_to_out(c: Any) -> Dict[str, Any]:
    return {
        "candidate_id": c.candidate_id,
        "classification": c.classification.value,
        "confidence": c.confidence,
        "centroid": [float(c.centroid[0]), float(c.centroid[1])],
        "polygon": [[float(lon), float(lat)] for lon, lat in c.polygon],
        "bbox": c.bbox,
        "area_km2": c.area_km2,
        "perimeter_km": c.perimeter_km,
        "length_km": c.length_km,
        "width_km": c.width_km,
        "aspect_ratio": c.aspect_ratio,
        "orientation_deg": c.orientation_deg,
        "shape_factor": c.shape_factor,
        "pixel_area": c.pixel_area,
        "contrast_db": c.contrast_db,
        "incidence_deg": c.incidence_deg,
        "look_alike_hints": list(c.look_alike_hints),
        "warnings": list(c.warnings),
    }


@app.get("/api/sar/preview")
def sar_preview() -> SarPreviewResponse:
    """Availability report: which SAR sources/detectors can actually run."""
    return SarPreviewResponse(
        availability=report_sar_availability(),
        model_version=OBSERVATION_MODEL_VERSION,
    )


@app.get("/api/sar/catalog")
def sar_catalog() -> SarCatalogResponse:
    """Live real Sentinel-1 GRD discovery over the default study AOI.

    Runs an *anonymous* Copernicus Data Space STAC search (no credentials
    required) and returns the real Sentinel-1 GRD products available over the
    Arabian Sea shelf AOI in the recent window. This is the honest, verifiable
    real-data validation path when download credentials are absent; download
    itself remains gated on configured CDSE credentials.
    """
    result = search_stac_grd()
    return SarCatalogResponse(
        status=result.status,
        reason=result.reason,
        searched_at=result.searched_at,
        aoi=result.aoi,
        time_range=result.time_range,
        product_count=len(result.products),
        products=[p.to_dict() for p in result.products],
        technical=report_catalog_availability()["catalog"],
    )


@app.post("/api/sar/detect")
def sar_detect(req: SarDetectRequest) -> SarDetectResponse:
    """Run a complete SAR oil-slick observation (frozen §15 tool registry).

    The scene (observed evidence) and the detector's candidate list (model
    output) are returned together but are clearly separated in provenance.
    """
    try:
        result = process_observation(
            source=req.source,
            detector=req.detector,
            max_candidates=req.max_candidates,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"sar observation failed: {exc}")

    return SarDetectResponse(
        observation_id=result.observation_id,
        status=result.status.value,
        source_state=result.source_state.value if result.source_state else ProvenanceState.UNAVAILABLE.value,
        source=result.source,
        provider_dataset=result.provider_dataset,
        acquisition_time=result.acquisition_time,
        satellites=list(result.satellites),
        polarization=result.polarization,
        scene_id=result.scene_id,
        scene_footprint=result.scene_footprint,
        detector=result.detector,
        detector_version=result.detector_version,
        preprocess_steps=list(result.preprocess_steps),
        candidates=[_candidate_to_out(c) for c in result.candidates],
        confidence=result.confidence,
        slick_area_km2=result.slick_area_km2,
        age_estimate=result.age_estimate,
        age_available=result.age_available,
        warnings=list(result.warnings),
        errors=list(result.errors),
    )


@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "service": APP_TITLE,
        "version": APP_VERSION,
        "endpoints": [
            "/health",
            "/api/forward-drift",
            "/api/forward-drift/preview",
            "/api/environment/availability",
            "/api/environment/live-weather",
            "/api/environment/incidents",
            "/api/environment/depth",
            "/api/sar/preview",
            "/api/sar/catalog",
            "/api/sar/detect",
            "/api/backtrack",
            "/api/ais/availability",
            "/api/ais/query",
            "/api/ais/filter",
            "/api/score-vessels",
            "/api/attribution/validate",
        ],
        "docs": "/docs",
    }


def _message_to_out(m: Any) -> AisMessageOut:
    return AisMessageOut(
        timestamp=m.timestamp,
        longitude=m.longitude,
        latitude=m.latitude,
        speedKnots=m.speed_knots,
        courseDeg=m.course_deg,
        headingDeg=m.heading_deg,
        interpolated=bool(m.interpolated),
    )


def _track_to_out(t: Any, max_messages: int | None = None) -> AisTrackOut:
    msgs = list(t.messages)
    if max_messages is not None and len(msgs) > max_messages:
        # Keep the series readable but bounded: drop to a uniform sample.
        step = len(msgs) / max_messages
        msgs = [msgs[int(i * step)] for i in range(max_messages)]
    return AisTrackOut(
        mmsi=t.mmsi,
        name=t.name,
        vesselType=t.vessel_type,
        imo=t.imo,
        lengthM=t.length_m,
        beamM=t.beam_m,
        draftM=t.draft_m,
        messages=[_message_to_out(m) for m in msgs],
        sourceState=t.source_state.value if hasattr(t.source_state, "value") else str(t.source_state),
        provider=t.provider,
        dataset=t.dataset,
    )


def _ais_candidate_to_out(c: Any, max_track_messages: int = 200) -> AisCandidateOut:
    return AisCandidateOut(
        mmsi=c.mmsi,
        name=c.name,
        vesselType=c.vessel_type,
        imo=c.imo,
        track=_track_to_out(c.track, max_messages=max_track_messages),
        messagesInWindow=c.messages_in_window,
        medianCadenceMin=c.median_cadence_min,
        interpolationFraction=c.interpolation_fraction,
        coverageGaps=c.coverage_gaps,
        minDistanceKm=c.min_distance_km,
        timeOfClosestApproach=c.time_of_closest_approach,
        closestPosition=c.closest_position,
        anomalies=[AnomalyOut(kind=a.kind, timestamp=a.timestamp, metric=a.metric, detail=a.detail) for a in c.anomalies],
        reliability=c.reliability,
        reliabilityNotes=list(c.reliability_notes),
    )


@app.get("/api/ais/availability")
def ais_availability() -> Dict[str, Any]:
    """Which AIS providers can genuinely run, with provenance states."""
    return report_ais_availability()


@app.post("/api/ais/query")
def ais_query(req: AisQueryRequest) -> AisQueryResponse:
    """Query an AIS provider for vessel tracks near the origin in the window."""
    from .ais.contract import AisProviderError

    t0 = _time.monotonic()
    try:
        provider = resolve_ais_provider(req.source)
    except AisProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        tracks = provider.query(
            center_lon=req.origin.lon,
            center_lat=req.origin.lat,
            time_start=req.timeStart,
            time_end=req.timeEnd,
            radius_km=req.radiusKm,
            seed=req.seed,
            max_vessels=req.maxVessels,
        )
    except AisProviderError as exc:
        # Honest UNAVAILABLE: surface the reason, never fabricate a feed.
        raise HTTPException(status_code=503, detail=str(exc))

    return AisQueryResponse(
        sourceState=provider.state.value if hasattr(provider.state, "value") else str(provider.state),
        provider=provider.source,
        dataset=provider.dataset,
        references={
            "seed": getattr(provider, "seed", None),
            "reference_time": getattr(provider, "reference_time", None),
        },
        vesselCount=len(tracks),
        tracks=[_track_to_out(t, max_messages=400) for t in tracks],
        elapsedMs=int((_time.monotonic() - t0) * 1000),
    )


@app.post("/api/ais/filter")
def ais_filter(req: AisFilterRequest) -> AisFilterResponse:
    """Filter + reconstruct raw tracks into attribution candidates."""
    t0 = _time.monotonic()
    from .ais.contract import AisMessage, AisTrack

    def _message_in(m: Any) -> AisMessage:
        return AisMessage(
            timestamp=m.timestamp,
            longitude=m.longitude,
            latitude=m.latitude,
            speed_knots=m.speedKnots,
            course_deg=m.courseDeg,
            heading_deg=m.headingDeg,
            interpolated=bool(m.interpolated),
        )

    tracks = [
        AisTrack(
            mmsi=t.mmsi,
            name=t.name,
            vessel_type=t.vesselType,
            imo=t.imo,
            length_m=t.lengthM,
            beam_m=t.beamM,
            draft_m=t.draftM,
            messages=[_message_in(m) for m in t.messages],
            provider=t.provider,
            dataset=t.dataset,
        )
        for t in req.tracks
    ]
    outcome = filter_candidates(
        tracks,
        req.origin.lon,
        req.origin.lat,
        req.timeRange.earliest,
        req.timeRange.latest,
        req.radiusKm,
        max_gap_min=req.maxGapMin,
    )
    return AisFilterResponse(
        kept=len(outcome.candidates),
        dropped=len(outcome.dropped),
        stats={**outcome.stats, "elapsed_ms": int((_time.monotonic() - t0) * 1000)},
        candidates=[_ais_candidate_to_out(c) for c in outcome.candidates],
        droppedVessels=[{"mmsi": d["mmsi"], "name": d["name"], "reasons": d["reasons"]} for d in outcome.dropped],
    )


@app.post("/api/score-vessels")
def score_vessels(req: ScoreVesselsRequest) -> ScoreVesselsResponse:
    """Frozen §11 five-factor attribution scoring for filtered candidates."""
    from .ais.contract import AisCandidate, AisMessage, AisTrack, AnomalySignal

    def _message_in(m: Any) -> AisMessage:
        return AisMessage(
            timestamp=m.timestamp,
            longitude=m.longitude,
            latitude=m.latitude,
            speed_knots=m.speedKnots,
            course_deg=m.courseDeg,
            heading_deg=m.headingDeg,
            interpolated=bool(m.interpolated),
        )

    candidates: list[AisCandidate] = []
    for c in req.candidates:
        track = AisTrack(
            mmsi=c.track.mmsi,
            name=c.track.name,
            vessel_type=c.track.vesselType,
            imo=c.track.imo,
            length_m=c.track.lengthM,
            beam_m=c.track.beamM,
            draft_m=c.track.draftM,
            provider=c.track.provider,
            dataset=c.track.dataset,
            messages=[_message_in(m) for m in c.track.messages],
        )
        candidates.append(
            AisCandidate(
                mmsi=c.mmsi,
                name=c.name,
                vessel_type=c.vesselType,
                imo=c.imo,
                track=track,
                messages_in_window=c.messagesInWindow,
                median_cadence_min=c.medianCadenceMin,
                interpolation_fraction=c.interpolationFraction,
                coverage_gaps=c.coverageGaps,
                min_distance_km=c.minDistanceKm,
                time_of_closest_approach=c.timeOfClosestApproach,
                closest_position=c.closestPosition,
                anomalies=[
                    AnomalySignal(kind=a.kind, timestamp=a.timestamp, metric=a.metric, detail=a.detail)
                    for a in c.anomalies
                ],
                reliability=c.reliability,
                reliability_notes=list(c.reliabilityNotes),
            )
        )

    ctx = ScoreContext(
        origin_lon=req.origin.lon,
        origin_lat=req.origin.lat,
        release_time=req.releaseTime,
        search_radius_km=req.searchRadiusKm,
        backtracking_fan=req.backtracking.trajectories if req.backtracking else None,
        environment=req.environment.model_dump() if req.environment else None,
    )
    ranked = rank_vessels(candidates, ctx, weights=req.weights)
    return ScoreVesselsResponse(
        status=ranked["status"],
        rankedVessels=ranked["ranked_vessels"],
        ranking=ranked["ranking"],
        conclusion=ranked["conclusion"],
        weightsUsed=ranked["weights_used"],
        attributionModelVersion=ranked["attribution_model_version"],
        sourceState=ranked["source_state"],
        warnings=ranked["warnings"],
    )


@app.post("/api/attribution/validate")
def attribution_validate(req: AttributionValidateRequest) -> AttributionValidateResponse:
    """Controlled recovery scenarios (ground-truth enclave) — Step 10 §validation.

    Never called by the live investigation path. ``writeArtifact`` writes the
    measured results to research/25-ais-attribution/step10_validation_results.json.
    """
    try:
        payload = run_all_scenarios(
            only=req.scenario,
            seed=req.seed,
            write_artifact=req.writeArtifact,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return AttributionValidateResponse(
        scenarios=payload["scenarios"],
        metrics=payload["metrics"],
        writeArtifact=req.writeArtifact,
        artifactPath=payload.get("artifact_path"),
        warnings=[],
    )


@app.post("/api/backtrack")
def backtrack(req: BacktrackRequest) -> BacktrackResponse:
    """Ensemble backward trajectory simulation + source region estimation.

    Releases an ensemble of particles from the observed slick position and
    advects them backward in time using OpenDrift's native backward mode.
    Produces a probable source region via KDE-based contour extraction.
    """
    import time as _time
    from datetime import datetime, timezone

    t0 = _time.monotonic()
    all_warnings: list[str] = []

    if req.origin.lat == 0.0 and req.origin.lon == 0.0:
        raise HTTPException(status_code=400, detail="origin (0,0) is not a valid slick location")

    config = BacktrackConfig(
        ensemble_size=req.ensemble_size,
        particles_per_member=req.particles_per_member,
        duration_hours=req.duration_hours,
        seed=req.seed,
    )

    try:
        bt_result = run_backtrack_ensemble(
            slick_lon=req.origin.lon,
            slick_lat=req.origin.lat,
            observation_time=req.time,
            config=config,
            environment_source=req.environmentSource,
            currents=req.currents,
            wind=req.wind,
            polygon=req.polygon,
        )
        all_warnings.extend(bt_result.warnings)

        if bt_result.all_endpoints is None or bt_result.all_endpoints.shape[0] == 0:
            return BacktrackResponse(
                run_id=make_run_id(req.time, req.origin.lon, req.origin.lat),
                status="failed",
                warnings=all_warnings or ["No valid endpoints produced."],
            )

        # Source estimation from collected endpoints.
        src = estimate_source(
            bt_result.all_endpoints,
            req.origin.lon,
            req.origin.lat,
        )

        # Source time range.
        time_range = compute_source_time_range(req.time, req.duration_hours)

        # Build trajectory output (compact fan of real backward particle paths).
        # Each valid member contributes a handful of representative particle
        # trajectories, ordered from the observed slick back toward the source.
        trajectories = []
        for m in bt_result.members:
            if not m.valid:
                continue
            if m.trajectory:
                for pt in m.trajectory:
                    trajectories.append({
                        "member": m.member_index,
                        "particle": int(pt["particle"]),
                        "wind_drift_factor": round(m.wind_drift_factor, 4),
                        "diffusivity": round(m.diffusivity, 2),
                        "endpoints": pt["endpoints"],
                    })
            elif m.endpoints.size > 0:
                # Fallback if trajectory extraction failed: one point per member.
                trajectories.append({
                    "member": m.member_index,
                    "particle": 0,
                    "wind_drift_factor": round(m.wind_drift_factor, 4),
                    "diffusivity": round(m.diffusivity, 2),
                    "endpoints": [
                        {"lon": float(lo), "lat": float(la)}
                        for lo, la in zip(m.endpoints[:, 0], m.endpoints[:, 1])
                    ],
                })

        completed = datetime.now(timezone.utc)
        elapsed_ms = int((_time.monotonic() - t0) * 1000)
        run_id = make_run_id(req.time, req.origin.lon, req.origin.lat)

        # Ensemble summary.
        member_count = len([m for m in bt_result.members if m.valid])

        from .models.backtrack import (
            BacktrackRunMetadata,
            ConfidenceMetrics,
            EnsembleSummary,
            QualityMetrics,
            SourceTimeRange,
        )

        return BacktrackResponse(
            run_id=run_id,
            status="completed",
            source_region=src.source_region,
            source_contours=src.contours,
            origin_estimate={"lon": round(src.origin_lon, 6), "lat": round(src.origin_lat, 6)},
            origin_time_range=SourceTimeRange(**time_range),
            uncertainty_km=round(src.uncertainty_km, 2),
            confidence=ConfidenceMetrics(
                source_concentration=src.source_concentration,
                # Environmental quality is a rating of the *realism* of the
                # forcing actually used (HIGH for real reanalysis/obs, LOW for
                # synthetic CONTROLLED fields). Provenance (which dataset) is
                # carried separately in backtrackRun.environment_source/dataset
                # so the two are never conflated.
                environmental_quality="HIGH"
                if req.environmentSource in ("REAL", "CMEMS_ERA5", "CMEMS", "ERA5")
                else "LOW",
                trajectory_agreement=src.trajectory_agreement,
                ensemble_stability=src.ensemble_stability,
            ),
            trajectories=trajectories,
            ensemble_summary=EnsembleSummary(
                member_count=member_count,
                converged_count=bt_result.converged_count,
                mean_endpoint_distance_km=src.mean_distance_km,
                std_endpoint_distance_km=src.std_distance_km,
            ),
            quality=QualityMetrics(
                total_particles=bt_result.total_particles,
                converged_particles=bt_result.converged_count * req.particles_per_member,
                land_hits=bt_result.land_hits,
                domain_exits=bt_result.domain_exits,
                invalid_particles=bt_result.total_particles - bt_result.converged_count * req.particles_per_member,
                warnings=all_warnings,
            ),
            backtrackRun=BacktrackRunMetadata(
                run_id=run_id,
                simulation_id=req.simulation_id,
                model_version=BACKTRACK_MODEL_VERSION,
                environment_source=req.environmentSource,
                environment_dataset="CONTROLLED" if req.environmentSource == "CONTROLLED" else req.environmentSource,
                ensemble_size=req.ensemble_size,
                particles_per_member=req.particles_per_member,
                duration_hours=req.duration_hours,
                timestep_seconds=config.timestep_seconds,
                seed=config.seed,
                reproducibility_digest="",
                started_at=completed,
                completed_at=completed,
                elapsed_ms=elapsed_ms,
            ),
            warnings=all_warnings,
        )

    except Exception as exc:
        log.exception("Backtracking failed")
        raise HTTPException(status_code=500, detail=f"backtracking failed: {exc}")