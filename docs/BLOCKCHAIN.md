# BLOCKCHAIN.md — Phygital-Trace Smart Contract & Chain Integration

## Overview

Phygital-Trace uses **Base L2** (Ethereum L2 by Coinbase) for on-chain attestation. Base was chosen for:
- **~$0.00001 per tx** — practically free at scale
- **EVM-compatible** — standard Solidity + ethers.js
- **2-second finality** — fast enough for real-time UX
- **Mainnet security** — settles on Ethereum L1

---

## Smart Contract: `TruthAttestation.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TruthAttestation
 * @notice Records cryptographic proof that media was captured at a
 *         specific time and place. Does not store media — only hashes.
 * @dev Deployed on Base L2 (chainId: 8453)
 */
contract TruthAttestation is Ownable, Pausable {

    struct Attestation {
        bytes32 payloadHash;    // SHA-256(imageHash + fingerprintHash + timestampMs)
        bytes32 ipfsCid;        // IPFS CID encoded as bytes32
        address submitter;      // address that called attest()
        uint256 timestamp;      // block.timestamp at attestation
        bool isRevoked;
    }

    // payloadHash => Attestation
    mapping(bytes32 => Attestation) public attestations;

    // Trusted backend signers (multi-sig for decentralization later)
    mapping(address => bool) public trustedSubmitters;

    // ─── Events ───────────────────────────────────────────────────────────
    event AttestationCreated(
        bytes32 indexed payloadHash,
        bytes32 ipfsCid,
        address indexed submitter,
        uint256 timestamp
    );
    
    event AttestationRevoked(
        bytes32 indexed payloadHash,
        address revokedBy
    );
    
    event SubmitterUpdated(address submitter, bool trusted);

    // ─── Errors ───────────────────────────────────────────────────────────
    error AlreadyAttested(bytes32 payloadHash);
    error NotFound(bytes32 payloadHash);
    error Revoked(bytes32 payloadHash);
    error NotTrustedSubmitter();

    // ─── Modifiers ────────────────────────────────────────────────────────
    modifier onlyTrustedSubmitter() {
        if (!trustedSubmitters[msg.sender]) revert NotTrustedSubmitter();
        _;
    }

    constructor(address initialSubmitter) Ownable(msg.sender) {
        trustedSubmitters[initialSubmitter] = true;
    }

    // ─── Core Functions ───────────────────────────────────────────────────

    /**
     * @notice Record a new attestation on-chain
     * @param payloadHash SHA-256 hash of (imageHash + fingerprintHash + timestampMs)
     * @param ipfsCid IPFS CID of the full TruthCertificate metadata JSON
     */
    function attest(
        bytes32 payloadHash,
        bytes32 ipfsCid
    ) external onlyTrustedSubmitter whenNotPaused {
        if (attestations[payloadHash].timestamp != 0) {
            revert AlreadyAttested(payloadHash);
        }

        attestations[payloadHash] = Attestation({
            payloadHash: payloadHash,
            ipfsCid: ipfsCid,
            submitter: msg.sender,
            timestamp: block.timestamp,
            isRevoked: false
        });

        emit AttestationCreated(payloadHash, ipfsCid, msg.sender, block.timestamp);
    }

    /**
     * @notice Batch attest multiple hashes in one tx (gas efficient)
     */
    function attestBatch(
        bytes32[] calldata payloadHashes,
        bytes32[] calldata ipfsCids
    ) external onlyTrustedSubmitter whenNotPaused {
        require(payloadHashes.length == ipfsCids.length, "Length mismatch");
        require(payloadHashes.length <= 100, "Max 100 per batch");

        for (uint i = 0; i < payloadHashes.length; i++) {
            if (attestations[payloadHashes[i]].timestamp == 0) {
                attestations[payloadHashes[i]] = Attestation({
                    payloadHash: payloadHashes[i],
                    ipfsCid: ipfsCids[i],
                    submitter: msg.sender,
                    timestamp: block.timestamp,
                    isRevoked: false
                });
                emit AttestationCreated(payloadHashes[i], ipfsCids[i], msg.sender, block.timestamp);
            }
        }
    }

    /**
     * @notice Verify a payload hash — returns full attestation data
     */
    function verify(bytes32 payloadHash)
        external view
        returns (Attestation memory)
    {
        Attestation memory att = attestations[payloadHash];
        if (att.timestamp == 0) revert NotFound(payloadHash);
        return att;
    }

    /**
     * @notice Check if a hash is attested (simple boolean)
     */
    function isAttested(bytes32 payloadHash) external view returns (bool) {
        return attestations[payloadHash].timestamp != 0 &&
               !attestations[payloadHash].isRevoked;
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function revoke(bytes32 payloadHash) external onlyOwner {
        if (attestations[payloadHash].timestamp == 0) revert NotFound(payloadHash);
        attestations[payloadHash].isRevoked = true;
        emit AttestationRevoked(payloadHash, msg.sender);
    }

    function setSubmitter(address submitter, bool trusted) external onlyOwner {
        trustedSubmitters[submitter] = trusted;
        emit SubmitterUpdated(submitter, trusted);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

---

## Deployment

### Network Config
```typescript
// packages/contracts/hardhat.config.ts
networks: {
  base: {
    url: process.env.BASE_RPC_URL,  // https://mainnet.base.org
    accounts: [process.env.PRIVATE_KEY_DEPLOYER],
    chainId: 8453,
  },
  "base-sepolia": {
    url: "https://sepolia.base.org",
    accounts: [process.env.PRIVATE_KEY_DEPLOYER],
    chainId: 84532,
  }
}
```

### Deploy Command
```bash
pnpm --filter contracts deploy:base-sepolia   # testnet
pnpm --filter contracts deploy:base           # mainnet
```

---

## Backend Integration (`blockchain.service.ts`)

```typescript
import { ethers } from 'ethers';
import TruthAttestationABI from '../contracts/TruthAttestation.json';

export class BlockchainService {
  private contract: ethers.Contract;

  constructor() {
    const provider = new ethers.JsonRpcProvider(env.BASE_RPC_URL);
    const signer = new ethers.Wallet(env.PRIVATE_KEY_SIGNER, provider);
    this.contract = new ethers.Contract(
      env.ATTESTATION_CONTRACT_ADDRESS,
      TruthAttestationABI,
      signer
    );
  }

  async attest(payloadHash: string, ipfsCid: string): Promise<{
    txHash: string;
    blockNumber: number;
  }> {
    const payloadHashBytes = ethers.hexlify(
      ethers.toUtf8Bytes(payloadHash)  // or use Buffer.from(hash, 'hex')
    );
    const ipfsCidBytes32 = cidToBytes32(ipfsCid);

    const tx = await this.contract.attest(payloadHashBytes, ipfsCidBytes32);
    const receipt = await tx.wait(1);  // 1 confirmation

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  async verify(payloadHash: string) {
    return await this.contract.verify(payloadHash);
  }

  async isAttested(payloadHash: string): Promise<boolean> {
    return await this.contract.isAttested(payloadHash);
  }
}
```

---

## Gas Abstraction (ERC-4337 Paymaster)

So users pay $0 gas:

```typescript
// Using Alchemy Account Kit on Base
import { createSmartAccountClient } from "@alchemy/aa-core";
import { alchemyPaymasterAndDataMiddleware } from "@alchemy/aa-alchemy";

// Backend sponsors all gas via Alchemy Paymaster API
// Budget: ~$5/month covers 500,000 attestations at Base L2 prices
```

---

## Verification URL Flow

```
User shares: https://phygitaltrace.app/verify/abc123xyz

Verification page:
1. GET /api/v1/verify/abc123xyz → DB lookup (cached)
2. Returns: { ipfsCid, payloadHash, status, fingerprint, anomalyStatus }
3. Frontend independently queries Base L2:
   contract.isAttested(payloadHash) → true/false
4. Frontend fetches IPFS metadata:
   https://gateway.pinata.cloud/ipfs/{ipfsCid}
5. Renders TruthCertificate with ✅ VERIFIED badge
```

---

## IPFS CID ↔ bytes32 Conversion

```typescript
import { CID } from 'multiformats/cid';

export function cidToBytes32(cid: string): string {
  const decoded = CID.parse(cid);
  const bytes = decoded.multihash.digest;
  return '0x' + Buffer.from(bytes).toString('hex').padStart(64, '0');
}

export function bytes32ToCid(bytes32: string): string {
  // Reverse the above
}
```

---

## Estimated Costs

| Action | Gas (est.) | Cost (Base L2) |
|--------|-----------|----------------|
| Single `attest()` | 45,000 gas | ~$0.000045 |
| Batch 100 attestations | 200,000 gas | ~$0.0002 |
| Monthly (10k captures) | 450M gas | ~$0.45/month |

Base L2 is essentially free for this use case.
