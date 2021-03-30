import {inject, injectable, LazyServiceIdentifer} from 'inversify'
import {LiquidityRemoveTransformation} from '../models/transformation/liquidityRemoveTransformation'
import {LiquidityAddTransformation} from '../models/transformation/liquidityAddTransformation'
import {SwapBuyTransformation} from '../models/transformation/swapBuyTransformation'
import {MatchRecord} from '../models/matches/matchRecord'
import {SwapSellTransformation} from '../models/transformation/swapSellTransformation'
// @ts-ignore
import sqrt from 'bigint-isqrt'
import {workerLogger} from '../../utils/workerLogger'
import MonitorService from './monitorService'
import {modules} from '../../container'

@injectable()
export default class MatcherService {

    #monitorService: MonitorService

    // @ts-ignore
    #info = (outpoint: string, msg: string) => {
        workerLogger.info(`MatcherService: ${msg}`)
        this.#monitorService.update(outpoint, msg)
    }
    // @ts-ignore
    #error = (outpoint: string, msg: string) => {
        workerLogger.error(`MatcherService: ${msg}`)
        this.#monitorService.update(outpoint, msg)
    }

    constructor(
        @inject(new LazyServiceIdentifer(() => modules[MonitorService.name])) monitorService: MonitorService,
    ) {
        this.#monitorService = monitorService
    }

    /*
    Info -> Info
    Pool -> Pool
    [removeReq] -> [removeRes(Sudt-cell)]
    [addReq] -> [addRes(Lpt-cell + Sudt-change-cell)]
     */

    match = (matcheRecord: MatchRecord): void => {
        for (let sellXform of matcheRecord.sellXforms) {
            this.processSwapSellTransformation(matcheRecord, sellXform)
        }

        for (let buyXform of matcheRecord.buyXforms) {
            this.processSwapBuyTransformation(matcheRecord, buyXform)
        }

        for (let addXform of matcheRecord.addXforms) {
            this.processLiquidityAddTransformation(matcheRecord, addXform)
        }

        for (let removelXform of matcheRecord.removeXforms) {
            this.processLiquidityRemoveTransformation(matcheRecord, removelXform)
        }

        if (
            matcheRecord.sellXforms.every(xform => xform.skip) &&
            matcheRecord.buyXforms.every(xform => xform.skip) &&
            matcheRecord.removeXforms.every(xform => xform.skip) &&
            matcheRecord.addXforms.every(xform => xform.skip)
        ) {
            matcheRecord.skip = true
        } else {
            matcheRecord.matcherChange.reduceBlockMinerFee()
        }
    }

    /*
    info -> info
    pool -> pool
    matcherChange_ckb -> matcherChange_ckb
    swap_buy -> sudt

    buy = buy sudt
    ckb -> sudt
   */
    private processSwapBuyTransformation = (matchRecord: MatchRecord, swapBuyXform: SwapBuyTransformation): void => {
        // spend ckb to get sudt
        // ckb -> sudt

        // since you can not spend all ckb because we need some to hold the output sudt cell
        if (swapBuyXform.request.capacity - swapBuyXform.request.tips <= swapBuyXform.minCapacity()) {
            this.#info(swapBuyXform.request.getOutPoint(),
                'process swap buy, txHash: ' + swapBuyXform.request.outPoint.tx_hash +
                ` swapBuyXform.request.capacity ${swapBuyXform.request.capacity} - swapBuyXform.request.tips ${swapBuyXform.request.tips} <= swapBuyXform.minCapacity() ${swapBuyXform.minCapacity()}`,
            )

            swapBuyXform.skip = true
            return
        }

        // the formula is as same as before :0
        // (ckb_reserve  + spent_ckb * 99.7% ) (sudt_reserve - sudt_got) <= sudt_reserve * ckb_reserve
        // ckb_reserve * - sudt_got + spent_ckb * 99.7% * sudt_reserve + spent_ckb * 99.7% * - sudt_got <=0
        // spent_ckb * 99.7% * sudt_reserve <= ckb_reserve * sudt_got + spent_ckb * 99.7% * sudt_got
        // spent_ckb * 99.7% * sudt_reserve <= (ckb_reserve + spent_ckb * 99.7% )* sudt_got
        // spent_ckb * 997 * sudt_reserve <= (ckb_reserve * 1000 + spent_ckb * 997 )* sudt_got
        // sudt_got >= spent_ckb * 997 * sudt_reserve / (ckb_reserve * 1000 + spent_ckb * 997 )

        let ckbIn = swapBuyXform.request.capacity - swapBuyXform.request.tips - swapBuyXform.minCapacity()

        let sudtGot =
            (ckbIn * 997n * matchRecord.info.sudtReserve) / (matchRecord.info.ckbReserve * 1000n + ckbIn * 997n) + 1n

        if (sudtGot < swapBuyXform.request.amountOutMin) {
            this.#info(swapBuyXform.request.getOutPoint(),
                'process swap buy, txHash: ' + swapBuyXform.request.outPoint.tx_hash +
                ` sudtGot ${sudtGot}< swapBuyXform.request.amountOutMin ${swapBuyXform.request.amountOutMin}`)

            swapBuyXform.skip = true
            return
        }

        if (matchRecord.info.sudtReserve < sudtGot) {
            this.#info(swapBuyXform.request.getOutPoint(),
                'process swap buy, txHash: ' + swapBuyXform.request.outPoint.tx_hash +
                ` matchRecord.info.sudtReserve ${matchRecord.info.sudtReserve} < sudtGot ${sudtGot}`)

            swapBuyXform.skip = true
            return
        }

        // flush the result into Xform
        swapBuyXform.sudtAmount = sudtGot

        // update context of matchRecord
        // matcher get tips
        matchRecord.matcherChange.capacity += swapBuyXform.request.tips

        // then all ckb, include of 0.3% as liquidity provider interest, goes into pool
        matchRecord.info.ckbReserve += ckbIn
        matchRecord.info.sudtReserve -= sudtGot

        matchRecord.pool.capacity += ckbIn
        matchRecord.pool.sudtAmount -= sudtGot
    }

    /*
    info -> info
    pool -> pool
    matcherChange_ckb -> matcherChange_ckb
    swap_sell -> ckb

    sell = sell sudt
    sudt -> ckb
    */
    private processSwapSellTransformation = (matchRecord: MatchRecord, swapSellXform: SwapSellTransformation): void => {
        // spend sudt to get ckb
        // sudt -> ckb

        // (sudt_reserve + spent_sudt * 99.7%)(ckb_reserve - ckb_got) <= sudt_reserve * ckb_reserve
        // sudt_reserve * - ckb_got + spent_sudt * 99.7% * ckb_reserve + spent_sudt * 99.7% * - ckb_got <=0
        // spent_sudt * 99.7% * ckb_reserve <= sudt_reserve * ckb_got + spent_sudt * 99.7% * ckb_got
        // spent_sudt * 99.7% * ckb_reserve <= (sudt_reserve + spent_sudt * 99.7% )* ckb_got
        // spent_sudt * 997 * ckb_reserve <= (sudt_reserve * 1000 + spent_sudt * 997 )* ckb_got
        // ckb_got >= spent_sudt * 997 * ckb_reserve / (sudt_reserve * 1000 + spent_sudt * 997 )

        let ckbOut: bigint =
            (swapSellXform.request.sudtAmount * 997n * matchRecord.info.ckbReserve) /
            (matchRecord.info.sudtReserve * 1000n + swapSellXform.request.sudtAmount * 997n) +
            1n

        if (ckbOut < swapSellXform.request.amountOutMin) {
            this.#info(swapSellXform.request.getOutPoint(),
                'process swap sell, txHash: ' + swapSellXform.request.outPoint.tx_hash +
                ` ckbOut ${ckbOut} < swapSellXform.request.amountOutMin ${swapSellXform.request.amountOutMin}`)

            swapSellXform.skip = true
            return
        }

        if (
            ckbOut + swapSellXform.request.capacity <
            swapSellXform.minCapacity() + swapSellXform.request.tips
        ) {
            this.#info(swapSellXform.request.getOutPoint(),
                'process swap sell, txHash: ' + swapSellXform.request.outPoint.tx_hash +
                ` ckbOut ${ckbOut} + swapSellXform.request.capacity ${swapSellXform.request.capacity}<  swapSellXform.minCapacity() ${swapSellXform.minCapacity()} + swapSellXform.request.tips ${swapSellXform.request.tips}`,
            )

            swapSellXform.skip = true
            return
        }

        swapSellXform.capacity = ckbOut + swapSellXform.request.capacity - swapSellXform.request.tips

        if (swapSellXform.capacity < swapSellXform.minCapacity()) {
            this.#info(swapSellXform.request.getOutPoint(),
                'process swap sell, txHash: ' + swapSellXform.request.outPoint.tx_hash +
                ` swapSellXform.capacity ${swapSellXform.capacity}< swapSellXform.minCapacity() ${swapSellXform.minCapacity()}`,
            )
        }

        if (matchRecord.info.ckbReserve < ckbOut) {
            this.#info(swapSellXform.request.getOutPoint(),
                'process swap sell, txHash: ' + swapSellXform.request.outPoint.tx_hash +
                ` matchRecord.info.ckbReserve ${matchRecord.info.ckbReserve} < ckbOut ${ckbOut}`,
            )
        }

        matchRecord.matcherChange.capacity += swapSellXform.request.tips

        // then all remaining sudtChangeAmount, include of 0.3% as liquidity provider interest, goes into pool
        matchRecord.info.sudtReserve += swapSellXform.request.sudtAmount
        matchRecord.info.ckbReserve -= ckbOut

        matchRecord.pool.sudtAmount += swapSellXform.request.sudtAmount
        matchRecord.pool.capacity -= ckbOut
    }

    /*
      total lpt            total sudtChangeAmount          total ckb
   ---------------  =  ----------------- =  ----------------
    withdrawn lpt        withdrawn sudtChangeAmount?      withdrawn ckb?

    LiquidityRemoveReq -> Sudt + Ckb
   */
    private processLiquidityRemoveTransformation = (
        matchRecord: MatchRecord,
        liquidityRemoveXform: LiquidityRemoveTransformation,
    ): void => {
        let withdrawnSudt =
            (liquidityRemoveXform.request.lptAmount * matchRecord.info.sudtReserve) / matchRecord.info.totalLiquidity + 1n
        let withdrawnCkb =
            (liquidityRemoveXform.request.lptAmount * matchRecord.info.ckbReserve) / matchRecord.info.totalLiquidity + 1n

        if (withdrawnSudt < liquidityRemoveXform.request.sudtMin || withdrawnCkb < liquidityRemoveXform.request.ckbMin) {
            this.#info(liquidityRemoveXform.request.getOutPoint(),
                'process liquidity remove, txHash: ' + liquidityRemoveXform.request.outPoint.tx_hash +
                `withdrawnSudt ${withdrawnSudt}< liquidityRemoveXform.request.sudtMin ${liquidityRemoveXform.request.sudtMin} || withdrawnCkb ${withdrawnCkb}< liquidityRemoveXform.request.ckbMin ${liquidityRemoveXform.request.ckbMin}`,
            )

            liquidityRemoveXform.skip = true
            return
        }

        if (
            liquidityRemoveXform.request.capacityAmount + withdrawnCkb <
            liquidityRemoveXform.minCapacity() + liquidityRemoveXform.request.tips
        ) {
            this.#info(liquidityRemoveXform.request.getOutPoint(),
                'process liquidity remove, txHash: ' + liquidityRemoveXform.request.outPoint.tx_hash +
                ` liquidityRemoveXform.request.capacityAmount ${liquidityRemoveXform.request.capacityAmount} + withdrawnCkb ${withdrawnCkb} < liquidityRemoveXform.minCapacity() ${liquidityRemoveXform.minCapacity()} + liquidityRemoveXform.request.tips ${liquidityRemoveXform.request.tips}`,
            )

            liquidityRemoveXform.skip = true
            return
        }

        if (matchRecord.info.ckbReserve < withdrawnCkb || matchRecord.pool.sudtAmount < withdrawnSudt) {
            this.#info(liquidityRemoveXform.request.getOutPoint(),
                'process liquidity remove, txHash: ' + liquidityRemoveXform.request.outPoint.tx_hash +
                `matchRecord.info.ckbReserve ${matchRecord.info.ckbReserve} < withdrawnCkb ${withdrawnCkb} || matchRecord.pool.sudtAmount ${matchRecord.pool.sudtAmount} < withdrawnSudt ${withdrawnSudt}`,
            )

            liquidityRemoveXform.skip = true
            return
        }

        matchRecord.matcherChange.capacity += liquidityRemoveXform.request.tips

        liquidityRemoveXform.sudtAmount = withdrawnSudt
        liquidityRemoveXform.capacityAmount =
            liquidityRemoveXform.request.capacityAmount + withdrawnCkb - liquidityRemoveXform.request.tips

        // update info
        matchRecord.info.ckbReserve -= withdrawnCkb
        matchRecord.info.sudtReserve -= withdrawnSudt

        matchRecord.info.totalLiquidity -= liquidityRemoveXform.request.lptAmount

        // update pool
        matchRecord.pool.sudtAmount -= withdrawnSudt
        matchRecord.pool.capacity -= withdrawnCkb
    }

    /*
     total ckb         add ckb
    -------------  =  ----------
     total sudt        add sudt

       total lpt       total ckb
     ------------  =  -----------
      return lpt?       add ckb
     LiquidityAddReq -> Lpt(size is fixed if script is determined) + change(size is fixed if script is determined)
    */
    private processLiquidityAddTransformation = (
        matchRecord: MatchRecord,
        liquidityAddXform: LiquidityAddTransformation,
    ): void => {
        // first we try to use all available and have to has sudt cell to keep the change
        let ckbAvailable =
            liquidityAddXform.request.capacityAmount -
            liquidityAddXform.request.tips -
            liquidityAddXform.minCapacity('sudt')

        if (ckbAvailable <= 0n) {
            this.#info(liquidityAddXform.request.getOutPoint(),
                'process liquidity add, txHash: ' + liquidityAddXform.request.outPoint.tx_hash +
                ` ckbAvailable ${ckbAvailable} <= 0n}`)

            liquidityAddXform.skip = true
            return
        }

        let sudtNeeded = (ckbAvailable * matchRecord.info.sudtReserve) / matchRecord.info.ckbReserve + 1n

        if (sudtNeeded < liquidityAddXform.request.sudtAmount) {
            // exhaust all available ckb and sudt remains
            if (sudtNeeded < liquidityAddXform.request.sudtMin || ckbAvailable < liquidityAddXform.request.ckbMin) {
                this.#info(liquidityAddXform.request.getOutPoint(),
                    'process liquidity add, exhaust all ckb, txHash: ' + liquidityAddXform.request.outPoint.tx_hash +
                    ` sudtNeeded ${sudtNeeded} < liquidityAddXform.request.sudtMin ${liquidityAddXform.request.sudtMin}|| ckbAvailable ${ckbAvailable}< liquidityAddXform.request.ckbMin ${liquidityAddXform.request.ckbMin}`,
                )

                liquidityAddXform.skip = true
                return
            }

            // OK, we use all ckb we can use and sudt remains
            let lptGot = (matchRecord.info.totalLiquidity * ckbAvailable) / matchRecord.info.ckbReserve + 1n

            matchRecord.matcherChange.capacity += liquidityAddXform.request.tips

            // of cause, because we drain all available ckbs and only leave these for hold cells
            liquidityAddXform.capacityChangeAmount = liquidityAddXform.minCapacity('sudt')
            liquidityAddXform.sudtChangeAmount = liquidityAddXform.request.sudtAmount - sudtNeeded
            liquidityAddXform.lptAmount = lptGot

            // update info
            matchRecord.info.ckbReserve += ckbAvailable
            matchRecord.info.sudtReserve += sudtNeeded

            matchRecord.info.totalLiquidity += lptGot

            matchRecord.pool.capacity += ckbAvailable
            matchRecord.pool.sudtAmount += sudtNeeded
        } else {
            // sudt is not enough, we drain all sudts and ckb remain

            let ckbNeeded =
                (liquidityAddXform.request.sudtAmount * matchRecord.info.ckbReserve) / matchRecord.info.sudtReserve + 1n

            if (
                liquidityAddXform.request.sudtAmount < liquidityAddXform.request.sudtMin ||
                ckbNeeded < liquidityAddXform.request.ckbMin
            ) {
                this.#info(liquidityAddXform.request.getOutPoint(),
                    'process liquidity add, exhaust all sudt, txHash: ' + liquidityAddXform.request.outPoint.tx_hash +
                    ` liquidityAddXform.request.sudtAmount ${liquidityAddXform.request.sudtAmount} < liquidityAddXform.request.sudtMin ${liquidityAddXform.request.sudtMin}|| ckbNeeded ${ckbNeeded}< liquidityAddXform.request.ckbMin ${liquidityAddXform.request.ckbMin}`,
                )

                liquidityAddXform.skip = true
                return
            }

            const ckbLeft = liquidityAddXform.request.capacityAmount - liquidityAddXform.request.tips - ckbNeeded

            // remaining ckbs should be enough to compose lpt cell and ckb cell
            if (ckbLeft < liquidityAddXform.minCapacity('ckb')) {
                // this shouldn't happens
                this.#info(liquidityAddXform.request.getOutPoint(),
                    'process liquidity add, exhaust all sudt, txHash: ' + liquidityAddXform.request.outPoint.tx_hash +
                    ` ckbLeft ${ckbLeft}< Ckb.CKB_FIXED_MIN_CAPACITY + Lpt.LPT_FIXED_CAPACITY`)

                liquidityAddXform.skip = true
                return
            }

            let lptGot = (matchRecord.info.totalLiquidity * liquidityAddXform.request.sudtAmount) / matchRecord.info.sudtReserve + 1n

            matchRecord.matcherChange.capacity += liquidityAddXform.request.tips

            // of cause, because we drain all available ckbs and only leave these for hold cells
            liquidityAddXform.capacityChangeAmount = ckbLeft
            liquidityAddXform.sudtChangeAmount = 0n
            liquidityAddXform.lptAmount = lptGot

            // update info
            matchRecord.info.ckbReserve += ckbNeeded
            matchRecord.info.sudtReserve += liquidityAddXform.request.sudtAmount

            matchRecord.info.totalLiquidity += lptGot

            matchRecord.pool.capacity += ckbNeeded
            matchRecord.pool.sudtAmount += liquidityAddXform.request.sudtAmount
        }
    }

    // req -> lpt
    initLiquidity = (matchRecord: MatchRecord): void => {
        let liquidityInitXform = matchRecord.initXforms!

        let ckbAvailable =
            liquidityInitXform.request.capacityAmount -
            liquidityInitXform.request.tips -
            liquidityInitXform.minCapacity()

        let lptMinted = sqrt(ckbAvailable * liquidityInitXform.request.sudtAmount)

        liquidityInitXform.lptAmount = lptMinted

        matchRecord.matcherChange.capacity += liquidityInitXform.request.tips

        // update info
        matchRecord.info.ckbReserve += ckbAvailable
        matchRecord.info.sudtReserve += liquidityInitXform.request.sudtAmount

        matchRecord.info.totalLiquidity += lptMinted

        matchRecord.pool.capacity += ckbAvailable
        matchRecord.pool.sudtAmount += liquidityInitXform.request.sudtAmount

        matchRecord.matcherChange.reduceBlockMinerFee()
    }
}
