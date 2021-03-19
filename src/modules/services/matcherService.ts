import {inject, injectable, LazyServiceIdentifer} from 'inversify'
import {LiquidityRemoveTransformation} from '../models/transformation/liquidityRemoveTransformation'
import {ChangeType, LiquidityAddTransformation} from '../models/transformation/liquidityAddTransformation'
import {SwapBuyTransformation} from '../models/transformation/swapBuyTransformation'
import {MatchRecord} from '../models/matches/matchRecord'
import {SwapSellTransformation} from '../models/transformation/swapSellTransformation'
// @ts-ignore
import sqrt from 'bigint-isqrt'
import {logger} from '../../utils/logger'
import MonitorService from './monitorService'
import {modules} from '../../container'

@injectable()
export default class MatcherService {

    #monitorService: MonitorService

    // @ts-ignore
    #info = (outpoint: string, msg: string) => {
        logger.info(`MatcherService: ${msg}`)
        this.#monitorService.update(outpoint, msg)
    }
    // @ts-ignore
    #error = (outpoint: string, msg: string) => {
        logger.error(`MatcherService: ${msg}`)
        this.#monitorService.update(outpoint, msg)
    }

    constructor(
        @inject(new LazyServiceIdentifer(() => modules[MonitorService.name])) monitorService: MonitorService,
    ) {
        this.#monitorService = monitorService
    }

    /*
    Info -> Info
    PoolX -> PoolX
    [removeReq] -> [removeRes(SudtX-cell)]
    [addReq] -> [addRes(Lpt-cell + SudtX-change-cell)]
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
    poolx -> poolx
    pooly -> pooly
    matcherChange_ckb -> matcherChange_ckb


    [swap_request_cell]                     [sudt_y_cell
                                            + ckb_change_cell]

                                            matcher_out_sudt_x?
    sudt_x -> sudt_y
   */
    private processSwapBuyTransformation = (matchRecord: MatchRecord, swapBuyXform: SwapBuyTransformation): void => {
        // sudt_x -> sudt_y

        if (swapBuyXform.request.capacity - swapBuyXform.request.tips <= swapBuyXform.minCapacity()) {
            this.#info(swapBuyXform.request.getOutPoint(),
                'process swap buy, txHash: ' + swapBuyXform.request.outPoint.tx_hash +
                ` swapBuyXform.request.capacity ${swapBuyXform.request.capacity} - swapBuyXform.request.tips ${swapBuyXform.request.tips} <= swapBuyXform.minCapacity() ${swapBuyXform.minCapacity()}`,
            )

            swapBuyXform.skip = true
            return
        }

        if (swapBuyXform.request.sudtXInAmount - swapBuyXform.request.tips_sudt < 0) {
            this.#info(swapBuyXform.request.getOutPoint(),
                'process swap buy, txHash: ' + swapBuyXform.request.outPoint.tx_hash +
                ` swapBuyXform.request.sudtInAmount ${swapBuyXform.request.sudtXInAmount} - swapBuyXform.request.tips_sudt ${swapBuyXform.request.tips_sudt} < 0`,
            )

            swapBuyXform.skip = true
            return
        }

        // the formula is as same as before :0
        // (x_reserve  + spent_x * 99.7% ) (y_reserve - y_got) <= y_reserve * x_reserve
        // x_reserve * - y_got + spent_x * 99.7% * y_reserve + spent_x * 99.7% * - y_got <=0
        // spent_x * 99.7% * y_reserve <= x_reserve * y_got + spent_x * 99.7% * y_got
        // spent_x * 99.7% * y_reserve <= (x_reserve + spent_x * 99.7% )* y_got
        // spent_x * 997 * y_reserve <= (x_reserve * 1000 + spent_x * 997 )* y_got
        // y_got >= spent_x * 997 * y_reserve / (x_reserve * 1000 + spent_x * 997 )

        let xIn = swapBuyXform.request.sudtXInAmount - swapBuyXform.request.tips_sudt

        let yGot =
            (xIn * 997n * matchRecord.info.sudtYReserve) / (matchRecord.info.sudtXReserve * 1000n + xIn * 997n) + 1n

        if (yGot < swapBuyXform.request.amountOutMin) {
            this.#info(swapBuyXform.request.getOutPoint(),
                'process swap buy, txHash: ' + swapBuyXform.request.outPoint.tx_hash +
                ` yGot ${yGot}< swapBuyXform.request.amountOutMin ${swapBuyXform.request.amountOutMin}`)

            swapBuyXform.skip = true
            return
        }


        matchRecord.matcherChange.capacity += swapBuyXform.request.tips
        // skipt sudt change

        // flush the result into Xform
        swapBuyXform.sudtYAmount = yGot
        swapBuyXform.ckbChangeAmount = swapBuyXform.request.capacity - swapBuyXform.request.tips

        // update info
        matchRecord.info.sudtXReserve += xIn
        matchRecord.info.sudtYReserve -= yGot

        matchRecord.poolX.sudtAmount += xIn
        matchRecord.poolY.sudtAmount -= yGot
    }

    /*
    info -> info
    poolx -> poolx
    pooly -> pooly
    matcherChange_ckb -> matcherChange_ckb

    [swap_request_cell]                     [sudt_x_cell
                                            + ckb_change_cell]

                                            matcher_out_sudt_y?
    sudt_y -> sudt_x
    */
    private processSwapSellTransformation = (matchRecord: MatchRecord, swapSellXform: SwapSellTransformation): void => {
        // sudt_y -> sudt_x

        if (swapSellXform.request.capacity - swapSellXform.request.tips <= swapSellXform.minCapacity()) {
            this.#info(swapSellXform.request.getOutPoint(),
                'process swap sell, txHash: ' + swapSellXform.request.outPoint.tx_hash +
                ` swapSellXform.request.capacity ${swapSellXform.request.capacity} - swapSellXform.request.tips ${swapSellXform.request.tips} <= swapSellXform.minCapacity() ${swapSellXform.minCapacity()}`,
            )

            swapSellXform.skip = true
            return
        }

        if (swapSellXform.request.sudtYInAmount - swapSellXform.request.tips_sudt < 0) {
            this.#info(swapSellXform.request.getOutPoint(),
                'process swap sell, txHash: ' + swapSellXform.request.outPoint.tx_hash +
                ` swapSellXform.request.sudtYInAmount ${swapSellXform.request.sudtYInAmount} - swapSellXform.request.tips_sudt ${swapSellXform.request.tips_sudt} < 0`,
            )

            swapSellXform.skip = true
            return
        }

        // (y_reserve + spent_y * 99.7%)(x_reserve - x_got) <= y_reserve * x_reserve
        // y_reserve * - x_got + spent_y * 99.7% * x_reserve + spent_y * 99.7% * - x_got <=0
        // spent_y * 99.7% * x_reserve <= y_reserve * x_got + spent_y * 99.7% * x_got
        // spent_y * 99.7% * x_reserve <= (y_reserve + spent_y * 99.7% )* x_got
        // spent_y * 997 * x_reserve <= (y_reserve * 1000 + spent_y * 997 )* x_got
        // x_got >= spent_y * 997 * x_reserve / (y_reserve * 1000 + spent_y * 997 )

        let yIn = swapSellXform.request.sudtYInAmount - swapSellXform.request.tips_sudt

        let xGot =
            (yIn * 997n * matchRecord.info.sudtXReserve) / (matchRecord.info.sudtYReserve * 1000n + yIn * 997n) + 1n

        if (xGot < swapSellXform.request.amountOutMin) {
            this.#info(swapSellXform.request.getOutPoint(),
                'process swap sell, txHash: ' + swapSellXform.request.outPoint.tx_hash +
                ` xGot ${xGot}< swapSellXform.request.amountOutMin ${swapSellXform.request.amountOutMin}`)

            swapSellXform.skip = true
            return
        }


        matchRecord.matcherChange.capacity += swapSellXform.request.tips

        // flush the result into Xform
        swapSellXform.sudtXAmount = xGot
        swapSellXform.ckbChangeAmount = swapSellXform.request.capacity - swapSellXform.request.tips


        // update info
        matchRecord.info.sudtXReserve -= xGot
        matchRecord.info.sudtYReserve += yIn

        matchRecord.poolX.sudtAmount -= xGot
        matchRecord.poolY.sudtAmount += yIn
    }

    /*
      total lpt            total sudtChangeAmount          total ckb
   ---------------  =  ----------------- =  ----------------
    withdrawn lpt        withdrawn sudtChangeAmount?      withdrawn ckb?


    [remove_liquidity_cell]                 [sudt_x_cell
                                         + sudt_y_cell]

                                         + matcher_out_sudt_lp?
   */
    private processLiquidityRemoveTransformation = (
        matchRecord: MatchRecord,
        liquidityRemoveXform: LiquidityRemoveTransformation,
    ): void => {

        if (liquidityRemoveXform.request.lptAmount - liquidityRemoveXform.request.tipsLp <= 0) {
            this.#info(liquidityRemoveXform.request.getOutPoint(),
                'process liquidity remove, txHash: ' + liquidityRemoveXform.request.outPoint.tx_hash +
                `liquidityRemoveXform.request.lptAmount ${liquidityRemoveXform.request.lptAmount} - liquidityRemoveXform.request.tipsLp ${liquidityRemoveXform.request.tipsLp} < 0`,
            )

            liquidityRemoveXform.skip = true
            return
        }

        let lptIn = liquidityRemoveXform.request.lptAmount - liquidityRemoveXform.request.tipsLp

        let withdrawnSudtX =
            (lptIn * matchRecord.info.sudtXReserve) / matchRecord.info.totalLiquidity + 1n
        let withdrawnSudtY =
            (lptIn * matchRecord.info.sudtYReserve) / matchRecord.info.totalLiquidity + 1n

        if (withdrawnSudtX < liquidityRemoveXform.request.sudtXMin || withdrawnSudtY < liquidityRemoveXform.request.sudtYMin) {
            this.#info(liquidityRemoveXform.request.getOutPoint(),
                'process liquidity remove, txHash: ' + liquidityRemoveXform.request.outPoint.tx_hash +
                `withdrawnSudtX ${withdrawnSudtX} < liquidityRemoveXform.request.sudtXMin ${liquidityRemoveXform.request.sudtXMin} || withdrawnSudtY ${withdrawnSudtY} < liquidityRemoveXform.request.sudtYMin ${liquidityRemoveXform.request.sudtYMin}`,
            )

            liquidityRemoveXform.skip = true
            return
        }


        // we don't accept ckb change
        if (liquidityRemoveXform.request.capacity - liquidityRemoveXform.request.tips != liquidityRemoveXform.minCapacity()) {
            this.#info(liquidityRemoveXform.request.getOutPoint(),
                'process liquidity remove, txHash: ' + liquidityRemoveXform.request.outPoint.tx_hash +
                ` liquidityRemoveXform.request.capacity ${liquidityRemoveXform.request.capacity} - liquidityRemoveXform.request.tips ${liquidityRemoveXform.request.tips} != liquidityRemoveXform.minCapacity() ${liquidityRemoveXform.minCapacity()} + liquidityRemoveXform.request.tips ${liquidityRemoveXform.request.tips}`,
            )

            liquidityRemoveXform.skip = true
            return
        }

        matchRecord.matcherChange.capacity += liquidityRemoveXform.request.tips
        //skip lpt change now

        liquidityRemoveXform.sudtXAmount = withdrawnSudtX
        liquidityRemoveXform.sudtYAmount = withdrawnSudtY

        // update info
        matchRecord.info.sudtXReserve -= withdrawnSudtX
        matchRecord.info.sudtYReserve -= withdrawnSudtY

        matchRecord.info.totalLiquidity -= liquidityRemoveXform.request.lptAmount

        // update pool
        matchRecord.poolX.sudtAmount -= withdrawnSudtX
        matchRecord.poolY.sudtAmount -= withdrawnSudtY
    }

    /*
        total x         add x
    -------------  =  ----------
        total y         add y

       total lpt        total x or y
     ------------  =  ---------------
      return lpt?       add x or y

     [ add_liquidity_x_cell                  [sudt_lp_cell
     + add_liquidity_y_cell                 + sudt_change_cell x or y
                                            + ckb_change_cell]

                                            matcher_out_sudt_x?
                                            matcher_out_sudt_y?
    */
    private processLiquidityAddTransformation = (
        matchRecord: MatchRecord,
        liquidityAddXform: LiquidityAddTransformation,
    ): void => {

        if (liquidityAddXform.request.sudtXAmount - liquidityAddXform.request.tipsSudtX <= 0) {
            this.#info(liquidityAddXform.request.getOutPoint(),
                'process liquidity add, txHash: ' + liquidityAddXform.request.outPointX.tx_hash +
                `liquidityAddXform.request.sudtXAmount ${liquidityAddXform.request.sudtXAmount} - liquidityAddXform.request.tipsSudtX ${liquidityAddXform.request.tipsSudtX} <= 0`,
            )

            liquidityAddXform.skip = true
            return
        }

        if (liquidityAddXform.request.sudtYAmount - liquidityAddXform.request.tipsSudtY <= 0) {
            this.#info(liquidityAddXform.request.getOutPoint(),
                'process liquidity add, txHash: ' + liquidityAddXform.request.outPointX.tx_hash +
                `liquidityAddXform.request.sudtYAmount ${liquidityAddXform.request.sudtYAmount} - liquidityAddXform.request.tipsSudtY ${liquidityAddXform.request.tipsSudtY} <= 0`,
            )

            liquidityAddXform.skip = true
            return
        }

        let xIn = liquidityAddXform.request.sudtXAmount - liquidityAddXform.request.tipsSudtX
        let yIn = liquidityAddXform.request.sudtYAmount - liquidityAddXform.request.tipsSudtY

        let lptGot = 0n
        let xUsed = 0n
        let yUsed = 0n
        let xChange = 0n
        let yChange = 0n
        let changeType : ChangeType = 'x'
        //first we try to exhaust x
        let yNeed = xIn * matchRecord.info.sudtYReserve / matchRecord.info.sudtXReserve + 1n
        if(yNeed <= yIn){
            // exhaust x and y remains
            lptGot = xIn * matchRecord.info.totalLiquidity  / matchRecord.info.sudtXReserve + 1n
            xUsed = xIn
            yUsed = yNeed
            // if yChange === 0 , empty sudt cell will be composed
            yChange = yIn - yNeed
            changeType = 'y'
        }else{
            // exhaust y and x remains

            let xNeed = yIn * matchRecord.info.sudtXReserve / matchRecord.info.sudtYReserve + 1n
            lptGot = yIn * matchRecord.info.totalLiquidity  / matchRecord.info.sudtYReserve + 1n
            xUsed = xNeed
            yUsed = yIn
            xChange = xIn - xNeed
            changeType = 'x'

            // if xChange === 0 , empty sudt cell will be composed
            // if xChange <0, which is really rare, the case return
            if(xChange <0){
                this.#info(liquidityAddXform.request.getOutPoint(),
                    'process liquidity add, txHash: ' + liquidityAddXform.request.outPointX.tx_hash +
                    `calce both side yNedd > yIn and xChange < 0, the case is really rare`,
                )

                liquidityAddXform.skip = true
                return
            }
        }


        if(liquidityAddXform.request.capacity - liquidityAddXform.request.tips < liquidityAddXform.minCapacity(changeType)){
            this.#info(liquidityAddXform.request.getOutPoint(),
                'process liquidity add, txHash: ' + liquidityAddXform.request.outPointX.tx_hash +
                `liquidityAddXform.request.capacity ${liquidityAddXform.request.capacity} - liquidityAddXform.request.tips ${liquidityAddXform.request.tips} < liquidityAddXform.minCapacity(changeType) ${liquidityAddXform.minCapacity(changeType)}`,
            )

            liquidityAddXform.skip = true
            return
        }

        if( xUsed < liquidityAddXform.request.sudtXMin){
            this.#info(liquidityAddXform.request.getOutPoint(),
                'process liquidity add, txHash: ' + liquidityAddXform.request.outPointX.tx_hash +
                `xUsed ${xUsed} < liquidityAddXform.request.sudtXMin ${liquidityAddXform.request.sudtXMin}`,
            )
            liquidityAddXform.skip = true
            return
        }
        if( yUsed < liquidityAddXform.request.sudtYMin){
            this.#info(liquidityAddXform.request.getOutPoint(),
                'process liquidity add, txHash: ' + liquidityAddXform.request.outPointX.tx_hash +
                `yUsed ${yUsed} < liquidityAddXform.request.sudtYMin ${liquidityAddXform.request.sudtYMin}`,
            )
            liquidityAddXform.skip = true
            return
        }


        matchRecord.matcherChange.capacity += liquidityAddXform.request.tips
        // skip to deal sudt x or y change

        liquidityAddXform.ckbChangeAmount = liquidityAddXform.request.capacity - liquidityAddXform.request.tips

        liquidityAddXform.sudtXChangeAmount = xChange
        liquidityAddXform.sudtYChangeAmount = yChange

        liquidityAddXform.lptAmount = lptGot

        // update info
        matchRecord.info.sudtXReserve += xUsed
        matchRecord.info.sudtYReserve += yUsed

        matchRecord.info.totalLiquidity += lptGot

        matchRecord.poolX.sudtAmount += xUsed
        matchRecord.poolY.sudtAmount += yUsed

    }

    // req -> lpt
    /*
    req_sudt_x_cell             sudt_lp_cell
    req_sudt_y_cell             ckb_change_cell

                                matcher_out_sudt_x?
                                matcher_out_sudt_y?
     */
    initLiquidity = (matchRecord: MatchRecord): void => {
        let liquidityInitXform = matchRecord.initXforms!

        if (liquidityInitXform.request.sudtXAmount - liquidityInitXform.request.tipsSudtX <= 0) {
            this.#info(liquidityInitXform.request.getOutPoint(),
                'process liquidity init, txHash: ' + liquidityInitXform.request.outPointX.tx_hash +
                `liquidityInitXform.request.sudtXAmount ${liquidityInitXform.request.sudtXAmount} - liquidityInitXform.request.tipsSudtX ${liquidityInitXform.request.tipsSudtX} <= 0`,
            )

            liquidityInitXform.skip = true
            return
        }

        if (liquidityInitXform.request.sudtYAmount - liquidityInitXform.request.tipsSudtY <= 0) {
            this.#info(liquidityInitXform.request.getOutPoint(),
                'process liquidity init, txHash: ' + liquidityInitXform.request.outPointX.tx_hash +
                `liquidityInitXform.request.sudtYAmount ${liquidityInitXform.request.sudtYAmount} - liquidityInitXform.request.tipsSudtY ${liquidityInitXform.request.tipsSudtY} <= 0`,
            )

            liquidityInitXform.skip = true
            return
        }

        let xIn = liquidityInitXform.request.sudtXAmount - liquidityInitXform.request.tipsSudtX
        let yIn = liquidityInitXform.request.sudtYAmount - liquidityInitXform.request.tipsSudtY

        let ckbChange = liquidityInitXform.request.capacity - liquidityInitXform.request.tips
        if(ckbChange < liquidityInitXform.minCapacity()){
            this.#info(liquidityInitXform.request.getOutPoint(),
                'process liquidity init, txHash: ' + liquidityInitXform.request.outPointX.tx_hash +
                `liquidityInitXform.request.capacity ${liquidityInitXform.request.capacity} - liquidityInitXform.request.tips ${liquidityInitXform.request.tips} < liquidityInitXform.minCapacity() ${liquidityInitXform.minCapacity()}`,
            )

            liquidityInitXform.skip = true
            return
        }

        let lptMinted = sqrt(xIn * yIn)

        matchRecord.matcherChange.capacity += liquidityInitXform.request.tips
        // skip sudt x or y change


        liquidityInitXform.lptAmount = lptMinted
        liquidityInitXform.ckbChangeAmount = ckbChange

        // update info
        matchRecord.info.sudtXReserve += xIn
        matchRecord.info.sudtYReserve += yIn

        matchRecord.info.totalLiquidity += lptMinted

        matchRecord.poolX.sudtAmount += xIn
        matchRecord.poolY.sudtAmount += yIn

        matchRecord.matcherChange.reduceBlockMinerFee()
    }
}
