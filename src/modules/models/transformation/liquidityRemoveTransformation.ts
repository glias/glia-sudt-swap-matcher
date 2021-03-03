import {LiquidityRemoveReq} from '../cells/liquidityRemoveReq'
import {SudtX} from '../cells/sudtX'
import {SudtY} from '../cells/sudtY'
import {Transformation} from './interfaces/transformation'

/*
info_in_cell                            info_out_cell
pool_in_cell                            pool_out_cell
                          ------->
matcher_in_cell(ckb)                    matcher_out_cell(ckb)

[remove_liquidity_cell]                 [sudt_x_cell
                                       + sudt_y_cell]
 */
export class LiquidityRemoveTransformation implements Transformation {
    // after process, this is the data for sudt_cell + ckb_cell

    // total sudt to return
    sudtXAmount: bigint
    sudtYAmount: bigint


    request: LiquidityRemoveReq
    processed: boolean
    skip: boolean

    outputSudtX?: SudtX
    outputSudtY?: SudtY

    constructor(request: LiquidityRemoveReq) {
        this.request = request
        this.sudtXAmount = 0n
        this.sudtYAmount = 0n
        this.processed = false
        this.skip = false
    }

    public minCapacity(): bigint {
        return SudtX.calcMinCapacity(this.request.originalUserLock) + SudtY.calcMinCapacity(this.request.originalUserLock)
    }

    process(): void {
        if (!this.processed) {
            this.outputSudtX = SudtX.from(this.sudtXAmount, this.request.originalUserLock)
            this.outputSudtY = SudtY.from(this.sudtYAmount, this.request.originalUserLock)
        }
        this.processed = true
    }

    toCellInput(): Array<CKBComponents.CellInput> {
        return this.request.toCellInput()
    }

    toCellOutput(): Array<CKBComponents.CellOutput> {
        this.process()
        return [this.outputSudtX!.toCellOutput(), this.outputSudtY!.toCellOutput()]
    }

    toCellOutputData(): Array<string> {
        this.process()
        return [this.outputSudtX!.toCellOutputData(), this.outputSudtY!.toCellOutputData()]
    }
}
