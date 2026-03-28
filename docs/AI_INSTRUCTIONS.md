# AI_INSTRUCTIONS.md — Phygital-Trace Anomaly Detection Service

## Overview

The AI service is a **Python FastAPI microservice** that analyzes `PhysicalFingerprint` data to detect sensor spoofing or synthetic data patterns that suggest a capture is NOT genuine.

**Key principle:** We cannot verify the *image content* is real. We verify that the *sensor data* is physically plausible and internally consistent.

---

## Service Structure

```
packages/ai-service/
├── main.py                  # FastAPI app entry point
├── models/
│   ├── schemas.py           # Pydantic models
│   └── ml_model.pkl         # Trained Isolation Forest (serialized)
├── services/
│   ├── anomaly_detector.py  # Core detection logic
│   ├── feature_extractor.py # Raw fingerprint → feature vector
│   └── rule_engine.py       # Hard-coded rule checks
├── utils/
│   ├── geo.py               # Geospatial helpers
│   └── time_utils.py        # NTP-aware time checks
├── data/
│   └── training/            # Training data for Isolation Forest
├── requirements.txt
└── Dockerfile
```

---

## API Contract

### `POST /analyze`

**Request:**
```json
{
  "captureId": "cap_xyz789",
  "fingerprint": { ...PhysicalFingerprint... },
  "deviceHistory": [
    {
      "capturedAt": "2026-03-28T10:00:00Z",
      "latitude": 22.57,
      "longitude": 88.36
    }
  ]
}
```

**Response:**
```json
{
  "captureId": "cap_xyz789",
  "is_suspicious": false,
  "risk_level": "low",
  "confidence": 0.97,
  "anomaly_score": 0.04,
  "flags": [],
  "processing_ms": 12
}
```

**`risk_level` values:** `low` | `medium` | `high`  
**`flags`:** list of triggered rule names (see below)

---

## Detection Rules

### Rule Engine (Deterministic — `rule_engine.py`)

These are hard-coded logic checks. Any trigger immediately flags the capture.

#### R-01: Flat Accelerometer
```python
# All accelerometer values are exactly 0.0 or near-zero
# Impossible on a real handheld device (gravity alone = ~9.8 m/s²)
if abs(fingerprint.accel_magnitude - 9.81) > 5.0:
    flags.append("FLAT_ACCELEROMETER")
# OR
if fingerprint.accel_x == 0.0 and fingerprint.accel_y == 0.0 and fingerprint.accel_z == 0.0:
    flags.append("ZERO_ACCELEROMETER")
```

#### R-02: GPS Teleportation
```python
# User was in Mumbai 10 minutes ago, now in London?
# Calculates haversine distance between last known location and current
MAX_SPEED_KMH = 1200  # faster than commercial aircraft = suspicious
if time_delta_hours > 0:
    speed_kmh = distance_km / time_delta_hours
    if speed_kmh > MAX_SPEED_KMH:
        flags.append("GPS_TELEPORTATION")
```

#### R-03: Timestamp Drift
```python
# Device time vs server NTP time
# Captures with timestamps >60s in the future are suspicious
# (could indicate timestamp manipulation)
server_time_ms = time.time() * 1000
drift_ms = fingerprint.timestamp_unix_ms - server_time_ms
if drift_ms > 60_000:  # 60 seconds ahead
    flags.append("FUTURE_TIMESTAMP")
elif drift_ms < -86_400_000:  # More than 24 hours in past
    flags.append("STALE_TIMESTAMP")
```

#### R-04: Light-Time Coherence
```python
# Is ambient light consistent with time of day at given location?
# e.g., 10,000 lux at 2 AM = suspicious
hour_utc = datetime.utcfromtimestamp(fingerprint.timestamp_unix_ms / 1000).hour
is_nighttime = hour_utc < 5 or hour_utc > 20  # rough check
if is_nighttime and fingerprint.light_lux > 2000:
    flags.append("LIGHT_TIME_MISMATCH")
```

#### R-05: Altitude Coherence
```python
# GPS altitude vs barometric altitude should roughly match
# (within ~500m — baro is affected by weather)
if fingerprint.gps_altitude and fingerprint.pressure_hpa:
    baro_altitude = 44330 * (1 - (fingerprint.pressure_hpa / 1013.25) ** 0.1903)
    altitude_discrepancy = abs(fingerprint.gps_altitude - baro_altitude)
    if altitude_discrepancy > 500:
        flags.append("ALTITUDE_MISMATCH")
```

#### R-06: Perfect Sensor Values
```python
# Real sensors have noise. Round numbers or perfect values = suspicious.
# e.g., GPS exactly 22.0000000, light exactly 1000.0000
def is_suspiciously_round(value: float, decimals: int = 4) -> bool:
    return round(value, decimals) == round(value, 1)

if is_suspiciously_round(fingerprint.gps_latitude):
    flags.append("ROUND_GPS_COORDINATES")
```

#### R-07: Exact Duplicate Fingerprint
```python
# Same fingerprint hash seen before = replay attack
existing = db.query(
    "SELECT id FROM captures WHERE fingerprint_hash = ?", [fingerprint_hash]
)
if existing:
    flags.append("DUPLICATE_FINGERPRINT")
```

---

## ML Model: Isolation Forest (`anomaly_detector.py`)

For subtler anomalies that rules miss, we use an **Isolation Forest** (unsupervised anomaly detection).

### Feature Vector (per capture)

```python
def extract_features(fp: PhysicalFingerprint) -> np.ndarray:
    return np.array([
        fp.accel_magnitude,              # Should be near 9.81
        fp.accel_x / fp.accel_magnitude, # Normalized direction
        fp.accel_y / fp.accel_magnitude,
        fp.accel_z / fp.accel_magnitude,
        fp.gyro_x, fp.gyro_y, fp.gyro_z,
        fp.light_lux,
        fp.pressure_hpa,
        fp.gps_accuracy,
        fp.battery_level,
        hour_of_day_sin,                 # Cyclic encoding of hour
        hour_of_day_cos,
        fp.wifi_rssi if fp.wifi_rssi else -100,
    ])
```

### Training Data
- Real captures from beta users (labeled as genuine)
- Synthetic/emulated captures (labeled as anomalous)
- Replay attacks (same fingerprint, different timestamps)

### Model Training

```python
from sklearn.ensemble import IsolationForest
import joblib

model = IsolationForest(
    n_estimators=200,
    contamination=0.05,   # Expect 5% anomalies
    random_state=42
)
model.fit(X_train_genuine)
joblib.dump(model, 'models/ml_model.pkl')
```

### Scoring
```python
# Isolation Forest outputs: -1 (anomaly) or 1 (normal)
# decision_function() gives continuous score (lower = more anomalous)
raw_score = model.decision_function([features])[0]
anomaly_score = 1 - (raw_score - min_score) / (max_score - min_score)
# anomaly_score: 0.0 = completely normal, 1.0 = very anomalous
```

---

## Risk Level Mapping

```python
def compute_risk_level(anomaly_score: float, flags: list[str]) -> str:
    # Hard rules that immediately escalate to HIGH
    HIGH_RISK_FLAGS = {
        "GPS_TELEPORTATION",
        "ZERO_ACCELEROMETER", 
        "DUPLICATE_FINGERPRINT",
        "FUTURE_TIMESTAMP"
    }
    
    if any(f in HIGH_RISK_FLAGS for f in flags):
        return "high"
    
    if len(flags) >= 2 or anomaly_score > 0.75:
        return "high"
    elif len(flags) == 1 or anomaly_score > 0.4:
        return "medium"
    else:
        return "low"
```

---

## Integration with Main API

The Node.js backend calls the AI service via HTTP (non-blocking):

```typescript
// services/ai.service.ts
async function analyzeFingerprint(
  captureId: string,
  fingerprint: PhysicalFingerprint,
  deviceHistory: LocationHistory[]
): Promise<AnomalyResult> {
  const response = await fetch(`${env.AI_SERVICE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captureId, fingerprint, deviceHistory }),
    signal: AbortSignal.timeout(5000)  // 5s timeout — don't block capture
  });
  
  if (!response.ok) {
    // AI service failure is non-fatal — mark as PENDING and retry later
    logger.warn(`AI service unavailable for capture ${captureId}`);
    return { is_suspicious: false, risk_level: 'low', flags: [] };
  }
  
  return response.json();
}
```

---

## Deployment

```dockerfile
# Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```txt
# requirements.txt
fastapi==0.110.0
uvicorn==0.29.0
pydantic==2.7.0
scikit-learn==1.4.2
numpy==1.26.4
pandas==2.2.1
joblib==1.4.0
httpx==0.27.0
```

---

## Future Improvements (v2)

- **Image-level detection:** Run CLIP-based classifier to detect AI-generated images
- **Cross-capture correlation:** Detect coordinated spoofing (multiple devices, same location)
- **Federated learning:** Improve model on-device without sending raw data
- **NTP integration:** Call a pool.ntp.org server at analysis time for precise drift check
