import {SwapBuyReq} from '../cells/swapBuyReq'
import {SudtY} from '../cells/sudtY'
import {Transformation} from './interfaces/transformation'
import {Ckb} from "../cells/ckb";

/*
sudt_x -> sudt_y

[swap_request_cell]                     [sudt_swapped_cell
                                       + ckb_change_cell]
 */
export class SwapBuyTransformation implements Transformation {

    //remaining all ckb amount,
    //must be set outside due to tip
    ckbChangeAmount: bigint
    //result y amount
    sudtYAmount: bigint

    request: SwapBuyReq
    processed: boolean
    skip: boolean
    outputSudtY?: SudtY
    outputCkb?: Ckb

    constructor(request: SwapBuyReq) {
        this.ckbChangeAmount = 0n
        this.sudtYAmount = 0n
        this.request = request
        this.processed = false
        this.skip = false
    }

    public minCapacity(): bigint {
        return SudtY.calcMinCapacity(this.request.originalUserLock) + Ckb.calcMinCapacity(this.request.originalUserLock)
    }

    process(): void {
        if (!this.processed) {
            let ckbLeft = this.ckbChangeAmount
            this.outputSudtY = SudtY.from(this.sudtYAmount, this.request.originalUserLock)
            ckbLeft -= this.outputSudtY.capacity
            this.outputCkb = Ckb.from(ckbLeft, this.request.originalUserLock)

        }
        this.processed = true
    }

    toCellInput(): Array<CKBComponents.CellInput> {
        return this.request.toCellInput()
    }

    toCellOutput(): Array<CKBComponents.CellOutput> {
        this.process()
        return [this.outputSudtY!.toCellOutput(), this.outputCkb!.toCellOutput()]
    }

    toCellOutputData(): Array<string> {
        this.process()
        return [this.outputSudtY!.toCellOutputData(), this.outputCkb!.toCellOutputData()]
    }
}
