import { ethers } from 'hardhat';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log('Deploying contract with account:', signer.address);

  const initialSubmitter = process.env.PRIVATE_KEY_SIGNER
    ? ethers.Wallet.fromMnemonic(process.env.PRIVATE_KEY_SIGNER).address
    : signer.address;

  console.log('Initial trusted submitter:', initialSubmitter);

  const TruthAttestation = await ethers.getContractFactory('TruthAttestation');
  const contract = await TruthAttestation.deploy(initialSubmitter);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('✅ TruthAttestation deployed to:', address);
  console.log('📝 Network:', (await ethers.provider.getNetwork()).name);
  console.log('');
  console.log('Add to your .env:');
  console.log(`ATTESTATION_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
