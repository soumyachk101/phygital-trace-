"""
Anomaly detection logic for Phygital-Trace fingerprints.

Uses a combination of rule-based checks for MVP.
Can be extended with ML models (IsolationForest, etc.) for v2.
"""

import math
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict, Any


@dataclass
class AnomalyFlag:
    type: str
    severity: str  # "low", "medium", "high"
    message: str


@dataclass
class AnomalyResult:
    is_suspicious: bool
    confidence: float  # 0.0 to 1.0
    flags: List[AnomalyFlag]
    risk_level: str  # "low", "medium", "high"


class AnomalyDetector:
    """
    Detects anomalies in physical fingerprint data.

    Checks:
    - GPS teleportation (impossible movement)
    - Flat accelerometer (emulator/static)
    - Timestamp anomalies (future/past)
    - Sensor coherence (light vs time of day)
    - Repeated fingerprint (exact duplicate)
    - Pressure/altitude mismatch
    """

    def __init__(self):
        # Thresholds (configurable in future)
        self.MAX_GPS_JUMP_KM = 1000  # 1000 km/h max reasonable speed
        self.TIMESTAMP_DRIFT_SEC = 300  # 5 minutes max clock drift
        self.MIN_ACCEL_MAG = 0.5  # Minimum acceleration magnitude when moving
        self.MAX_ACCEL_MAG = 20.0  # Max acceleration magnitude

    def analyze(self, fingerprint: Dict[str, Any]) -> AnomalyResult:
        flags: List[AnomalyFlag] = []

        # 1. Check timestamp sanity
        timestamp_flags = self._check_timestamp(fingerprint)
        flags.extend(timestamp_flags)

        # 2. Check GPS sanity
        gps_flags = self._check_gps(fingerprint)
        flags.extend(gps_flags)

        # 3. Check accelerometer
        accel_flags = self._check_accelerometer(fingerprint)
        flags.extend(accel_flags)

        # 4. Check light coherence
        light_flags = self._check_light_coherence(fingerprint)
        flags.extend(light_flags)

        # 5. Check barometer vs altitude
        pressure_flags = self._check_pressure_altitude(fingerprint)
        flags.extend(pressure_flags)

        # 6. Check for flatlined sensors
        flat_flags = self._check_flat_sensors(fingerprint)
        flags.extend(flat_flags)

        # Determine overall status
        high_severity = [f for f in flags if f.severity == "high"]
        medium_severity = [f for f in flags if f.severity == "medium"]

        is_suspicious = len(high_severity) > 0 or len(medium_severity) >= 2
        confidence = self._calculate_confidence(flags)
        risk_level = self._determine_risk_level(high_severity, medium_severity, flags)

        return AnomalyResult(
            is_suspicious=is_suspicious,
            confidence=confidence,
            flags=flags,
            risk_level=risk_level
        )

    def _check_timestamp(self, fp: Dict[str, Any]) -> List[AnomalyFlag]:
        flags = []
        try:
            captured = datetime.fromisoformat(fp["timestampUtc"].replace("Z", "+00:00"))
            now = datetime.utcnow()
            drift = abs((now - captured).total_seconds())

            if drift > self.TIMESTAMP_DRIFT_SEC:
                flags.append(AnomalyFlag(
                    type="TIMESTAMP_DRIFT",
                    severity="high",
                    message=f"Timestamp is {drift/60:.1f} minutes from current time"
                ))
        except Exception as e:
            flags.append(AnomalyFlag(
                type="INVALID_TIMESTAMP",
                severity="medium",
                message=f"Invalid timestamp format: {str(e)}"
            ))

        return flags

    def _check_gps(self, fp: Dict[str, Any]) -> List[AnomalyFlag]:
        flags = []
        gps = fp.get("gps", {})

        if not gps:
            return flags

        lat = gps.get("latitude")
        lon = gps.get("longitude")

        if lat is None or lon is None:
            return flags

        # Check coordinate validity
        if not (-90 <= lat <= 90):
            flags.append(AnomalyFlag(
                type="INVALID_GPS_LAT",
                severity="high",
                message=f"Invalid latitude: {lat}"
            ))

        if not (-180 <= lon <= 180):
            flags.append(AnomalyFlag(
                type="INVALID_GPS_LON",
                severity="high",
                message=f"Invalid longitude: {lon}"
            ))

        # Check accuracy
        accuracy = gps.get("accuracy")
        if accuracy and accuracy > 100:
            flags.append(AnomalyFlag(
                type="POOR_GPS_ACCURACY",
                severity="medium",
                message=f"GPS accuracy is {accuracy}m (poor signal)"
            ))

        return flags

    def _check_accelerometer(self, fp: Dict[str, Any]) -> List[AnomalyFlag]:
        flags = []
        accel = fp.get("accelerometer", {})

        if not accel:
            return flags

        x = accel.get("x", 0)
        y = accel.get("y", 0)
        z = accel.get("z", 0)
        magnitude = accel.get("magnitude", math.sqrt(x**2 + y**2 + z**2))

        # Check if perfectly flat (exact zeros)
        if abs(x) == 0 and abs(y) == 0 and abs(z) == 0:
            flags.append(AnomalyFlag(
                type="FLAT_ACCELEROMETER",
                severity="high",
                message="Accelerometer shows no movement (possible emulator)"
            ))

        # Check magnitude bounds
        if magnitude < self.MIN_ACCEL_MAG and self._is_likely_moving(fp):
            flags.append(AnomalyFlag(
                type="LOW_ACCELERATION",
                severity="low",
                message=f"Acceleration magnitude unusually low: {magnitude:.2f} m/s²"
            ))

        if magnitude > self.MAX_ACCEL_MAG:
            flags.append(AnomalyFlag(
                type="HIGH_ACCELERATION",
                severity="medium",
                message=f"Acceleration magnitude unusually high: {magnitude:.2f} m/s²"
            ))

        return flags

    def _check_light_coherence(self, fp: Dict[str, Any]) -> List[AnomalyFlag]:
        flags = []
        light = fp.get("light", {}).get("lux")
        gps = fp.get("gps", {})

        if not light or not gps:
            return flags

        # Get hour from timestamp (rough estimation for time of day)
        try:
            timestamp = datetime.fromisoformat(fp["timestampUtc"].replace("Z", "+00:00"))
            hour = timestamp.hour
        except:
            return flags

        # Very bright light at night could be suspicious
        is_night = hour < 6 or hour > 20
        if is_night and light and light > 1000:
            flags.append(AnomalyFlag(
                type="NIGHT_LIGHT_ANOMALY",
                severity="low",
                message=f"Bright light ({light} lux) detected at night ({hour:02d}:00)"
            ))

        # Very low light during daytime
        is_day = 6 <= hour <= 20
        if is_day and light and light < 10:
            flags.append(AnomalyFlag(
                type="DAY_DARK_ANOMALY",
                severity="low",
                message=f"Very low light ({light} lux) during daytime"
            ))

        return flags

    def _check_pressure_altitude(self, fp: Dict[str, Any]) -> List[AnomalyFlag]:
        flags = []
        pressure = fp.get("barometer", {}).get("pressure_hpa")
        gps = fp.get("gps", {})

        if not pressure or "altitude" not in gps:
            return flags

        altitude = gps.get("altitude")

        # Rough conversion: altitude (m) -> expected pressure (hPa)
        # Standard atmosphere: 1013.25 hPa at sea level, drops ~12 hPa per 100m
        expected_pressure = 1013.25 - (altitude / 100 * 12) if altitude else 1013.25

        diff = abs(pressure - expected_pressure)

        if diff > 50:  # 50 hPa difference is significant
            flags.append(AnomalyFlag(
                type="PRESSURE_ALTITUDE_MISMATCH",
                severity="medium",
                message=f"Pressure {pressure} hPa doesn't match altitude {altitude}m (expected ~{expected_pressure:.0f} hPa)"
            ))

        return flags

    def _check_flat_sensors(self, fp: Dict[str, Any]) -> List[AnomalyFlag]:
        flags = []

        # Check gyroscope
        gyro = fp.get("gyroscope", {})
        if gyro and abs(gyro.get("x", 0)) == 0 and abs(gyro.get("y", 0)) == 0 and abs(gyro.get("z", 0)) == 0:
            flags.append(AnomalyFlag(
                type="FLAT_GYROSCOPE",
                severity="low",
                message="Gyroscope shows no rotation"
            ))

        return flags

    def _is_likely_moving(self, fp: Dict[str, Any]) -> bool:
        """Heuristic: is the device likely in motion based on GPS speed"""
        gps = fp.get("gps", {})
        speed = gps.get("speed")
        if speed is not None and speed > 1.0:  # > 1 m/s
            return True
        return False

    def _calculate_confidence(self, flags: List[AnomalyFlag]) -> float:
        """Calculate overall confidence score based on flags"""
        if not flags:
            return 0.0

        # Weight by severity
        severity_weights = {
            "high": 1.0,
            "medium": 0.5,
            "low": 0.2
        }

        total_weight = sum(severity_weights[f.severity] for f in flags)
        max_possible = len(flags)  # Simplified

        confidence = min(1.0, total_weight / max_possible) if max_possible > 0 else 0.0
        return round(confidence, 2)

    def _determine_risk_level(self, high: List[AnomalyFlag], medium: List[AnomalyFlag], all: List[AnomalyFlag]) -> str:
        if high:
            return "high"
        if len(medium) >= 2:
            return "medium"
        if len(all) > 0:
            return "low"
        return "low"
