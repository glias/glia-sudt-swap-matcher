import {LiquidityAddReq} from '../cells/liquidityAddReq'
import {Lpt} from '../cells/lpt'
import {SudtX} from '../cells/sudtX'
import {SudtY} from '../cells/sudtY'
import {Ckb} from '../cells/ckb'
import {Transformation} from './interfaces/transformation'


/*

info_in_cell                            info_out_cell
pool_x_in_cell                          pool_x_out_cell
pool_y_in_cell                          pool_y_out_cell
matcher_in_cell                         matcher_out_ckb_cell
                          ------->

add_liquidity_x_cell                    sudt_lp_cell
add_liquidity_y_cell                    sudt_change_cell
                                        ckb_change_cell]
 */


export type ChangeType = 'x' | 'y'

export class LiquidityAddTransformation implements Transformation {

    // below are results

    // for liquidity cell
    lptAmount: bigint

    // either of following
    sudtXChangeAmount: bigint
    sudtYChangeAmount: bigint
    changeType: ChangeType

    // must be set outside due to tip
    ckbChangeAmount: bigint

    request: LiquidityAddReq
    processed: boolean
    skip: boolean

    outputLpt?: Lpt
    outputSudtXOrSudtY?: SudtX | SudtY
    outputCkb?: Ckb

    constructor(request: LiquidityAddReq) {
        this.request = request
        this.lptAmount = 0n
        this.sudtXChangeAmount = 0n
        this.sudtYChangeAmount = 0n
        this.ckbChangeAmount = 0n
        this.processed = false
        this.skip = false
        this.changeType = 'x'
    }

    minCapacity(which: ChangeType): bigint {
        if (which === 'x') {
            return this.minCapacityForSudtXChange()
        } else {
            return this.minCapacityForSudtYChange()
        }
    }

    private minCapacityForSudtXChange(): bigint {
        return SudtX.calcMinCapacity(this.request.originalUserLock)
            + Lpt.calcMinCapacity(this.request.originalUserLock)
            + Ckb.calcMinCapacity(this.request.originalUserLock)
    }


    private minCapacityForSudtYChange(): bigint {
        return SudtY.calcMinCapacity(this.request.originalUserLock)
            + Lpt.calcMinCapacity(this.request.originalUserLock)
            + Ckb.calcMinCapacity(this.request.originalUserLock)
    }


    process(): void {
        if (!this.processed) {
            let ckbLeft = this.ckbChangeAmount
            this.outputLpt = Lpt.from(this.lptAmount, this.request.originalUserLock)
            ckbLeft -= this.outputLpt.capacity

            if(this.changeType == 'x'){
                this.outputSudtXOrSudtY = SudtX.from(
                    this.sudtXChangeAmount,
                    this.request.originalUserLock,
                )
            }else{
                this.outputSudtXOrSudtY = SudtY.from(
                    this.sudtYChangeAmount,
                    this.request.originalUserLock
                )
            }

            ckbLeft -= this.outputSudtXOrSudtY.capacity
            this.outputCkb = Ckb.from(ckbLeft, this.request.originalUserLock)
        }
        this.processed = true
    }

    toCellInput(): Array<CKBComponents.CellInput> {
        return this.request.toCellInput()
    }

    toCellOutput(): Array<CKBComponents.CellOutput> {
        this.process()

        return [this.outputLpt!.toCellOutput(), this.outputSudtXOrSudtY!.toCellOutput(), this.outputCkb!.toCellOutput()]
    }

    toCellOutputData(): Array<string> {
        this.process()

        return [this.outputLpt!.toCellOutputData(), this.outputSudtXOrSudtY!.toCellOutputData(),this.outputCkb!.toCellOutputData()]
    }


}
