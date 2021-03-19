import 'dotenv/config'

export const CKB_NODE_URL = process.env.CKB_NODE_URL!


export const NODE_ENV: string = process.env.NODE_ENV ? process.env.NODE_ENV : 'production'

export const POOL_URL: string = process.env.POOL_URL!

export const MNEMONIC: string = process.env.MNEMONIC!

export const COOPERATOR_PRIVATE_KEY: string = process.env.COOPERATOR_PRIVATE_KEY!
export const COOPERATOR_FROM_BLOCK = process.env.COOPERATOR_FROM_BLOCK?process.env.COOPERATOR_FROM_BLOCK:'0x00'

export const SECP256K1_TX_HASH = '0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37'
export const SECP256K1_TX_INDEX = '0x0'
export const SECP256K1_CODE_HASH = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'
export const SECP256K1_HASH_TYPE = 'type'


export const INDEXER_MYSQL_URL = process.env.INDEXER_MYSQL_URL!
export const INDEXER_MYSQL_URL_PORT: number = parseInt(process.env.INDEXER_MYSQL_URL_PORT!)
export const INDEXER_MYSQL_USERNAME = process.env.INDEXER_MYSQL_USERNAME!
export const INDEXER_MYSQL_PASSWORD = process.env.INDEXER_MYSQL_PASSWORD!
export const INDEXER_MYSQL_DATABASE = process.env.INDEXER_MYSQL_DATABASE!

export const BLOCK_MINER_FEE = process.env.BLOCK_MINER_FEE ? BigInt(process.env.BLOCK_MINER_FEE) : 100000n

export const WORKER_TRANSFER_BALANCE = process.env.WORKER_TRANSFER_BALANCE ? BigInt(process.env.WORKER_TRANSFER_BALANCE) : 61n * 100000000n
