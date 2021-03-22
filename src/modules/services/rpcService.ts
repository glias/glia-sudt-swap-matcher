import { injectable } from 'inversify'
import Rpc from '@nervosnetwork/ckb-sdk-rpc'
import { CKB_NODE_URL, PW_LOCK_CODE_HASH, PW_LOCK_HASH_TYPE } from '../../utils/workEnv'
import { OutPoint } from '@ckb-lumos/base'
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils'
import JSONbig from 'json-bigint'
import { workerLogger } from '../../utils/workerLogger'
import {prepare0xPrefix, remove0xPrefix, waitTx} from '../../utils/tools'
import { WitnessArgs } from '../../utils/blockchain'
import {ETHSPVProof, MintTokenWitness} from '../../utils/witness'
import * as rlp from 'rlp'

@injectable()
export default class RpcService {
  #client: Rpc

  #info = (msg: string) => {
    workerLogger.info(`RpcService: ${msg}`)
  }
  #error = (msg: string) => {
    workerLogger.error(`RpcService: ${msg}`)
  }

  constructor() {
    this.#client = new Rpc(CKB_NODE_URL)
  }

  // getTip = async (): Promise<string> => {
  //   return await this.#client.getTipBlockNumber()
  // }


  // give an outpoint of certain cell, find a lockscript fromCell the tx inside the
  // the outpoint which matches target hash
  getLockScript = async (outPoint: OutPoint, lockScriptHash: string): Promise<CKBComponents.Script | null> => {
    const tx = await this.#client.getTransaction(outPoint.tx_hash!)

    // try to find from inputs from the tx
    for (let input of tx.transaction.inputs) {
      const pre_tx = await this.#client.getTransaction(input.previousOutput!.txHash)
      const outputCell = pre_tx.transaction.outputs[Number(input.previousOutput!.index)]
      if (scriptToHash(outputCell.lock).toLowerCase() === lockScriptHash.toLowerCase()) {
        this.#info(`find script of tx ${lockScriptHash} from previous tx`)
        return outputCell.lock
      }
    }

    //try to find from witness[0] for force-eth-bridge
    try {
      const witness = tx.transaction.witnesses[0]
      const lock = this.parseWitness(witness)

      this.#info(JSONbig.stringify(lock))
      this.#info(scriptToHash(lock))
      this.#info(lockScriptHash)
      if (scriptToHash(lock).toLowerCase() === lockScriptHash.toLowerCase()) {
        this.#info(`find script of tx ${lockScriptHash} from witness`)
        return lock
      }
    } catch (e) {
      this.#info(e)
    }
    this.#info(`script of tx ${lockScriptHash} is missing`)
    return null
  }

  parseWitness = (witness: CKBComponents.Witness): CKBComponents.Script => {
    const jsbuffer = Buffer.from(remove0xPrefix(witness), 'hex')
    //console.log(jsbuffer.length)

    const buffer: ArrayBuffer = RpcService.toArrayBuffer(jsbuffer)
    //console.log(buffer.byteLength)

    const witnessArgs = new WitnessArgs(buffer)

    const witnessArgsLockRaw = witnessArgs.getLock().value().raw()

    //console.log('lock: ' + witnessArgsLockRaw)

    const mintTokenWitness = new MintTokenWitness(witnessArgsLockRaw)
    const spvProofRaw = mintTokenWitness.getSpvProof().raw()
    const ethSpvProof = new ETHSPVProof(spvProofRaw)
    const receiptLogIndex = Number(RpcService.toBuffer(ethSpvProof.getLogIndex().raw()).readBigUInt64LE());
    const receiptData = ethSpvProof.getReceiptData();
    /*
    pub struct Receipt {
        ///
        pub status: bool,
        ///
        pub gas_used: U256,
        ///
        pub log_bloom: Bloom,
        ///
        pub logs: Vec<LogEntry>,
    }
    */
    // @ts-ignore
    const receipt : Array<Buffer> = rlp.decode(RpcService.toBuffer(receiptData.raw()))
    /*
    pub struct LogEntry {
        /// address
        pub address: Address,
        /// topics
        pub topics: Vec<H256>,
        /// data
        pub data: Vec<u8>,
    }
     */
    const receiptLogEntry :any= receipt[3][receiptLogIndex]

    /*
    event Locked(
      address indexed token,
      address indexed sender,
      uint256 lockedAmount,
      uint256 bridgeFee,
      bytes recipientLockscript,
      bytes replayResistOutpoint,
      bytes sudtExtraData
    );
     */
    const sender = prepare0xPrefix(receiptLogEntry[1][2].slice(12).toString('hex'))

    return {
      args: sender,
      codeHash: PW_LOCK_CODE_HASH,
      hashType: PW_LOCK_HASH_TYPE,
    }
  }

  sendTransaction = async (rawTx: CKBComponents.RawTransaction): Promise<boolean> => {
    try {
      //this.#info('sendTransaction : ' + JSONbig.stringify(rawTx, null, 2))
      const txHash : CKBComponents.Hash = await this.#client.sendTransaction(rawTx)
      this.#info(`sendTransaction, txHash: ${txHash}`)
      await waitTx(txHash,this.#client)
      return true
    } catch (e) {
      this.#error('sendTransaction error, rawTx: '+JSONbig.stringify(rawTx,null,2))
      this.#error('sendTransaction error: ' + e)
      return false
    }
  }

  static toArrayBuffer = (buf: Buffer): ArrayBuffer => {
    let ab = new ArrayBuffer(buf.length)
    let view = new Uint8Array(ab)
    for (let i = 0; i < buf.length; ++i) {
      view[i] = buf[i]
    }
    return ab
  }

  static toBuffer = (arrayBuffer: ArrayBuffer): Buffer => {
    let b = Buffer.alloc(arrayBuffer.byteLength)
    let view = new Uint8Array(arrayBuffer)

    for (let i = 0; i < b.length; ++i) {
      b[i] = view[i]
    }
    return b
  }
}

