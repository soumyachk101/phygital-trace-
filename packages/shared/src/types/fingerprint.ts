export interface PhysicalFingerprint {
  timestampUtc: string; // ISO 8601 with ms precision
  timestampUnixMs: number;
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number; // meters
    speed: number | null;
    heading: number | null;
  };
  accelerometer: {
    x: number;
    y: number;
    z: number;
    magnitude: number; // sqrt(x² + y² + z²)
  };
  gyroscope: {
    x: number;
    y: number;
    z: number;
  };
  light: {
    lux: number;
  };
  barometer: {
    pressure_hpa: number;
  };
  network: {
    wifiRssi: number | null;
    cellularSignal: number | null;
    connectionType: 'wifi' | 'cellular' | 'none';
  };
  device: {
    model: string;
    osVersion: string;
    batteryLevel: number; // 0-1
    isCharging: boolean;
  };
}

export interface FingerprintEntity {
  id: string;
  captureId: string;
  timestampUtc: string;
  timestampUnixMs: bigint;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsAltitude?: number | null;
  gpsAccuracy?: number | null;
  gpsSpeed?: number | null;
  gpsHeading?: number | null;
  accelX?: number | null;
  accelY?: number | null;
  accelZ?: number | null;
  accelMagnitude?: number | null;
  gyroX?: number | null;
  gyroY?: number | null;
  gyroZ?: number | null;
  lightLux?: number | null;
  pressureHpa?: number | null;
  wifiRssi?: number | null;
  cellularSignal?: number | null;
  connectionType?: string | null;
  deviceModel?: string | null;
  osVersion?: string | null;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
}
