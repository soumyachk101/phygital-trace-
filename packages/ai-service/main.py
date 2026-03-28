"""
Phygital-Trace AI Anomaly Detection Service

Analyzes PhysicalFingerprint data to detect potential spoofing or manipulation.
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
import time

from detector import AnomalyDetector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Phygital-Trace AI Service",
    description="Anomaly detection for physical fingerprint data",
    version="0.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detector
detector = AnomalyDetector()


class PhysicalFingerprint(BaseModel):
    """Physical fingerprint model matching the mobile app structure"""
    timestampUtc: str
    timestampUnixMs: int
    gps: dict
    accelerometer: dict
    gyroscope: dict
    light: dict
    barometer: dict
    network: dict
    device: dict


class AnomalyFlag(BaseModel):
    type: str
    severity: str = Field(..., pattern="^(low|medium|high)$")
    message: str


class AnomalyResult(BaseModel):
    is_suspicious: bool
    confidence: float = Field(..., ge=0.0, le=1.0)
    flags: List[AnomalyFlag]
    risk_level: str = Field(..., pattern="^(low|medium|high)$")


class AnalyzeRequest(BaseModel):
    fingerprint: PhysicalFingerprint


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}


@app.post("/analyze", response_model=AnomalyResult)
async def analyze_fingerprint(request: AnalyzeRequest):
    """
    Analyze a physical fingerprint for anomalies.

    Returns an anomaly assessment with flags if suspicious patterns detected.
    """
    try:
        logger.info("Analyzing fingerprint", extra={
            "timestamp": request.fingerprint.timestampUtc,
            "has_gps": bool(request.fingerprint.gps.get("latitude"))
        })

        result = detector.analyze(request.fingerprint.model_dump())

        logger.info("Analysis complete", extra={
            "is_suspicious": result.is_suspicious,
            "risk_level": result.risk_level,
            "flags_count": len(result.flags)
        })

        return result
    except Exception as e:
        logger.error("Analysis error", exc_info=True)
        raise HTTPException(status_code=500, detail="Analysis failed")


@app.get("/")
async def root():
    return {
        "service": "phygital-trace-ai",
        "version": "0.1.0",
        "endpoints": ["/analyze", "/health"]
    }
