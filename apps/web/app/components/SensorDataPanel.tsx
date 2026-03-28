'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Activity, Gauge, Thermometer, Wifi, Cpu, Zap } from 'lucide-react';
import type { VerificationResponse } from '@phygital-trace/shared';

interface Props {
  data: VerificationResponse;
}

export function SensorDataPanel({ data }: Props) {
  const { fingerprint } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Sensor Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Accelerometer */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Accelerometer (m/s²)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-center">
                <p className="text-gray-500">X</p>
                <p className="font-mono">
                  {fingerprint.sensors.accelerometer?.includes('X:')
                    ? fingerprint.sensors.accelerometer.split('X:')[1]?.split(' ')[0]?.trim() || 'N/A'
                    : 'N/A'}
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-center">
                <p className="text-gray-500">Y</p>
                <p className="font-mono">
                  {fingerprint.sensors.accelerometer?.includes('Y:')
                    ? fingerprint.sensors.accelerometer.split('Y:')[1]?.split(' ')[0]?.trim() || 'N/A'
                    : 'N/A'}
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-center">
                <p className="text-gray-500">Z</p>
                <p className="font-mono">
                  {fingerprint.sensors.accelerometer?.includes('Z:')
                    ? fingerprint.sensors.accelerometer.split('Z:')[1]?.split(' ')[0]?.trim() || 'N/A'
                    : 'N/A'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Magnitude: {fingerprint.sensors.accelerometer}
            </p>
          </div>

          {/* Gyroscope */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Gyroscope
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 font-mono">
              Values not available in simplified view
            </p>
          </div>

          {/* Light & Pressure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Light
              </h4>
              <p className="text-sm font-mono">{fingerprint.sensors.light}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Pressure
              </h4>
              <p className="text-sm font-mono">{fingerprint.sensors.pressure}</p>
            </div>
          </div>

          {/* Device Info */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">Device</h4>
            <p className="text-sm">{fingerprint.device}</p>
            <p className="text-xs text-gray-500 mt-1">
              Captured: {new Date(fingerprint.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Anomaly Status */}
          {data.anomaly.flags.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                Anomalies Detected
              </h4>
              <ul className="space-y-1">
                {data.anomaly.flags.map((flag, idx) => (
                  <li key={idx} className="text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
