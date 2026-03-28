'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { VerificationBadge } from './VerificationBadge';
import { Calendar, Clock, Hash } from 'lucide-react';
import type { VerificationResponse } from '@phygital-trace/shared';

interface Props {
  data: VerificationResponse;
}

export function TruthCard({ data }: Props) {
  const captured = new Date(data.capturedAt);
  const attested = data.attestedAt ? new Date(data.attestedAt) : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>TruthCertificate</span>
            </CardTitle>
            <p className="text-blue-100 text-sm mt-1">
              Blockchain-Verified Proof of Reality
            </p>
          </div>
          <VerificationBadge badge={data.verificationBadge} size="lg" />
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Thumbnail */}
        {data.ipfs.thumbnailUrl && (
          <div className="flex justify-center">
            <div className="relative w-full max-w-sm aspect-square rounded-lg overflow-hidden border">
              <Image
                src={data.ipfs.thumbnailUrl}
                alt="Captured media"
                fill
                className="object-cover"
                unoptimized // IPFS images
              />
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <Calendar className="h-4 w-4" />
            <span>Captured:</span>
          </div>
          <div className="text-right font-mono text-xs md:text-sm">
            {captured.toLocaleString()}
          </div>

          {attested && (
            <>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <Clock className="h-4 w-4" />
                <span>Attested:</span>
              </div>
              <div className="text-right font-mono text-xs md:text-sm">
                {attested.toLocaleString()}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <Hash className="h-4 w-4" />
            <span>Short Code:</span>
          </div>
          <div className="text-right">
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono">
              {data.captureId.slice(0, 8)}...
            </code>
          </div>
        </div>

        {/* Verification URL */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">Verification URL</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 break-all font-mono">
            {process.env.NEXT_PUBLIC_APP_URL}/verify/{data.captureId.slice(0, 8).toLowerCase()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
