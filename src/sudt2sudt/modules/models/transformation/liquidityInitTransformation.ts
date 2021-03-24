import { Transformation } from './interfaces/transformation'
import { LiquidityAddReq } from '../cells/liquidityAddReq'
import { Lpt } from '../cells/lpt'
import {Ckb} from "../cells/ckb";

/*
this res contains 2 cell
1. liquidity cell which contains liquidity
2. change cell which contains remaining ckb or sudt
 */
/*
info_in_cell                              info_out_cell
pool_x_in_cell                            pool_x_out_cell
pool_y_in_cell                            pool_y_out_cell

                          ------->
matcher_in_cell(ckb)                      matcher_out_cell(ckb)


req_sudt_x_cell                           sudt_lp_cell
req_sudt_y_cell                           ckb_change_cell
 */
export class LiquidityInitTransformation implements Transformation {

  // must be set outside due to tip
  ckbChangeAmount: bigint

  lptAmount: bigint

  request: LiquidityAddReq
  processed: boolean
  skip: boolean

  outputLpt?: Lpt
  outputCkb?: Ckb
  constructor(request: LiquidityAddReq) {
    this.ckbChangeAmount = 0n
    this.request = request
    this.lptAmount = 0n
    this.processed = false
    this.skip = false
  }

  public minCapacity():bigint{
    return Lpt.calcMinCapacity(this.request.originalUserLock) + Ckb.calcMinCapacity(this.request.originalUserLock)
  }

  process(): void {
    if (!this.processed) {
      let ckbLeft = this.ckbChangeAmount
      this.outputLpt = Lpt.from(this.lptAmount, this.request.originalUserLock)
      ckbLeft -= this.outputLpt.capacity
      this.outputCkb = Ckb.from(ckbLeft, this.request.originalUserLock)
    }
    this.processed = true
  }

  toCellInput(): Array<CKBComponents.CellInput> {
    return this.request.toCellInput()
  }

  toCellOutput(): Array<CKBComponents.CellOutput> {
    this.process()

    return [this.outputLpt!.toCellOutput(),this.outputCkb!.toCellOutput()]
  }

  toCellOutputData(): Array<string> {
    this.process()

    return [this.outputLpt!.toCellOutputData(),this.outputCkb!.toCellOutputData()]
  }
}
