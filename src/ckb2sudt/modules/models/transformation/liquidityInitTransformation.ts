import {Transformation} from './interfaces/transformation'
import {LiquidityAddReq} from '../cells/liquidityAddReq'
import {Lpt} from '../cells/lpt'

/*
this res contains 2 cell
1. liquidity cell which contains liquidity
2. change cell which contains remaining ckb or sudt
 */

/*
info_in_cell                            info_out_cell
pool_in_cell                            pool_out_cell
                          ------->
matcher_in_cell(ckb)                    matcher_out_cell(ckb)
[init_liquidity_cell]                  [lpt_cell]
 */
export class LiquidityInitTransformation implements Transformation {

    lptAmount: bigint

    request: LiquidityAddReq
    processed: boolean
    skip: boolean

    outputLpt?: Lpt

    constructor(request: LiquidityAddReq) {
        this.request = request
        this.lptAmount = 0n
        this.processed = false
        this.skip = false
    }

    public minCapacity(): bigint {
        return Lpt.calcMinCapacity(this.request.originalUserLock)
    }

    process(): void {
        if (!this.processed) {
            this.outputLpt = Lpt.from(this.lptAmount, this.request.originalUserLock)
        }
        this.processed = true
    }

    toCellInput(): CKBComponents.CellInput {
        return this.request.toCellInput()
    }

    toCellOutput(): Array<CKBComponents.CellOutput> {
        this.process()

        return [this.outputLpt!.toCellOutput()]
    }

    toCellOutputData(): Array<string> {
        this.process()

        return [this.outputLpt!.toCellOutputData()]
    }
}
