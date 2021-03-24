import { inject, injectable, LazyServiceIdentifer } from 'inversify'
import { CronJob } from 'cron'
import { modules } from '../../container'
import { workerLogger } from '../../utils/workerLogger'
import ScanService from './scanService'
import RpcService from './rpcService'
import MatcherService from './matcherService'
import TransactionService from './transactionService'
import { Info } from '../models/cells/info'
import { Pool } from '../models/cells/pool'
import { MatcherChange } from '../models/cells/matcherChange'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { MatchRecord } from '../models/matches/matchRecord'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { LiquidityInitTransformation } from '../models/transformation/liquidityInitTransformation'
import JSONbig from 'json-bigint'
import process from "process";

// @ts-ignore
const jsonbig = JSONbig({ useNativeBigInt: true,alwaysParseAsBig:true})


@injectable()
export default class TaskService {
  readonly #scanService: ScanService
  readonly #rpcService: RpcService
  readonly #matcherService: MatcherService
  readonly #transactionService: TransactionService

  #schedule = `30 * * * * *`//default

  #cronLock: boolean = false

  #info = (msg: string) => {
    workerLogger.info(`TaskService: ${msg}`)
  }
  #error = (msg: string) => {
    workerLogger.error(`TaskService: ${msg}`)
  }

  constructor(
    @inject(new LazyServiceIdentifer(() => modules[ScanService.name])) scanService: ScanService,
    @inject(new LazyServiceIdentifer(() => modules[RpcService.name])) rpcService: RpcService,
    @inject(new LazyServiceIdentifer(() => modules[MatcherService.name])) matcherService: MatcherService,
    @inject(new LazyServiceIdentifer(() => modules[TransactionService.name])) transactionService: TransactionService,
  ) {
    this.#scanService = scanService
    this.#rpcService = rpcService
    this.#matcherService = matcherService
    this.#transactionService = transactionService

    const randomSecond = Math.floor(Math.random() * Math.floor(60));
    this.#schedule = `${randomSecond} * * * * *`
    this.#info(`schedule: ${this.#schedule}`)
  }

  start = async () => {
    process.on("SIGINT", (_signal) => {
      this.#info('receive SIGINT' + new Date())
      process.exit(0)
    })
    new CronJob(this.#schedule, this.wrapperedTask, null, true)
  }

  readonly wrapperedTask = async () => {
    if (!this.#cronLock) {
      this.#cronLock = true
      try {
        this.#info('task job starts: ' + new Date())
        await this.task()
        this.#info('task job finishes: ' + new Date())

      } catch (e) {
        this.#error('task job error: ' + e)
      } finally {
        this.#cronLock = false
      }
    }
  }

  // registered into cron job
  readonly task = async () => {

    let scanRes = await this.#scanService.scanAll()

    let addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange

    [addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange] = scanRes

    await this.handler(addXforms, removeXforms, buyXforms, sellXforms, info, pool, matcherChange)

  }

  // given an info and request to make a match job
  handler = async (
    addXforms: Array<LiquidityAddTransformation>,
    removeXforms: Array<LiquidityRemoveTransformation>,
    swapBuyforms: Array<SwapBuyTransformation>,
    swapSellXforms: Array<SwapSellTransformation>,
    info: Info,
    pool: Pool,
    matcherChange: MatcherChange,
  ) => {
    let matchRecord: MatchRecord
    // if the pool of pair is empty
    if (info.sudtReserve === 0n || info.ckbReserve === 0n) {
      if (addXforms.length == 0) {
        // have to init but no one add liquidity, have to quit

        this.#info('no add request for init liquidity')
        return
      }

      matchRecord = new MatchRecord(info, pool, matcherChange, [], [], addXforms, [])
      matchRecord.initXforms = new LiquidityInitTransformation(addXforms[0].request)
      matchRecord.addXforms = []

      this.#matcherService.initLiquidity(matchRecord)

      this.#transactionService.composeLiquidityInitTransaction(matchRecord)

    }else{
      matchRecord = new MatchRecord(
        info,
        pool,
        matcherChange,
        swapSellXforms,
        swapBuyforms,
        addXforms,
        removeXforms,
      )
      this.#matcherService.match(matchRecord)

      this.#transactionService.composeTransaction(matchRecord)
    }



    if (!matchRecord.skip) {
      let outpointsProcessed: Array<string> = []
      outpointsProcessed = outpointsProcessed.concat(matchRecord.sellXforms.map(xform => xform.request.getOutPoint()))
      outpointsProcessed = outpointsProcessed.concat(matchRecord.buyXforms.map(xform => xform.request.getOutPoint()))
      outpointsProcessed = outpointsProcessed.concat(matchRecord.addXforms.map(xform => xform.request.getOutPoint()))
      outpointsProcessed = outpointsProcessed.concat(matchRecord.removeXforms.map(xform => xform.request.getOutPoint()))

      await this.#rpcService.sendTransaction(matchRecord.composedTx!)
    }
  }
}
