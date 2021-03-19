import { CellCollector, Indexer } from '@ckb-lumos/sql-indexer'
import knex from 'knex'
import {
  INDEXER_MYSQL_DATABASE,
  INDEXER_MYSQL_PASSWORD,
  INDEXER_MYSQL_URL,
  INDEXER_MYSQL_URL_PORT,
  INDEXER_MYSQL_USERNAME,
  INDEXER_URL,
  INFO_QUERY_OPTION,
  LIQUIDITY_ADD_X_REQ_QUERY_OPTION, LIQUIDITY_ADD_Y_REQ_QUERY_OPTION,
  LIQUIDITY_REMOVE_REQ_QUERY_OPTION,
  MATCHER_QUERY_OPTION,
  POOL_X_QUERY_OPTION,
  POOL_Y_QUERY_OPTION,
  SWAP_BUY_REQ_QUERY_OPTION,
  SWAP_SELL_REQ_QUERY_OPTION,
} from '../../utils/workEnv'
import { SwapBuyReq } from '../models/cells/swapBuyReq'
import { inject, injectable, LazyServiceIdentifer } from 'inversify'
import { Info } from '../models/cells/info'
import { PoolX } from '../models/cells/poolX'
import { LiquidityRemoveReq } from '../models/cells/liquidityRemoveReq'
import { LiquidityAddReq } from '../models/cells/liquidityAddReq'
import { MatcherChange } from '../models/cells/matcherChange'
import RpcService from './rpcService'
import { modules } from '../../container'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { SwapSellReq } from '../models/cells/swapSellReq'
import {bigIntToHex, scriptSnakeToCamel} from '../../utils/tools'
import { workerLogger } from '../../utils/workerLogger'
// @ts-ignore
import JSONbig from 'json-bigint'
import {scriptToHash} from "@nervosnetwork/ckb-sdk-utils";
import {Cell} from "@ckb-lumos/base";
import {PoolY} from "../models/cells/poolY";

@injectable()
export default class ScanService {
  readonly #indexer!: Indexer
  readonly #rpcService: RpcService
  readonly #knex: knex

  // @ts-ignore
  #info = (msg: string) => {
    workerLogger.info(`ScanService: ${msg}`)
  }
  // @ts-ignore
  #error = (msg: string) => {
    workerLogger.error(`ScanService: ${msg}`)
  }

  constructor(@inject(new LazyServiceIdentifer(() => modules[RpcService.name])) rpcService: RpcService) {
    this.#rpcService = rpcService

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

    this.#indexer = new Indexer(INDEXER_URL, this.#knex)
  }

  public getTip = async (): Promise<bigint> => {
    return BigInt((await this.#indexer.tip()).block_number)
  }

  public scanAll = async (): Promise<
    [
      Array<LiquidityAddTransformation>,
      Array<LiquidityRemoveTransformation>,
      Array<SwapBuyTransformation>,
      Array<SwapSellTransformation>,
      Info,
      PoolX,
        PoolY,
      MatcherChange,
    ]
  > => {
    const tip = bigIntToHex(await this.getTip())

    this.#info('scanReqs starts: ' + new Date())
    let [liquidityAddReqs, liquidityRemoveReqs, swapBuyReqs, swapSellReqs] = await this.scanReqs(tip)
    this.#info('scanMatcherChange starts: ' + new Date())
    let matcherChange = await this.scanMatcherChange(tip)
    this.#info('scanInfoCell starts: ' + new Date())
    let [info, poolX, poolY] = await this.scanInfoCell(tip)

    let liquidityAddTransformations = liquidityAddReqs.map(req => new LiquidityAddTransformation(req))
    let liquidityRemoveTransformations = liquidityRemoveReqs.map(req => new LiquidityRemoveTransformation(req))
    let swapBuyTransformations = swapBuyReqs.map(req => new SwapBuyTransformation(req))
    let swapSellTransformations = swapSellReqs.map(req => new SwapSellTransformation(req))

    return [
      liquidityAddTransformations,
      liquidityRemoveTransformations,
      swapBuyTransformations,
      swapSellTransformations,
      info,
      poolX,
        poolY,
      matcherChange,
    ]
  }

  // be careful that the tip is hexicalDecimal
  private scanReqs = async (
    tip?: string,
  ): Promise<[Array<LiquidityAddReq>, Array<LiquidityRemoveReq>, Array<SwapBuyReq>, Array<SwapSellReq>]> => {

    const swapBuyReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...SWAP_BUY_REQ_QUERY_OPTION,
    })
    const swapBuyReqs: SwapBuyReq[] = []
    for await (const cell of swapBuyReqCollector.collect()) {
      // change to construct

      const script = await this.#rpcService.getLockScript(cell.out_point!, SwapBuyReq.getUserLockHash(cell))
      if (!script) {
        this.#info('can not find user lock script: ' + cell.out_point!.tx_hash)
        continue
      }
      const input = SwapBuyReq.fromCell(cell, script!)
      if (!input) {
        continue
      }
      swapBuyReqs.push(input!)
    }
    //==============

    const swapSellReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...SWAP_SELL_REQ_QUERY_OPTION,
    })
    const swapSellReqs: SwapSellReq[] = []
    for await (const cell of swapSellReqCollector.collect()) {
      // change to construct

      const script = await this.#rpcService.getLockScript(cell.out_point!, SwapSellReq.getUserLockHash(cell))
      if (!script) {
        this.#info('can not find user lock script: ' + cell.out_point!.tx_hash)
        continue
      }
      const input = SwapSellReq.fromCell(cell, script!)
      if (!input) {
        continue
      }
      swapSellReqs.push(input!)
    }

    //==============
    // we must must both reqs
    const liquidityAddXReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...LIQUIDITY_ADD_X_REQ_QUERY_OPTION,
    })
    const liquidityAddXReqs :Map<string,Cell>= new Map<string, Cell>();
    for await (const cellX of liquidityAddXReqCollector.collect()) {
      let hash = scriptToHash(scriptSnakeToCamel(cellX.cell_output.lock)).substring(2)
      liquidityAddXReqs.set(hash,cellX)
      //console.log(`liquidityAddXReqs set map ${hash}`)
    }
    //==
    const liquidityAddYReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...LIQUIDITY_ADD_Y_REQ_QUERY_OPTION,
    })
    const liquidityAddReqs : Array<LiquidityAddReq> = [];
    for await (const cellY of liquidityAddYReqCollector.collect()) {
      const script = await this.#rpcService.getLockScript(cellY.out_point!, LiquidityAddReq.getUserLockHash(cellY))
      if (!script) {
        this.#info('can not find user lock script: ' + cellY.out_point!.tx_hash)
        continue
      }
      let reqSudtXCellLockHash = LiquidityAddReq.getReqSudtXCellLockHash(cellY)
      if(reqSudtXCellLockHash == null){
        continue
      }

      let cellX = liquidityAddXReqs.get(reqSudtXCellLockHash)
      liquidityAddXReqs.delete(reqSudtXCellLockHash)
      if(!cellX){
        continue
      }

      let input = LiquidityAddReq.fromCell(cellX,cellY,script)
      if(!input){
        continue
      }
      liquidityAddReqs.push(input!)
    }

    //==============
    const liquidityRemoveReqs: Array<LiquidityRemoveReq> = []
    const liquidityRemoveReqCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...LIQUIDITY_REMOVE_REQ_QUERY_OPTION,
    })
    for await (const cell of liquidityRemoveReqCollector.collect()) {
      const script = await this.#rpcService.getLockScript(cell.out_point!, LiquidityRemoveReq.getUserLockHash(cell))
      if (!script) {
        this.#info('can not find user lock script: ' + cell.out_point!.tx_hash)
        continue
      }
      const input = LiquidityRemoveReq.fromCell(cell, script!)
      if (!input) {
        continue
      }
      liquidityRemoveReqs.push(input!)
    }

    return [liquidityAddReqs, liquidityRemoveReqs, swapBuyReqs, swapSellReqs]
  }

  private scanMatcherChange = async (tip?: string): Promise<MatcherChange> => {
    const MatcherCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...MATCHER_QUERY_OPTION,
    })
    let matcherChange: MatcherChange | null = null
    for await (const cell of MatcherCollector.collect()) {
      matcherChange = MatcherChange.fromCell(cell)
      break
    }
    if (!matcherChange) {
      throw new Error('matcher change not found')
    }

    return matcherChange
  }

  private scanInfoCell = async (tip?: string): Promise<[Info, PoolX, PoolY]> => {
    const infoCellCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...INFO_QUERY_OPTION,
    })
    let info: Info | null = null
    for await (const cell of infoCellCollector.collect()) {
      info = Info.fromCell(cell)
      //this.#info('info cell: ' + JSONbig.stringify(info, null, 2))
      break
    }

    const poolXCellCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...POOL_X_QUERY_OPTION,
    })
    let poolX: PoolX | null = null
    for await (const cell of poolXCellCollector.collect()) {
      //this.#info("pool cell: "+ JSONbig.stringify(cell,null,2))
      poolX = PoolX.fromCell(cell)
      break
    }

    const poolYCellCollector = new CellCollector(this.#knex, {
      toBlock: tip,
      ...POOL_Y_QUERY_OPTION,
    })
    let poolY: PoolY | null = null
    for await (const cell of poolYCellCollector.collect()) {
      //this.#info("pool cell: "+ JSONbig.stringify(cell,null,2))
      poolY = PoolY.fromCell(cell)
      break
    }

    if (!info || !poolX || !poolY) {
      throw new Error('info or pool not found')
    }

    return [info!, poolX!, poolY!]
  }
}
