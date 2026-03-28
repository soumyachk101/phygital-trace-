'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { ExternalLink, LinkIcon, FileText } from 'lucide-react';
import type { VerificationResponse } from '@phygital-trace/shared';

interface Props {
  data: VerificationResponse;
}

export function BlockchainProof({ data }: Props) {
  const {
    blockchain,
    verificationUrl
  } = data;

  const explorerUrl = blockchain.txHash
    ? `${blockchain.explorerUrl}${blockchain.txHash}`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Blockchain Proof
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="text-gray-600 dark:text-gray-300">Network</span>
          <span className="text-right font-mono">{blockchain.chain}</span>

          <span className="text-gray-600 dark:text-gray-300">Chain ID</span>
          <span className="text-right font-mono">{blockchain.chainId}</span>

          <span className="text-gray-600 dark:text-gray-300">Contract</span>
          <span className="text-right font-mono text-xs break-all">
            {blockchain.contractAddress.slice(0, 10)}...
          </span>

          <span className="text-gray-600 dark:text-gray-300">Block</span>
          <span className="text-right font-mono">
            {blockchain.blockNumber?.toLocaleString() || '—'}
          </span>

          <span className="text-gray-600 dark:text-gray-300">Transaction</span>
          <span className="text-right">
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-mono text-gray-500">—</span>
            )}
          </span>
        </div>

        <div className="border-t pt-4">
          <p className="text-gray-600 dark:text-gray-300 mb-2">Verification</p>
          <a
            href={verificationUrl}
            className="inline-flex items-center gap-2 text-blue-600 hover:underline break-all"
          >
            <LinkIcon className="h-3 w-3" />
            <span>{verificationUrl}</span>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
