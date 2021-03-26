# Glia Swap Matcher

## Glia Swap Matcher is used to match Glia Swap requiests on CKB network, e.g. mainnet Lina and testnet Aggron

## Kick Up

### yarn install

### yarn run start

## Before Kick Up

### Config

There is a template .env example named cooperator.env.example under the root of repository.

You need a .env config to support necessary information.

By the way, Glia Swap Matcher uses 'dotenv' to collect information, you can deliver config by supported way of 'dotenv'.
You can use DOTENV_CONFIG_PATH to point to your config .env file.

### Why We need Glia Swap Matcher?

Glia Swap Matcher is a matcher for Glia Swap on CKB network.

Why we need an additional matcher on CKB network, unlike uniswap on Ethereum?

Because CKB network uses 'cell' model, which is a deterministic state transformation and AMM need slippage to tolerate
undeterministic, to relieve users' time, user send a Glia Swap request onto CKB network and a matcher runs beside to
watch the status and do match job once the condition inside of request fits. Therefore, users can free their hands.

### Architect

This matcher adopts cooperator-worker mode. There is a main process call cooperator. Its job is to fetch pool
information from Glia Dex Server regularly and prepare and kick up workers. It will manage worker sub-processes by
latest pool information automatically.

There are many sub-processes for each pair listed in pool information. The worker handles all requests sent by users,
including initialization liquidity, add liquidity, remove liquidity, swap-buy and swap-sell. It at intervals query the
CKB network via Lumos and make progress.

Lumos is an advanced tool-set to query and collect cell on CKB network. It integrates Indexer, thus you need not contact
to Indexer by yourself. Besides, Lumos can leverage MySql instead of Rocksdb to get better performance.

### Config Details

Please refer cooperator.env.example to get more details

Note:

- You need enough CKB on cooperator address. You can use ckb-cli to generate an account and input the private via
  Environment. You can use faucet of Aggron testnet to get CKB and buy CKB or somehow get CKB to the account.

- Cooperator will transfer WORKER_TRANSFER_BALANCE to worker's matcher change cell if the change cell does not exist.
  You **have** to watch the CKB balance of matcher change cell by yourself and keep the balance enough for matching.
  
- CKB's scripts are referred by codehash and hashtype. And for CKB-VM of CKB network to locate the script, you also
need to provide the outpoint of cell containing the script code. Please refer CKB's manual to get more details.
  

### Data Structure Introduction

You can check data structures of works under ckb2sudt/modules/models for ckb<>SUDT pair and
sudt2sudt/modules/models for SUDT<>SUDT pair.

Here is a brief view:

Info cell: contains all information of an AMM pool.
Pool cell: contains ckb and SUDT reserves. ckb2sudt pair has one pool to hold CKB in capacity and SUDT in cell data, and sudt2sudt has 2 pools for each SUDT.
Liquidity request cell: contains liquidity request information. Like init, add and remove for liquidity.
Swap request cell: contains swap request information. Like buy and sell CKB/SUDT.
Matcher change cell: the cell matcher uses to get tips from users' requests.
SUDT cell: the SUDT the requests output.E.g., hold LP tokens for adding liquidity and SUDT tokens for swap.
Ckb cell: contains CKB change for requests, like SUDT cell. It may contain request outputs or request change.
