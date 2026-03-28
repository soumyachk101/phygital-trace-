'use client';

import { notFound } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { VerifierLayout } from '@/app/components/VerifierLayout';
import { TruthCard } from '@/app/components/TruthCard';
import { BlockchainProof } from '@/app/components/BlockchainProof';
import { FingerprintMap } from '@/app/components/FingerprintMap';
import { SensorDataPanel } from '@/app/components/SensorDataPanel';
import { VerificationBadge } from '@/app/components/VerificationBadge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { VerificationResponse } from '@phygital-trace/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PageProps {
  params: Promise<{ shortCode: string }>;
}

async function fetchVerification(shortCode: string): Promise<VerificationResponse> {
  const res = await fetch(`${API_URL}/api/v1/verify/${shortCode}`, {
    next: { revalidate: 300 } // Cache for 5 minutes
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('NOT_FOUND');
    }
    throw new Error('Failed to fetch verification');
  }

  return res.json();
}

export default async function VerifyPage({ params }: PageProps) {
  const { shortCode } = await params;
  const { data, error, isLoading } = useQuery<VerificationResponse>({
    queryKey: ['verification', shortCode],
    queryFn: () => fetchVerification(shortCode),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false
  });

  if (isLoading) {
    return (
      <VerifierLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Verifying certificate...</p>
          </div>
        </div>
      </VerifierLayout>
    );
  }

  if (error || !data) {
    return (
      <VerifierLayout>
        <div className="max-w-2xl mx-auto">
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription>
              Certificate not found or invalid short code: &quot;{shortCode}&quot;
            </AlertDescription>
          </Alert>

          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Please check the short code and try again.
            </p>
            <a
              href="/"
              className="text-blue-600 hover:underline"
            >
              Return to home page
            </a>
          </div>
        </div>
      </VerifierLayout>
    );
  }

  return (
    <VerifierLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Verification Result
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Certificate ID: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">{shortCode}</code>
          </p>
        </div>

        {/* Badge */}
        <div className="mb-6 flex justify-center">
          <VerificationBadge badge={data.verificationBadge} size="lg" />
        </div>

        {/* Warning for suspicious certificates */}
        {data.anomaly.status === 'SUSPICIOUS' || data.anomaly.status === 'HIGH_RISK' ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription>
              <strong>Warning:</strong> This certificate has anomaly flags. Review the sensor data carefully.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            <TruthCard data={data} />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            <BlockchainProof data={data} />
            <FingerprintMap data={data} />
            <SensorDataPanel data={data} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t pt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            This verification page is hosted by Phygital-Trace. The certificate data
            is publicly verifiable on the Base L2 blockchain.
          </p>
          <p className="mt-2">
            For more information, see{' '}
            <a href="/docs" className="text-blue-600 hover:underline">
              documentation
            </a>
            .
          </p>
        </div>
      </div>
    </VerifierLayout>
  );
}
