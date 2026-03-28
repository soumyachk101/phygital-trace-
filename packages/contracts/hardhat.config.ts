import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545'
    },
    'base-sepolia': {
      url: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
      accounts:
        process.env.PRIVATE_KEY_DEPLOYER ? [process.env.PRIVATE_KEY_DEPLOYER] : [],
      chainId: 84532,
      gasPrice: 2000000000 // 2 gwei (Base Sepolia)
    },
    base: {
      url: 'https://mainnet.base.org',
      accounts:
        process.env.PRIVATE_KEY_DEPLOYER ? [process.env.PRIVATE_KEY_DEPLOYER] : [],
      chainId: 8453,
      gasPrice: 1000000000 // 1 gwei (Base mainnet)
    }
  },
  etherscan: {
    apiKey: {
      'base-sepolia': process.env.BASE_SEPOLIA_EXPLORER_API_KEY || '',
      base: process.env.BASE_EXPLORER_API_KEY || ''
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD'
  }
};

export default config;
