# Flappy Bird DApp on Polkadot Asset Hub

Flappy Bird game implemented as a Decentralized Application (DApp)

## Overview

It allows users to play the classic Flappy Bird game and store their high scores directly on the blockchain.

## Technology

- **Blockchain:** Polkadot's Westend Asset Hub (Testnet)
- **Smart Contract:** An EVM-compatible contract deployed on the Asset Hub handles score storage and retrieval.
  - **Contract Address:** `0x350108263CAf6D6b3fa9c557A12dda510FA64A15`
- **Frontend:** Built with HTML, CSS, and JavaScript.
- **Web3 Interaction:** Uses `ethers.js` to connect to the user's wallet (e.g., MetaMask) and interact with the smart contract.

## How it Works

1.  **Connect Wallet:** Users connect their EVM-compatible wallet configured for the Westend Asset Hub testnet.
2.  **Play Game:** Users play the Flappy Bird game.
3.  **Submit Score:** Upon game over, if the user's score is higher than their previously recorded score on the blockchain, the DApp prompts them to submit a transaction to the smart contract via their wallet.
4.  **On-Chain Storage:** The smart contract receives the score and updates the user's record.
5.  **Leaderboard:** The DApp fetches score data from the contract to display a leaderboard.

## Why Polkadot Asset Hub?

Using Polkadot's Asset Hub allows leveraging the security and interoperability of the Polkadot ecosystem while providing an EVM-compatible environment for smart contracts. This makes it easy to deploy standard Solidity contracts (like the one used here) and interact with them using familiar tools like `ethers.js`, bridging the gap between the Ethereum development experience and the Polkadot network.

## Running the DApp

1.  Ensure you have an EVM-compatible browser wallet (like MetaMask).
2.  Add the Westend Asset Hub testnet to your wallet:
    *   Network Name: `Westend Asset Hub`
    *   RPC URL: `https://westend-asset-hub-eth-rpc.polkadot.io`
    *   Chain ID: `420420421`
    *   Currency Symbol: `WND`
    *   Block Explorer URL: `https://blockscout-asset-hub.parity-chains-scw.parity.io/`
3.  Obtain some testnet WND tokens (if needed for transaction fees).
4.  Open the `index.html` file in your browser.
5.  Connect your wallet when prompted.
6.  Play the game!
