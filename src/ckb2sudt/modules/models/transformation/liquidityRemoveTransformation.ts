import {LiquidityRemoveReq} from '../cells/liquidityRemoveReq'
import {Sudt} from '../cells/sudt'
import {Ckb} from '../cells/ckb'
import {Transformation} from './interfaces/transformation'

/*
info_in_cell                            info_out_cell
pool_in_cell                            pool_out_cell
                          ------->
matcher_in_cell(ckb)                    matcher_out_cell(ckb)
[removed_liquidity_cell]                [sudt_cell + ckb_cell]  <--- this is Transformation
[add_liquidity_cell]                    [liquidity_cell + (sudt_cell或者ckb_cell)]
 */
export class LiquidityRemoveTransformation implements Transformation {
    // after process, this is the data for sudt_cell + ckb_cell

    // total sudt to return
    sudtAmount: bigint
    // total ckb to return, sudt cell capacity + ckb cell capacity
    capacityAmount: bigint

    request: LiquidityRemoveReq
    processed: boolean
    skip: boolean

    output_sudt?: Sudt
    output_ckb?: Ckb

    constructor(request: LiquidityRemoveReq) {
        this.request = request
        this.sudtAmount = 0n
        this.capacityAmount = 0n
        this.processed = false
        this.skip = false
    }

    public minCapacity(): bigint {
        return Sudt.calcMinCapacity(this.request.originalUserLock) + Ckb.calcMinCapacity(this.request.originalUserLock)
    }

    process(): void {
        if (!this.processed) {
            this.output_sudt = Sudt.from(this.sudtAmount, this.request.originalUserLock)
            this.output_ckb = Ckb.from(
                this.capacityAmount - Sudt.calcMinCapacity(this.request.originalUserLock),
                this.request.originalUserLock,
            )
        }
        this.processed = true
    }

    toCellInput(): CKBComponents.CellInput {
        return this.request.toCellInput()
    }

    toCellOutput(): Array<CKBComponents.CellOutput> {
        this.process()
        return [this.output_sudt!.toCellOutput(), this.output_ckb!.toCellOutput()]
    }

    toCellOutputData(): Array<string> {
        this.process()
        return [this.output_sudt!.toCellOutputData(), this.output_ckb!.toCellOutputData()]
    }
}
