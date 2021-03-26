import {logger} from './cooperatorLogger'
import {
    BLOCK_MINER_FEE,
    CKB_NODE_URL, CKB_SUDT_INFO_LOCK_CODE_HASH,
    CKB_SUDT_INFO_LOCK_HASH_TYPE,
    CKB_SUDT_INFO_LOCK_OUTPOINT_INDEX,
    CKB_SUDT_INFO_LOCK_OUTPOINT_TX_HASH, CKB_SUDT_INFO_TYPE_CODE_HASH,
    CKB_SUDT_INFO_TYPE_HASH_TYPE, CKB_SUDT_INFO_TYPE_OUTPOINT_INDEX, CKB_SUDT_INFO_TYPE_OUTPOINT_TX_HASH,
    CKB_SUDT_LIQUIDITY_REQ_LOCK_ARGS_VERSION,
    CKB_SUDT_LIQUIDITY_REQ_LOCK_CODE_HASH,
    CKB_SUDT_LIQUIDITY_REQ_LOCK_HASH_TYPE,
    CKB_SUDT_LIQUIDITY_REQ_LOCK_SCRIPT_INDEX,
    CKB_SUDT_LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH,
    CKB_SUDT_SWAP_REQ_LOCK_ARGS_VERSION,
    CKB_SUDT_SWAP_REQ_LOCK_CODE_HASH,
    CKB_SUDT_SWAP_REQ_LOCK_HASH_TYPE,
    CKB_SUDT_SWAP_REQ_LOCK_SCRIPT_INDEX, CKB_SUDT_SWAP_REQ_LOCK_SCRIPT_TX_HASH,
    COOPERATOR_FROM_BLOCK,
    COOPERATOR_PRIVATE_KEY,
    DERIVE_RANDOM,
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
    SECP256K1_TX_INDEX, SUDT_SUDT_INFO_LOCK_CODE_HASH,
    SUDT_SUDT_INFO_LOCK_HASH_TYPE, SUDT_SUDT_INFO_LOCK_OUTPOINT_INDEX,
    SUDT_SUDT_INFO_LOCK_OUTPOINT_TX_HASH,
    SUDT_SUDT_INFO_TYPE_CODE_HASH,
    SUDT_SUDT_INFO_TYPE_HASH_TYPE,
    SUDT_SUDT_INFO_TYPE_OUTPOINT_INDEX,
    SUDT_SUDT_INFO_TYPE_OUTPOINT_TX_HASH,
    SUDT_SUDT_LIQUIDITY_REQ_LOCK_ARGS_VERSION,
    SUDT_SUDT_LIQUIDITY_REQ_LOCK_CODE_HASH,
    SUDT_SUDT_LIQUIDITY_REQ_LOCK_HASH_TYPE,
    SUDT_SUDT_LIQUIDITY_REQ_LOCK_SCRIPT_INDEX,
    SUDT_SUDT_LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH,
    SUDT_SUDT_SWAP_REQ_LOCK_ARGS_VERSION,
    SUDT_SUDT_SWAP_REQ_LOCK_CODE_HASH,
    SUDT_SUDT_SWAP_REQ_LOCK_HASH_TYPE, SUDT_SUDT_SWAP_REQ_LOCK_SCRIPT_INDEX,
    SUDT_SUDT_SWAP_REQ_LOCK_SCRIPT_TX_HASH,
    WORKER_TRANSFER_BALANCE
} from './cooperatorEnv'
import axios from 'axios'
import {ChildProcess, fork} from "child_process";
import path from 'path'
import {AccountExtendedPublicKey, Keychain, mnemonic} from '@ckb-lumos/hd'
import {blake160, privateKeyToPublicKey} from "@nervosnetwork/ckb-sdk-utils";
import {CellCollector} from "@ckb-lumos/sql-indexer";
import {Cell, QueryOptions, Script} from "@ckb-lumos/base";
import {scriptCamelToSnake, scriptSnakeToCamel, sleep, Uint64BigIntToHex, waitTx} from "./tools";
import CKB from "@nervosnetwork/ckb-sdk-core";
import JSONbig from "json-bigint";
import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import knex from 'knex'

type WorkType = Record<'xTypeArg' | 'xTypeHash' | 'xSymbol' | 'yTypeArg' | 'yTypeHash' | 'ySymbol'| 'fromBlock', string>

export default class Cooperator {
    #ckb: CKB
    #client: Rpc
    #knex: knex

    static CKB_TYPE_ARGS : string = '0x'
    static CKB_TYPE_HASH : string = '0x0000000000000000000000000000000000000000000000000000000000000000'
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
                    let infoCellTypeArgs : string
                    let fromBlock: string
                    if (sudtXTypeHash === Cooperator.CKB_TYPE_HASH || sudtYTypeHash === Cooperator.CKB_TYPE_HASH) {

                        sudtXTypeArgs = Cooperator.CKB_TYPE_ARGS
                        sudtXSymbol = poolInfo['assets'][0]['symbol']

                        if(sudtXSymbol !== 'CKB'){
                            this.#error(`sudtXSymbol of native CKB from ${this.#poolUrl} is not literally 'CKB'`)
                        }

                        sudtYTypeArgs = poolInfo['assets'][1]['typeScript']['args']
                        sudtYTypeHash = poolInfo['assets'][1]['typeHash']
                        sudtYSymbol = poolInfo['assets'][1]['symbol']

                        let infoCell = poolInfo['poolCell']
                        infoCellTypeArgs = infoCell['cellOutput']['type']['args']//use it for identity

                        fromBlock = infoCell['blockNumber']

                    }else{
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
                        infoCellTypeArgs = infoCell['cellOutput']['type']['args']//use it for identity

                        fromBlock = infoCell['blockNumber']
                    }


                    this.#info(`${sudtXSymbol}-${sudtYSymbol}: ${fromBlock}`)


                    //don't forget to sort the sudt type hash
                    identities.set(infoCellTypeArgs, {
                        xTypeHash: sudtXTypeHash, yTypeHash: sudtYTypeHash,
                        xTypeArg: sudtXTypeArgs, xSymbol: sudtXSymbol,
                        yTypeArg: sudtYTypeArgs, ySymbol: sudtYSymbol,
                        fromBlock: fromBlock

                    })
                }
                await this.#handler(identities)
                await sleep(30 * 1000)
            } catch (e) {
                this.#error(e)
                await sleep(30 * 1000)
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

                this.#info(`prepareBalance: ${workConfig.xSymbol}-${workConfig.ySymbol}`)
                await this.#prepareBalance(workerPrivateKey)

                //open a new process
                let process = this.#fork(workerPrivateKey, workConfig.xTypeArg, workConfig.xSymbol, workConfig.yTypeArg, workConfig.ySymbol, identity, workConfig.fromBlock)
                //add it into pool
                this.#processPool.set(identity, process)
            }
        }

    }

    #fork = (privateKey: string, xTypeArgs: string, xSymbol: string, yTypeArgs: string, ySymbol: string, infoTypeArgs: string,fromBlock:string) => {
        if(xTypeArgs === Cooperator.CKB_TYPE_ARGS){
            let env_work: any = {
                'MATCHER_PRIVATE_KEY': privateKey,
                'SUDT_TYPE_ARGS': yTypeArgs,
                'SUDT_SYMBOL': ySymbol,
                'INFO_TYPE_ARGS': infoTypeArgs,
                'INFO_FROM_BLOCK': fromBlock,
                'LIQUIDITY_FROM_BLOCK': fromBlock,
                'SWAP_FROM_BLOCK': fromBlock,

                'INFO_TYPE_OUTPOINT_TX_HASH':CKB_SUDT_INFO_TYPE_OUTPOINT_TX_HASH,
                'INFO_TYPE_OUTPOINT_INDEX':CKB_SUDT_INFO_TYPE_OUTPOINT_INDEX,
                'INFO_TYPE_CODE_HASH':CKB_SUDT_INFO_TYPE_CODE_HASH,
                'INFO_TYPE_HASH_TYPE':CKB_SUDT_INFO_TYPE_HASH_TYPE,
                'INFO_LOCK_OUTPOINT_TX_HASH':CKB_SUDT_INFO_LOCK_OUTPOINT_TX_HASH,
                'INFO_LOCK_OUTPOINT_INDEX':CKB_SUDT_INFO_LOCK_OUTPOINT_INDEX,
                'INFO_LOCK_CODE_HASH':CKB_SUDT_INFO_LOCK_CODE_HASH,
                'INFO_LOCK_HASH_TYPE':CKB_SUDT_INFO_LOCK_HASH_TYPE,
                'LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH':CKB_SUDT_LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH,
                'LIQUIDITY_REQ_LOCK_SCRIPT_INDEX':CKB_SUDT_LIQUIDITY_REQ_LOCK_SCRIPT_INDEX,
                'LIQUIDITY_REQ_LOCK_CODE_HASH':CKB_SUDT_LIQUIDITY_REQ_LOCK_CODE_HASH,
                'LIQUIDITY_REQ_LOCK_HASH_TYPE':CKB_SUDT_LIQUIDITY_REQ_LOCK_HASH_TYPE,
                'LIQUIDITY_REQ_LOCK_ARGS_VERSION':CKB_SUDT_LIQUIDITY_REQ_LOCK_ARGS_VERSION,
                'SWAP_REQ_LOCK_SCRIPT_TX_HASH':CKB_SUDT_SWAP_REQ_LOCK_SCRIPT_TX_HASH,
                'SWAP_REQ_LOCK_SCRIPT_INDEX':CKB_SUDT_SWAP_REQ_LOCK_SCRIPT_INDEX,
                'SWAP_REQ_LOCK_CODE_HASH':CKB_SUDT_SWAP_REQ_LOCK_CODE_HASH,
                'SWAP_REQ_LOCK_HASH_TYPE':CKB_SUDT_SWAP_REQ_LOCK_HASH_TYPE,
                'SWAP_REQ_LOCK_ARGS_VERSION':CKB_SUDT_SWAP_REQ_LOCK_ARGS_VERSION,
            }
            let file: string = path.join(__dirname, 'ckb2sudt/ckb2SudtWorker.ts')
            let env = process.env
            Object.assign(env, env_work)
            return fork(file, {
                env: env
            })
        }else{
            let env_work: any = {
                'MATCHER_PRIVATE_KEY': privateKey,
                'SUDT_X_TYPE_ARGS': xTypeArgs,
                'SUDT_X_SYMBOL': xSymbol,
                'SUDT_Y_TYPE_ARGS': yTypeArgs,
                'SUDT_Y_SYMBOL': ySymbol,
                'INFO_TYPE_ARGS': infoTypeArgs,
                'INFO_FROM_BLOCK': fromBlock,
                'LIQUIDITY_FROM_BLOCK': fromBlock,
                'SWAP_FROM_BLOCK': fromBlock,

                'INFO_TYPE_OUTPOINT_TX_HASH':SUDT_SUDT_INFO_TYPE_OUTPOINT_TX_HASH,
                'INFO_TYPE_OUTPOINT_INDEX':SUDT_SUDT_INFO_TYPE_OUTPOINT_INDEX,
                'INFO_TYPE_CODE_HASH':SUDT_SUDT_INFO_TYPE_CODE_HASH,
                'INFO_TYPE_HASH_TYPE':SUDT_SUDT_INFO_TYPE_HASH_TYPE,
                'INFO_LOCK_OUTPOINT_TX_HASH':SUDT_SUDT_INFO_LOCK_OUTPOINT_TX_HASH,
                'INFO_LOCK_OUTPOINT_INDEX':SUDT_SUDT_INFO_LOCK_OUTPOINT_INDEX,
                'INFO_LOCK_CODE_HASH':SUDT_SUDT_INFO_LOCK_CODE_HASH,
                'INFO_LOCK_HASH_TYPE':SUDT_SUDT_INFO_LOCK_HASH_TYPE,
                'LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH':SUDT_SUDT_LIQUIDITY_REQ_LOCK_SCRIPT_TX_HASH,
                'LIQUIDITY_REQ_LOCK_SCRIPT_INDEX':SUDT_SUDT_LIQUIDITY_REQ_LOCK_SCRIPT_INDEX,
                'LIQUIDITY_REQ_LOCK_CODE_HASH':SUDT_SUDT_LIQUIDITY_REQ_LOCK_CODE_HASH,
                'LIQUIDITY_REQ_LOCK_HASH_TYPE':SUDT_SUDT_LIQUIDITY_REQ_LOCK_HASH_TYPE,
                'LIQUIDITY_REQ_LOCK_ARGS_VERSION':SUDT_SUDT_LIQUIDITY_REQ_LOCK_ARGS_VERSION,
                'SWAP_REQ_LOCK_SCRIPT_TX_HASH':SUDT_SUDT_SWAP_REQ_LOCK_SCRIPT_TX_HASH,
                'SWAP_REQ_LOCK_SCRIPT_INDEX':SUDT_SUDT_SWAP_REQ_LOCK_SCRIPT_INDEX,
                'SWAP_REQ_LOCK_CODE_HASH':SUDT_SUDT_SWAP_REQ_LOCK_CODE_HASH,
                'SWAP_REQ_LOCK_HASH_TYPE':SUDT_SUDT_SWAP_REQ_LOCK_HASH_TYPE,
                'SWAP_REQ_LOCK_ARGS_VERSION':SUDT_SUDT_SWAP_REQ_LOCK_ARGS_VERSION,
            }
            let file: string = path.join(__dirname, 'sudt2sudt/sudt2SudtWorker.ts')
            let env = process.env
            Object.assign(env, env_work)
            return fork(file, {
                env: env
            })
        }
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
            await waitTx(hash,this.#client)
            this.#info('send ckb to worker: ' + workerArgs + ' txHash: ' + hash + ' done!')
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
