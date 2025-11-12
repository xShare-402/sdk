# xShare-402 SDK

A lightweight SDK to interact with the **xShare402's Ad Network** on Solana.

It allows anyone to create, list, bid, and delete ads directly from JavaScript, by calling an x402 server.

---

## Installation

```bash
npm install @xshare-402/sdk
````

## Methods

### `myAds({ loadMetadatas?: boolean })`

Fetches all ads owned by the connected wallet. Optionally loads full metadata for each ad.

### `createAd({ metadata })`

Creates a new ad on-chain, with attached metadata hosted on Arweave or any other data gateway.

### `deleteAd({ ad })`

Deletes an existing ad owned by the wallet.

### `billboards({ currency?: string | null })`

Lists all available billboard spaces where ads can be placed.

### `bidOnBillboard({ billboard, ad, budget, maxViewsPerDay })`

Places a bid for a specific ad on a selected billboard.
