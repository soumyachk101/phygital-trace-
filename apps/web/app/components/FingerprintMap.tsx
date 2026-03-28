'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { MapPin, Navigation } from 'lucide-react';
import type { VerificationResponse } from '@phygital-trace/shared';

// Dynamically import Leaflet to avoid SSR issues
const Map = dynamic(() => import('@/app/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
  )
});

interface Props {
  data: VerificationResponse;
}

export function FingerprintMap({ data }: Props) {
  const { latitude, longitude, accuracy } = data.fingerprint.location;

  // Don't render if no coordinates
  if (!latitude || !longitude) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Map
            center={[latitude, longitude]}
            zoom={16}
            markers={[{ lat: latitude, lng: longitude, label: 'Capture Location' }]}
            className="h-64 rounded-lg border"
          />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-300">Latitude</p>
              <p className="font-mono">{latitude.toFixed(6)}°</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300">Longitude</p>
              <p className="font-mono">{longitude.toFixed(6)}°</p>
            </div>
            {accuracy && (
              <div className="col-span-2">
                <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Accuracy: {accuracy}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
