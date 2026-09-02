# Database Architecture (MongoDB)

## Collections

### simulation
```javascript
{
  "_id": ObjectId,
  "status": "captain_mode" | "simulating" | "observation" | "investigation" | "completed",
  "clock": ISODate("2025-01-15T14:30:00Z"),
  "environment": {
    "currentSource": "CMEMS",
    "windSource": "ERA5",
    "region": { type: "Polygon", coordinates: [...] }
  },
  "vessels": [ObjectId],
  "spillEvent": ObjectId,
  "incident": ObjectId,
  "investigation": ObjectId,
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

### vessels
```javascript
{
  "_id": ObjectId,
  "mmsi": "538001234",
  "imo": "9876543",
  "name": "MV Pacific Star",
  "type": "Cargo",
  "length": 200,
  "beam": 32,
  "draft": 12,
  "position": { type: "Point", coordinates: [72.3, 10.4] },
  "speed": 12.5,
  "heading": 45,
  "course": 44,
  "track": [
    { time: ISODate, lat: Number, lon: Number, speed: Number, heading: Number }
  ],
  "isGroundTruth": false
}
```

### spill_event
```javascript
{
  "_id": ObjectId,
  "vesselId": ObjectId,
  "location": { type: "Point", coordinates: [72.3, 10.4] },
  "time": ISODate,
  "oilType": "GENERIC CRUDE",
  "quantityKg": 5000,
  "isHidden": true,
  "forwardSimulation": {
    "duration": "6h",
    "particles": 5000,
    "timesteps": [...]
  }
}
```

### incident
```javascript
{
  "_id": ObjectId,
  "spillEventId": ObjectId,
  "observedTime": ISODate,
  "geometry": { type: "Polygon", coordinates: [...] },
  "area_km2": 2.3,
  "centroid": { type: "Point", coordinates: [72.35, 10.38] },
  "orientation": 45,
  "satelliteObservation": {
    "source": "Sentinel-1",
    "acquisitionTime": ISODate,
    "polarization": "VV"
  }
}
```

### investigation
```javascript
{
  "_id": ObjectId,
  "incidentId": ObjectId,
  "status": "running" | "completed",
  "steps": [
    { "name": "slick_detection", "status": "complete", "timestamp": ISODate },
    { "name": "environment_load", "status": "complete", "timestamp": ISODate },
    { "name": "backtracking", "status": "running", "progress": 0.6 },
    ...
  ],
  "prediction": {
    "origin": { type: "Point", coordinates: [72.28, 10.38] },
    "originUncertainty_km": 3.4,
    "spillTime": ISODate,
    "timeUncertainty_min": 22,
    "confidence": 0.87
  },
  "candidateVessels": [
    { "vesselId": ObjectId, "score": 0.87, "factors": {...} }
  ],
  "groundTruthRevealed": false,
  "groundTruth": {
    "actualOrigin": { type: "Point", coordinates: [72.3, 10.4] },
    "actualTime": ISODate,
    "positionError_km": 2.8,
    "timeError_min": 15
  }
}
```

## Indexes
```javascript
// vessels
db.vessels.createIndex({ "position": "2dsphere" })
db.vessels.createIndex({ "mmsi": 1 })

// spill_event
db.spill_event.createIndex({ "location": "2dsphere" })
db.spill_event.createIndex({ "time": -1 })

// incident
db.incident.createIndex({ "geometry": "2dsphere" })
db.incident.createIndex({ "observedTime": -1 })

// investigation
db.investigation.createIndex({ "incidentId": 1 })
db.investigation.createIndex({ "status": 1 })
```
