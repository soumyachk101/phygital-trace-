import { ethers } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { env } from '../config/blockchain';
import { logger } from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/errors';
import { cidToBytes32 } from '../utils/crypto';

dotenvConfig();

// Minimal ABI for our contract
const TRUTH_ATTESTATION_ABI = [
  'function attest(bytes32 payloadHash, bytes32 ipfsCid) external returns (bytes32)',
  'function attestBatch(bytes32[] payloadHashes, bytes32[] ipfsCids) external',
  'function verify(bytes32 payloadHash) external view returns (tuple(bytes32 payloadHash, bytes32 ipfsCid, address submitter, uint256 timestamp, bool isRevoked))',
  'function isAttested(bytes32 payloadHash) external view returns (bool)',
  'function trustedSubmitters(address) external view returns (bool)',
  'event AttestationCreated(bytes32 indexed payloadHash, bytes32 ipfsCid, address indexed submitter, uint256 timestamp)',
  'event AttestationRevoked(bytes32 indexed payloadHash, address revokedBy)'
];

export class BlockchainService {
  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor() {
    this.signer = new ethers.Wallet(env.PRIVATE_KEY_SIGNER, env.BASE_RPC_URL);
    this.contract = new ethers.Contract(
      env.ATTESTATION_CONTRACT_ADDRESS,
      TRUTH_ATTESTATION_ABI,
      this.signer
    );
    logger.info('Blockchain service initialized', {
      contract: env.ATTESTATION_CONTRACT_ADDRESS,
      network: (async () => (await this.signer.provider?.getNetwork()).name)()
    });
  }

  /**
   * Attest a single payload hash with IPFS CID
   */
  async attest(payloadHash: string, ipfsCid: string): Promise<{
    txHash: string;
    blockNumber: number;
  }> {
    try {
      const payloadBytes = this.toBytes32(payloadHash);
      const ipfsBytes = cidToBytes32(ipfsCid);

      logger.debug('Calling contract.attest', { payloadHash, ipfsCid });

      const tx = await this.contract.attest(payloadBytes, ipfsBytes);
      logger.debug('Transaction sent', { txHash: tx.hash });

      const receipt = await tx.wait(1); // Wait for 1 confirmation

      logger.info('Attestation confirmed', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      });

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber)
      };
    } catch (error: any) {
      logger.error('Blockchain attestation failed', { error, payloadHash, ipfsCid });

      // Parse revert reasons
      const errorMessage = error.message || 'Unknown blockchain error';
      if (errorMessage.includes('AlreadyAttested')) {
        throw new ApiError(409, 'ALREADY_ATTESTED', 'This capture has already been attested');
      }
      if (errorMessage.includes('NotTrustedSubmitter')) {
        throw new ApiError(403, 'NOT_TRUSTED_SUBMITTER', 'Backend is not a trusted submitter');
      }
      if (errorMessage.includes('Pausable: paused')) {
        throw new ApiError(503, 'CONTRACT_PAUSED', 'Contract is currently paused');
      }

      throw new ApiError(502, ERROR_CODES.BLOCKCHAIN_ERROR, 'Blockchain transaction failed');
    }
  }

  /**
   * Batch attest (up to 100)
   */
  async attestBatch(payloadHashes: string[], ipfsCids: string[]): Promise<{
    txHash: string;
    blockNumber: number;
  }> {
    if (payloadHashes.length !== ipfsCids.length) {
      throw new Error('payloadHashes and ipfsCids length mismatch');
    }
    if (payloadHashes.length > 100) {
      throw new Error('Batch size exceeds maximum of 100');
    }

    const payloadBytes = payloadHashes.map(h => this.toBytes32(h));
    const ipfsBytes = ipfsCids.map(c => cidToBytes32(c));

    const tx = await this.contract.attestBatch(payloadBytes, ipfsBytes);
    const receipt = await tx.wait(1);

    return {
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber)
    };
  }

  /**
   * Verify a payload hash on-chain
   */
  async verify(payloadHash: string): Promise<{
    payloadHash: string;
    ipfsCid: string;
    submitter: string;
    timestamp: number;
    isRevoked: boolean;
  }> {
    const payloadBytes = this.toBytes32(payloadHash);
    const result = await this.contract.verify(payloadBytes);

    return {
      payloadHash,
      ipfsCid: this.fromBytes32(result.ipfsCid),
      submitter: result.submitter,
      timestamp: Number(result.timestamp),
      isRevoked: result.isRevoked
    };
  }

  /**
   * Check if a payload hash is attested
   */
  async isAttested(payloadHash: string): Promise<boolean> {
    const payloadBytes = this.toBytes32(payloadHash);
    return await this.contract.isAttested(payloadBytes);
  }

  /**
   * Convert string hash to bytes32
   */
  private toBytes32(hash: string): string {
    if (hash.startsWith('0x')) {
      hash = hash.substring(2);
    }
    // Pad or truncate to 64 hex chars (32 bytes)
    const padded = hash.padStart(64, '0').slice(0, 64);
    return '0x' + padded;
  }

  /**
   * Convert bytes32 from contract to string
   */
  private fromBytes32(bytes32: string): string {
    if (bytes32.startsWith('0x')) {
      bytes32 = bytes32.substring(2);
    }
    // Trim leading zeros to get original hex
    return '0x' + bytes32.replace(/^0+/, '');
  }
}

export const blockchainService = new BlockchainService();
