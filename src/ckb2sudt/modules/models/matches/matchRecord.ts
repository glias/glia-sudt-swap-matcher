import {Info} from '../cells/info'
import {Pool} from '../cells/pool'
import {MatcherChange} from '../cells/matcherChange'
import {LiquidityAddTransformation} from '../transformation/liquidityAddTransformation'
import {LiquidityRemoveTransformation} from '../transformation/liquidityRemoveTransformation'
import {LiquidityInitTransformation} from '../transformation/liquidityInitTransformation'
import {SwapBuyTransformation} from '../transformation/swapBuyTransformation'
import {SwapSellTransformation} from '../transformation/swapSellTransformation'

export class MatchRecord {
    // contexts
    info: Info
    pool: Pool
    matcherChange: MatcherChange

    // transformations to process
    // those xforms is in order of provess
    sellXforms: Array<SwapSellTransformation>
    buyXforms: Array<SwapBuyTransformation>
    addXforms: Array<LiquidityAddTransformation>
    removeXforms: Array<LiquidityRemoveTransformation>
    // this is a separate case
    initXforms?: LiquidityInitTransformation

    // null if this Match doesn't need to send tx, which means, no match jobs are done
    composedTx?: CKBComponents.RawTransaction
    composedTxHash?: string
    skip: boolean

    constructor(
        info: Info,
        pool: Pool,
        matcherChange: MatcherChange,
        sellXforms: Array<SwapSellTransformation>,
        buyXforms: Array<SwapBuyTransformation>,
        addXforms: Array<LiquidityAddTransformation>,
        removeXforms: Array<LiquidityRemoveTransformation>,
    ) {
        this.info = info
        this.pool = pool
        this.matcherChange = matcherChange
        this.sellXforms = sellXforms
        this.buyXforms = buyXforms
        this.addXforms = addXforms
        this.removeXforms = removeXforms
        this.skip = false
    }
}
