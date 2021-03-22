import {inject, injectable, LazyServiceIdentifer} from 'inversify'
import {CronJob} from 'cron'
import {modules} from '../../container'
import {workerLogger} from '../../utils/workerLogger'
import ScanService from './scanService'
import RpcService from './rpcService'
import MatcherService from './matcherService'
import TransactionService from './transactionService'
import {Info} from '../models/cells/info'
import {PoolX} from '../models/cells/poolX'
import {MatcherChange} from '../models/cells/matcherChange'
import {LiquidityAddTransformation} from '../models/transformation/liquidityAddTransformation'
import {LiquidityRemoveTransformation} from '../models/transformation/liquidityRemoveTransformation'
import {SwapBuyTransformation} from '../models/transformation/swapBuyTransformation'
import {MatchRecord} from '../models/matches/matchRecord'
import {SwapSellTransformation} from '../models/transformation/swapSellTransformation'
import {LiquidityInitTransformation} from '../models/transformation/liquidityInitTransformation'
import JSONbig from 'json-bigint'
import {PoolY} from "../models/cells/poolY";
import process from 'process'

// @ts-ignore
const jsonbig = JSONbig({useNativeBigInt: true, alwaysParseAsBig: true})


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

                //process.exit(0)

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
        // step 1, get latest info cell and scan all reqs

        // step 2
        // 1. if the latest (committed) info cell is not in the 'Sent' deal, which means we are cut off.
        // thus get ALL deal tx -> a. if deal tx is committed, update it as committed,
        //                         b. if deal tx is missing, of cause because we are cut off, update it as CutOff
        //                      -> then base on the latest info cell to do match job
        // note that the cell collector is not atomic, thus the req may be not sync-ed with latest info cell and
        // pool cell. we are based on info cell and pool cells, bear the possibility of missing req cells
        //
        //
        // 2. if the latest info cell is in the 'Sent' deal, which means we dominate,
        // thus we should check all sent txs in the database. for all sent txs in time order
        //   -> if all request in a txs is still available on chain, we resend the tx
        //   -> if at least one of the request is missing, which means client cancelled the request,
        //      we should drop the tx and txs follows it, and then do a new matching job
        // at last, if all txs is fine and re-send and there has more requests left, do a new matching job
        // thus set all previous deal tx to committed, as the state transfer make sure that they must be committed
        // and then based on the last 'Sent' deal tx, do match job.
        // Do re-send the 'Sent' deal txs in case of they are somehow dropped by miner. we could ignore pending state
        // and force re-send again :)

        let scanRes = await this.#scanService.scanAll()
        // console.log('scanRes: '+JSONbig.stringify(scanRes))
        let addXforms, removeXforms, buyXforms, sellXforms, info, poolX, poolY, matcherChange

        [addXforms, removeXforms, buyXforms, sellXforms, info, poolX, poolY, matcherChange] = scanRes
        await this.handler(addXforms, removeXforms, buyXforms, sellXforms, info, poolX, poolY, matcherChange)
    }

    // given an info and request to make a match job
    handler = async (
        addXforms: Array<LiquidityAddTransformation>,
        removeXforms: Array<LiquidityRemoveTransformation>,
        swapBuyforms: Array<SwapBuyTransformation>,
        swapSellXforms: Array<SwapSellTransformation>,
        info: Info,
        poolX: PoolX,
        poolY: PoolY,
        matcherChange: MatcherChange,
    ) => {
        let matchRecord: MatchRecord
        // if the pool of pair is empty
        if (info.sudtXReserve === 0n || info.sudtYReserve === 0n) {
            if (addXforms.length == 0) {
                // have to init but no one add liquidity, have to quit

                this.#info('no add request for init liquidity')
                return
            }

            matchRecord = new MatchRecord(info, poolX, poolY, matcherChange, [], [], addXforms, [])
            matchRecord.initXforms = new LiquidityInitTransformation(addXforms[0].request)
            matchRecord.addXforms = []

            this.#matcherService.initLiquidity(matchRecord)

            this.#transactionService.composeLiquidityInitTransaction(matchRecord)

        } else {
            matchRecord = new MatchRecord(
                info,
                poolX,
                poolY,
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
