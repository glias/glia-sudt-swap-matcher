import {Ckb} from '../cells/ckb'
import {SwapSellReq} from '../cells/swapSellReq'
import {Transformation} from './interfaces/transformation'

export class SwapSellTransformation implements Transformation {

    // all ckbs it gets
    capacity: bigint

    request: SwapSellReq
    processed: boolean
    skip: boolean
    outputCkb?: Ckb

    constructor(request: SwapSellReq) {
        this.capacity = 0n
        this.request = request

        this.processed = false
        this.skip = false
    }

    public minCapacity(): bigint {
        return Ckb.calcMinCapacity(this.request.originalUserLock)
    }

    process(): void {
        if (!this.processed) {
            this.outputCkb = Ckb.from(this.capacity, this.request.originalUserLock)
        }
        this.processed = true
    }

    toCellInput(): CKBComponents.CellInput {
        return this.request.toCellInput()
    }

    toCellOutput(): Array<CKBComponents.CellOutput> {
        this.process()

        return [this.outputCkb!.toCellOutput()]
    }

    toCellOutputData(): Array<string> {
        this.process()

        return [this.outputCkb!.toCellOutputData()]
    }
}
