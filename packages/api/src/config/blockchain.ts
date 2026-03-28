import { ethers } from 'ethers';
import { env } from './env';
import TruthAttestationABI from '../../contracts/artifacts/contracts/TruthAttestation.sol/TruthAttestation.json';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

let provider: ethers.JsonRpcProvider;
let signer: ethers.Wallet;
let contract: ethers.Contract;

export function initBlockchain(): void {
  provider = new ethers.JsonRpcProvider(env.BASE_RPC_URL);
  signer = new ethers.Wallet(env.PRIVATE_KEY_SIGNER, provider);
  contract = new ethers.Contract(
    env.ATTESTATION_CONTRACT_ADDRESS,
    TruthAttestationABI.abi,
    signer
  );
  console.log('✅ Blockchain initialized on network:', (await provider.getNetwork()).name);
}

export function getContract(): ethers.Contract {
  if (!contract) {
    throw new Error('Blockchain not initialized. Call initBlockchain() first.');
  }
  return contract;
}

export function getProvider(): ethers.JsonRpcProvider {
  return provider;
}

export function getSigner(): ethers.Wallet {
  return signer;
}

export type { ethers };
