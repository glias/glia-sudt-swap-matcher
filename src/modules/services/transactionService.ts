import { injectable } from 'inversify'
import { ALL_CELL_DEPS, CKB_NODE_URL, MATCHER_PRIVATE_KEY } from '../../utils/workEnv'
import CKB from '@nervosnetwork/ckb-sdk-core'
import { MatchRecord } from '../models/matches/matchRecord'
import JSONbig from 'json-bigint'
import { workerLogger } from '../../utils/workerLogger'
import {remove0xPrefix, Uint64BigIntToLeHex} from '../../utils/tools'

/*
this service compose tx for rpc
 */
@injectable()
export default class TransactionService {
  readonly #ckb: CKB

  #info = (msg: string) => {
    workerLogger.info(`TransactionService: ${msg}`)
  }
  // @ts-ignore
  #error = (msg: string) => {
    workerLogger.error(`TransactionService: ${msg}`)
  }

  constructor() {
    this.#ckb = new CKB(CKB_NODE_URL)
  }

  /*
  info_in_cell                            info_out_cell
  pool_in_cell                            pool_out_cell
                            ------->
  matcher_in_cell                         matcher_out_cell
  [swap_order_cell]                       [sudt_cell/free_cell]
  [liquiditi_order_cell]                  [...]
  */

  // return true if skip
  composeTransaction = (matchRecord: MatchRecord): Boolean => {
    if (matchRecord.skip) {
      return true
    }

    let swapNumber: number = 0
    let liquidityNumber: number = 0

    const inputs: Array<CKBComponents.CellInput> = []
    let outputs: Array<CKBComponents.CellOutput> = []
    let outputsData: Array<string> = []

    inputs.push(...matchRecord.info.toCellInput())
    outputs.push(matchRecord.info.toCellOutput())
    outputsData.push(matchRecord.info.toCellOutputData())

    inputs.push(...matchRecord.poolX.toCellInput())
    outputs.push(matchRecord.poolX.toCellOutput())
    outputsData.push(matchRecord.poolX.toCellOutputData())

    inputs.push(...matchRecord.poolY.toCellInput())
    outputs.push(matchRecord.poolY.toCellOutput())
    outputsData.push(matchRecord.poolY.toCellOutputData())

    inputs.push(...matchRecord.matcherChange.toCellInput())
    outputs.push(matchRecord.matcherChange.toCellOutput())
    outputsData.push(matchRecord.matcherChange.toCellOutputData())

    for (let sellXform of matchRecord.sellXforms) {
      if (sellXform.skip) {
        continue
      }

      inputs.push(...sellXform.toCellInput())
      outputs.push(...sellXform.toCellOutput())
      outputsData.push(...sellXform.toCellOutputData())

      swapNumber++
    }

    for (let buyXform of matchRecord.buyXforms) {
      if (buyXform.skip) {
        continue
      }

      inputs.push(...buyXform.toCellInput())
      outputs.push(...buyXform.toCellOutput())
      outputsData.push(...buyXform.toCellOutputData())

      swapNumber++
    }

    for (let addXform of matchRecord.addXforms) {
      if (addXform.skip) {
        continue
      }

      inputs.push(...addXform.toCellInput())
      outputs.push(...addXform.toCellOutput())
      outputsData.push(...addXform.toCellOutputData())

      liquidityNumber++
    }

    for (let removeXform of matchRecord.removeXforms) {
      if (removeXform.skip) {
        continue
      }

      inputs.push(...removeXform.toCellInput())
      outputs.push(...removeXform.toCellOutput())
      outputsData.push(...removeXform.toCellOutputData())

    }

    // compose tx
    const [signedTx, txHash] = this.composeTxAndSign(inputs, outputs, outputsData, swapNumber,liquidityNumber)
    this.#info('composed tx: ' + JSONbig.stringify(signedTx, null, 2))
    this.#info('composed txHash: ' + txHash)

    matchRecord.composedTx = signedTx
    matchRecord.composedTxHash = txHash

    return false
  }

  composeLiquidityInitTransaction = (liquidityMatch: MatchRecord): void => {
    const inputs: Array<CKBComponents.CellInput> = []
    let outputs: Array<CKBComponents.CellOutput> = []
    let outputsData: Array<string> = []

    inputs.push(...liquidityMatch.info.toCellInput())
    outputs.push(liquidityMatch.info.toCellOutput())
    outputsData.push(liquidityMatch.info.toCellOutputData())

    inputs.push(...liquidityMatch.poolX.toCellInput())
    outputs.push(liquidityMatch.poolX.toCellOutput())
    outputsData.push(liquidityMatch.poolX.toCellOutputData())

    inputs.push(...liquidityMatch.poolY.toCellInput())
    outputs.push(liquidityMatch.poolY.toCellOutput())
    outputsData.push(liquidityMatch.poolY.toCellOutputData())

    inputs.push(...liquidityMatch.matcherChange.toCellInput())
    outputs.push(liquidityMatch.matcherChange.toCellOutput())
    outputsData.push(liquidityMatch.matcherChange.toCellOutputData())

    inputs.push(...liquidityMatch.initXforms!.toCellInput())
    outputs.push(...liquidityMatch.initXforms!.toCellOutput())
    outputsData.push(...liquidityMatch.initXforms!.toCellOutputData())

    const [signedTx, txHash] = this.composeTxAndSign(inputs, outputs, outputsData, 0,1)
    this.#info('init composed tx: ' + JSONbig.stringify(signedTx, null, 2))
    this.#info('init composed txHash: ' + txHash)

    liquidityMatch.composedTx = signedTx
    liquidityMatch.composedTxHash = txHash

    //this.#info('liquidityInitMatch res: ' + JSONbig.stringify(liquidityMatch, null, 2))
    //this.#info('liquidityInitMatch res: ' + txHash)
  }

  private composeTxAndSign = (
    inputs: Array<CKBComponents.CellInput>,
    outputs: Array<CKBComponents.CellOutput>,
    outputsData: Array<string>,
    swapNo: number,
    liquidityNo: number,
  ): [CKBComponents.RawTransaction, string] => {
    const rawTx: CKBComponents.RawTransaction = {
      version: '0x0',
      headerDeps: [],
      cellDeps: ALL_CELL_DEPS,
      inputs: inputs,
      witnesses: new Array(inputs.length).fill('0x'),
      outputs: outputs,
      outputsData: outputsData,
    }

    return this.signTransaction(rawTx, swapNo,liquidityNo)
  }

  public signTransaction = (
    rawTransaction: CKBComponents.RawTransactionToSign,
    swapNo: number,
    liquidityNo: number,
  ): [CKBComponents.RawTransaction, string] => {
    const txHash = this.#ckb.utils.rawTransactionToHash(rawTransaction)

    const matcherChangerWitness = this.signWitness(txHash)

    const infoWitness = this.prepareInfoWitness(swapNo,liquidityNo)
    const signedTx: any = {
      ...rawTransaction,
      //witnesses: [witness, ...rawTransaction.witnesses.slice(1)],
      witnesses: [
        infoWitness,
        rawTransaction.witnesses[1],
        rawTransaction.witnesses[2],
        matcherChangerWitness,
        ...rawTransaction.witnesses.slice(4),
      ],
    }
    return [signedTx, txHash]
  }

  public signWitness = (txHash: string): StructuredWitness => {
    return this.#ckb.signWitnesses(MATCHER_PRIVATE_KEY)({
      transactionHash: txHash,
      witnesses: [{ lock: '', inputType: '', outputType: '' }],
    })[0]
  }

  public prepareInfoWitness = (swapNo: number,liquidityNo: number): StructuredWitness => {
    const swapNumber = Uint64BigIntToLeHex(BigInt(swapNo))
    const liquidityNumber = Uint64BigIntToLeHex(BigInt(liquidityNo))
    const data = swapNumber + remove0xPrefix(liquidityNumber)
    const witnessArgs = { lock: '', inputType: data, outputType: '' }
    return this.#ckb.utils.serializeWitnessArgs(witnessArgs)
  }
}
