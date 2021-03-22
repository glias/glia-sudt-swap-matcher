import {logger} from './utils/cooperatorLogger'
import {
    BLOCK_MINER_FEE,
    CKB_NODE_URL,
    COOPERATOR_FROM_BLOCK,
    COOPERATOR_PRIVATE_KEY, DERIVE_RANDOM,
    INDEXER_MYSQL_DATABASE,
    INDEXER_MYSQL_PASSWORD,
    INDEXER_MYSQL_URL,
    INDEXER_MYSQL_URL_PORT,
    INDEXER_MYSQL_USERNAME,
    MNEMONIC,
    POOL_URL,
    SECP256K1_CODE_HASH,
    SECP256K1_HASH_TYPE,
    SECP256K1_TX_HASH,
    SECP256K1_TX_INDEX, WORKER_TRANSFER_BALANCE
} from './utils/cooperatorEnv'
// @ts-ignore
import axios from 'axios'
import {ChildProcess, fork} from "child_process";
import path from 'path'
import {AccountExtendedPublicKey, Keychain, mnemonic} from '@ckb-lumos/hd'
import {blake160, privateKeyToPublicKey} from "@nervosnetwork/ckb-sdk-utils";
import {CellCollector} from "@ckb-lumos/sql-indexer";
import {Cell, QueryOptions, Script} from "@ckb-lumos/base";
import {scriptCamelToSnake, scriptSnakeToCamel, Uint64BigIntToHex} from "./utils/tools";
import CKB from "@nervosnetwork/ckb-sdk-core";
import JSONbig from "json-bigint";
import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import knex from 'knex'

type WorkType = Record<'xTypeArg' | 'xTypeHash' | 'xSymbol' | 'yTypeArg' | 'yTypeHash' | 'ySymbol', string>

export default class Cooperator {
    #ckb: CKB
    #client: Rpc
    #knex: knex


    // @ts-ignore
    #mnemonic: string
    // @ts-ignore
    #poolUrl: string

    // identity -> ChildProcess
    #processPool: Map<string, ChildProcess> = new Map<string, ChildProcess>();

    // @ts-ignore
    #info = (msg: string) => {
        logger.info(`Cooperator: ${msg}`)
    }

    // @ts-ignore
    #error = (msg: string) => {
        logger.error(`Cooperator: ${msg}`)
    }

    constructor() {
        this.#ckb = new CKB(CKB_NODE_URL)
        this.#client = new Rpc(CKB_NODE_URL)
        this.#mnemonic = MNEMONIC
        this.#poolUrl = POOL_URL
        this.#knex = knex({
            client: 'mysql',
            connection: {
                host: INDEXER_MYSQL_URL,
                port: INDEXER_MYSQL_URL_PORT,
                user: INDEXER_MYSQL_USERNAME,
                password: INDEXER_MYSQL_PASSWORD,
                database: INDEXER_MYSQL_DATABASE,
            },
        })
    }

    #sleep = function (time: number) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }

    run = async () => {
        while (true) {
            try {
                let res = await axios.post(this.#poolUrl)
                let poolInfos: Array<any> = res['data']
                let identities: Map<string, WorkType> = new Map<string, WorkType>();

                //let identities : Map<string,[string,string,string,string,string,string]>= new Map<string, [string,string,string,string,string,string]>();
                for (let poolInfo of poolInfos) {
                    let sudtXTypeArgs: string
                    let sudtXTypeHash = poolInfo['assets'][0]['typeHash']
                    let sudtXSymbol: string
                    let sudtYTypeArgs: string
                    let sudtYTypeHash = poolInfo['assets'][1]['typeHash']
                    let sudtYSymbol: string
                    if (sudtXTypeHash === '0x0000000000000000000000000000000000000000000000000000000000000000' || sudtYTypeHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                        //skip one-side pair
                        continue
                    }

                    if (BigInt(sudtXTypeHash) < BigInt(sudtYTypeHash)) {
                        sudtXTypeArgs = poolInfo['assets'][0]['typeScript']['args']
                        sudtXSymbol = poolInfo['assets'][0]['symbol']
                        sudtYTypeArgs = poolInfo['assets'][1]['typeScript']['args']
                        sudtYSymbol = poolInfo['assets'][1]['symbol']
                    } else {
                        sudtXTypeArgs = poolInfo['assets'][1]['typeScript']['args']
                        sudtXTypeHash = poolInfo['assets'][1]['typeHash']
                        sudtXSymbol = poolInfo['assets'][1]['symbol']
                        sudtYTypeArgs = poolInfo['assets'][0]['typeScript']['args']
                        sudtYTypeHash = poolInfo['assets'][0]['typeHash']
                        sudtYSymbol = poolInfo['assets'][0]['symbol']
                    }

                    let infoCell = poolInfo['poolCell']
                    let infoCellTypeArgs = infoCell['cellOutput']['type']['args']//use it for identity
                    //let infoCellFromBlock = infoCell['blockNumber']//hex

                    //don't forget to sort the sudt type hash
                    identities.set(infoCellTypeArgs, {
                        xTypeHash: sudtXTypeHash, yTypeHash: sudtYTypeHash,
                        xTypeArg: sudtXTypeArgs, xSymbol: sudtXSymbol, yTypeArg: sudtYTypeArgs, ySymbol: sudtYSymbol

                    })
                }
                await this.#handler(identities)
                await this.#sleep(30 * 1000)
            } catch (e) {
                this.#error(e)
                await this.#sleep(30 * 1000)
            }
        }
    }

    #handler = async (identities: Map<string, WorkType>) => {

        let identitiesArray: Array<string> = Array.from(identities.keys())

        for (let [identity, process] of this.#processPool) {
            if (!identitiesArray.includes(identity)) {
                //stop it
                if (!process) {
                    continue
                }
                process.on('exit', () => {
                    this.#info(`receive identity ${identity} PID ${process.pid!} exit event`)
                    this.#processPool.delete(identity)
                })

                this.#info(`sending SIGINT to identity ${identity} ,PID ${process.pid}`)
                let res = process.kill('SIGINT')
                if (!res) {
                    this.#info(`identity ${identity} sent SIGINT fails, PID ${process.pid} maybe exit already?`)
                    this.#processPool.delete(identity)
                }
            }
        }


        for (let [identity, workConfig] of identities.entries()) {
            if (this.#processPool.has(identity)) {
                //continue, do nothing
            } else {
                //handle new privateKey and check if the balance is enough
                const workerPrivateKey = await this.#derivePrivateKey(workConfig)

                await this.#prepareBalance(workerPrivateKey)

                //open a new process
                let process = this.#fork(workerPrivateKey, workConfig.xTypeArg, workConfig.xSymbol, workConfig.yTypeArg, workConfig.ySymbol, identity)
                //add it into pool
                this.#processPool.set(identity, process)
            }
        }

    }

    #fork = (privateKey: string, xTypeArgs: string, xSymbol: string, yTypeArgs: string, ySymbol: string, infoTypeArgs: string) => {
        let env_work: any = {
            'MATCHER_PRIVATE_KEY': privateKey,
            'SUDT_X_TYPE_ARGS': xTypeArgs,
            'SUDT_X_SYMBOL': xSymbol,
            'SUDT_Y_TYPE_ARGS': yTypeArgs,
            'SUDT_Y_SYMBOL': ySymbol,
            'INFO_TYPE_ARGS': infoTypeArgs
        }
        let file: string = path.join(__dirname, 'worker.ts')
        let env = process.env
        Object.assign(env, env_work)
        return fork(file, {
            env: env
        })
    }

    #derivePrivateKey = async (workConfig: WorkType): Promise<string> => {
        const path = (BigInt(workConfig.xTypeHash) + BigInt(workConfig.yTypeHash) + DERIVE_RANDOM) % (BigInt(2 ** 31)) + (BigInt(2 ** 31))
        const seed = await mnemonic.mnemonicToSeed(MNEMONIC)
        let keychain: Keychain = Keychain.fromSeed(seed)
        const fullPath = `${AccountExtendedPublicKey.ckbAccountPath}/${path.toString()}`
        keychain = keychain.derivePath(fullPath)
        const privateKey = "0x" + keychain.privateKey.toString("hex")
        const workerAddress = `0x${blake160(privateKeyToPublicKey(privateKey), 'hex')}`
        this.#info(`${workConfig.xSymbol}-${workConfig.ySymbol}'s address: ${workerAddress}`)
        return privateKey
    }

    #prepareBalance = async (_privateKey: string): Promise<void> => {
        const workerAddress = `0x${blake160(privateKeyToPublicKey(_privateKey), 'hex')}`
        this.#info(`workerAddress: ${workerAddress}`)
        const cooperatorAddress = `0x${blake160(privateKeyToPublicKey(COOPERATOR_PRIVATE_KEY), 'hex')}`
        this.#info(`cooperatorAddress: ${cooperatorAddress}`)
        let cooperatorCell: Cell | null = await this.#scanMatcherChange(cooperatorAddress)
        if (cooperatorCell === null) {
            this.#error(`scan cooperator cell fails?!`)
            throw new Error(`scan cooperator cell fails?!`)
        }
        let workerCell = await this.#scanMatcherChange(workerAddress)
        if (workerCell === null) {
            await this.#transferBalanceToWorker(cooperatorCell!, workerAddress)
        }
        return
    }

    #transferBalanceToWorker = async (cooperatorCell: Cell, workerArgs: string): Promise<void> => {

        const inputs: Array<CKBComponents.CellInput> = [{
            previousOutput: {
                txHash: cooperatorCell.out_point!.tx_hash,
                index: cooperatorCell.out_point!.index,
            },
            since: '0x0',
        }]

        const capacity = BigInt(cooperatorCell.cell_output.capacity)
        this.#info(`cooperator current ckb: ${capacity}`)
        this.#info(`cooperator WORKER_TRANSFER_BALANCE ckb: ${WORKER_TRANSFER_BALANCE}`)
        this.#info(`cooperator BLOCK_MINER_FEE ckb: ${BLOCK_MINER_FEE}`)
        let remain = capacity - WORKER_TRANSFER_BALANCE - BLOCK_MINER_FEE
        this.#info(`cooperator remaining ckb: ${remain}`)
        if(remain < 0){
            this.#error(`not enough ckb of cooperator: ${remain}`)
            throw new Error(`not enough ckb of cooperator: ${remain}`)
        }

        let workerLockScript : Script = {
            code_hash: SECP256K1_CODE_HASH,
            hash_type: SECP256K1_HASH_TYPE,
            args: workerArgs
        };
        const outputs: Array<CKBComponents.CellOutput> = [
            {
                capacity: Uint64BigIntToHex(remain),
                type: null,
                lock: scriptSnakeToCamel(cooperatorCell.cell_output.lock),
            },
            {
                capacity: Uint64BigIntToHex(WORKER_TRANSFER_BALANCE),
                type: null,
                lock: scriptSnakeToCamel(workerLockScript),
            }
        ]


        const rawTransaction: Omit<CKBComponents.RawTransaction, 'witnesses'> = {
            version: '0x0',
            headerDeps: [],
            cellDeps: [{
                outPoint: {
                    txHash: SECP256K1_TX_HASH,
                    index: SECP256K1_TX_INDEX,
                },
                depType: 'depGroup' as CKBComponents.DepType,
            }],
            inputs: inputs,
            //witnesses: new Array(2).fill('0x'),
            outputs: outputs,
            outputsData: ['0x', '0x'],
        }

        const txHash = this.#ckb.utils.rawTransactionToHash(rawTransaction)

        const witness: StructuredWitness = this.#ckb.signWitnesses(COOPERATOR_PRIVATE_KEY)({
            transactionHash: txHash,
            witnesses: [{lock: '', inputType: '', outputType: ''}],
        })[0]

        const signedTx: any = {
            ...rawTransaction,
            //witnesses: [witness, ...rawTransaction.witnesses.slice(1)],
            witnesses: [
                witness,
            ],
        }

        try {
            const hash = await this.#client.sendTransaction(signedTx)
            this.#info('send ckb to worker: ' + workerArgs + ' txHash: ' + hash)
        } catch (e) {
            this.#error('signedTx: ' + JSONbig.stringify(signedTx, null, 2))
            this.#error('send ckb to worker error: ' + e)
        }
        return
    }


    #scanMatcherChange = async (address: string): Promise<Cell | null> => {

        const script: CKBComponents.Script = {
            codeHash: SECP256K1_CODE_HASH,
            hashType: SECP256K1_HASH_TYPE,
            args: address,
        }

        const queryOption: QueryOptions = {
            type: 'empty',
            lock: {
                argsLen: 20,
                script: scriptCamelToSnake(script),
            },
            fromBlock: COOPERATOR_FROM_BLOCK,
        }


        const cellCollector = new CellCollector(this.#knex, {
            ...queryOption,
        })

        for await (const cell of cellCollector.collect()) {
            return cell
        }

        return null
    }
}
//
// let a = false
// function respp() : any {
//     if(!a){
//         a = true
//         return resp
//     }
//     return '[]'
// }
//
// const resp = `[
//   {
//     "poolId": "0x3ccf34fcd907e5317b137deacab7370f0f24b999fb75630aabcda05642a611b2",
//     "lpToken": {
//       "typeHash": "0xfaf33232196f65e0c5480fb00f8e76362457df1c2b863b01d992e7ed09178791"
//     },
//     "total": "0",
//     "assets": [
//       {
//         "typeHash": "0x2e5a221c10510c7719de6fb0d11d851f8228f7c21644447814652343a1d1cbee",
//         "typeScript": {
//           "codeHash": "0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4",
//           "hashType": "type",
//           "args": "0xab4667fef2ee4b3604bba380418349466792e39b6111b17441f8d04382cb6635"
//         },
//         "name": "PenPen",
//         "symbol": "PenPen",
//         "decimals": 8,
//         "logoURI": "",
//         "chainType": "Nervos",
//         "balance": "0"
//       },
//       {
//         "typeHash": "0x71c0e6d4140695d734e92b099687a2277c1f5ee6dac6766c0de17653fe2c1813",
//         "typeScript": {
//           "codeHash": "0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4",
//           "hashType": "type",
//           "args": "0xd15bc6b88eebbb4e5c62de9e8349e2ec54ca1a7ee36a5b5288f0045ef3d00b98"
//         },
//         "name": "ckUSDT",
//         "symbol": "ckUSDT",
//         "decimals": 6,
//         "logoURI": "https://gliaswaptest.ckbapp.dev/token/usdt.png",
//         "chainType": "Nervos",
//         "balance": "0",
//         "shadowFrom": {
//           "name": "USDT",
//           "symbol": "USDT",
//           "decimals": 6,
//           "logoURI": "https://gliaswaptest.ckbapp.dev/token/usdt.png",
//           "address": "0x1cf98d2a2f5b0BFc365EAb6Ae1913C275bE2618F",
//           "chainType": "Ethereum"
//         }
//       }
//     ],
//     "model": "UNISWAP",
//     "status": "completed",
//     "poolCell": {
//       "cellOutput": {
//         "capacity": "0x5d21dba00",
//         "lock": {
//           "codeHash": "0x20405d74b2fe6b7a9ced51e9a8bb7b10d2c78aaca4d996ba20c838395cde74ee",
//           "hashType": "data",
//           "args": "0x71ce28b58d3e9422e51a790df7fb7cee4dedd00ad61c4e84a21cfe22603746b93ccf34fcd907e5317b137deacab7370f0f24b999fb75630aabcda05642a611b2"
//         },
//         "type": {
//           "codeHash": "0x1c661e19af0c826db22cc86d45f219abf3c14370c0a860238760d79c3ed8b541",
//           "hashType": "data",
//           "args": "0x20c50881d33433717f972d91d69c28b58ac5b9d43b50849ea2b08d7edb2f7aad"
//         }
//       },
//       "outPoint": {
//         "txHash": "0x5b2fde999a9d3170ea66ab142fc817a3283ff3344fa79ea2ab50cf029a58bd45",
//         "index": "0x0"
//       },
//       "blockHash": "0x6c0a598876c3f88b9e4a037d8c081be87e820b2eeea1ec3fdc0783b41b1b0708",
//       "blockNumber": "0x14bd6f",
//       "data": "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000faf33232196f65e0c5480fb00f8e76362457df1c2b863b01d992e7ed09178791"
//     }
//   }
// ]`
