"""
Unit tests for the anomaly detector
"""

from detector import AnomalyDetector, AnomalyResult, AnomalyFlag
import pytest


@pytest.fixture
def detector():
    return AnomalyDetector()


def test_valid_fingerprint(detector):
    """A normal fingerprint should have no flags and be clean"""
    fingerprint = {
        "timestampUtc": "2026-03-28T14:23:45.123Z",
        "timestampUnixMs": 1743170625123,
        "gps": {
            "latitude": 22.5726,
            "longitude": 88.3639,
            "altitude": 15.2,
            "accuracy": 3.5,
            "speed": 0.0,
            "heading": None
        },
        "accelerometer": {
            "x": 0.12,
            "y": 9.78,
            "z": 0.34,
            "magnitude": 9.79
        },
        "gyroscope": {
            "x": 0.001,
            "y": -0.002,
            "z": 0.0
        },
        "light": {
            "lux": 1250.5
        },
        "barometer": {
            "pressure_hpa": 1013.2
        },
        "network": {
            "wifiRssi": -65,
            "cellularSignal": None,
            "connectionType": "wifi"
        },
        "device": {
            "model": "iPhone 15 Pro",
            "osVersion": "iOS 17.4",
            "batteryLevel": 0.82,
            "isCharging": False
        }
    }

    result = detector.analyze(fingerprint)

    assert isinstance(result, AnomalyResult)
    assert result.is_suspicious is False
    assert result.confidence >= 0.0
    assert result.risk_level in ["low", "medium", "high"]


def test_flat_accelerometer(detector):
    """Zero accelerometer values should trigger high severity flag"""
    fingerprint = {
        "timestampUtc": "2026-03-28T14:23:45.123Z",
        "timestampUnixMs": 1743170625123,
        "gps": {
            "latitude": 22.5726,
            "longitude": 88.3639,
            "altitude": 15.2,
            "accuracy": 3.5,
            "speed": 0.0,
            "heading": None
        },
        "accelerometer": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0,
            "magnitude": 0.0
        },
        "gyroscope": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
        },
        "light": {
            "lux": 1250.5
        },
        "barometer": {
            "pressure_hpa": 1013.2
        },
        "network": {
            "wifiRssi": -65,
            "cellularSignal": None,
            "connectionType": "wifi"
        },
        "device": {
            "model": "iPhone 15 Pro",
            "osVersion": "iOS 17.4",
            "batteryLevel": 0.82,
            "isCharging": False
        }
    }

    result = detector.analyze(fingerprint)

    assert result.is_suspicious is True
    assert any(f.type == "FLAT_ACCELEROMETER" for f in result.flags)
    flat_flag = next(f for f in result.flags if f.type == "FLAT_ACCELEROMETER")
    assert flat_flag.severity == "high"


def test_invalid_gps_latitude(detector):
    """Latitude outside -90 to 90 should trigger high severity"""
    fingerprint = {
        "timestampUtc": "2026-03-28T14:23:45.123Z",
        "timestampUnixMs": 1743170625123,
        "gps": {
            "latitude": 100.0,  # Invalid
            "longitude": 88.3639,
            "altitude": 15.2,
            "accuracy": 3.5,
            "speed": 0.0,
            "heading": None
        },
        "accelerometer": {
            "x": 0.12,
            "y": 9.78,
            "z": 0.34,
            "magnitude": 9.79
        },
        "gyroscope": {
            "x": 0.001,
            "y": -0.002,
            "z": 0.0
        },
        "light": {
            "lux": 1250.5
        },
        "barometer": {
            "pressure_hpa": 1013.2
        },
        "network": {
            "wifiRssi": -65,
            "cellularSignal": None,
            "connectionType": "wifi"
        },
        "device": {
            "model": "iPhone 15 Pro",
            "osVersion": "iOS 17.4",
            "batteryLevel": 0.82,
            "isCharging": False
        }
    }

    result = detector.analyze(fingerprint)
    assert any(f.type == "INVALID_GPS_LAT" for f in result.flags)
