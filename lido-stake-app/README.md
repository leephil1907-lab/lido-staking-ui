# Lido Stake App

This is the frontend UI for Lido liquid staking (lido-stake-app). It includes a minimal Vite setup and a simple UI that integrates with Reown AppKit and Ethers for wallet connections and interactions with the Lido contract.

## Quickstart

1. Install dependencies:

   npm install

2. Run the dev server:

   npm run dev

3. Open http://localhost:3000

## Notes

- The app dynamically imports libraries from CDN (ethers, @reown/appkit). Ensure network connectivity.
- Double-check the PROJECT_ID and contract addresses before using on mainnet.
- Do not commit secrets (private keys or private project IDs) to the repository.
