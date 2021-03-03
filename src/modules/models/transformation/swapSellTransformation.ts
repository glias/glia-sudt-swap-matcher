import { Ckb } from '../cells/ckb'
import { SwapSellReq } from '../cells/swapSellReq'
import { Transformation } from './interfaces/transformation'
import {SudtX} from "../cells/sudtX";

/*
sudt_y -> sudt_x

[swap_request_cell]                     [sudt_swapped_cell
                                       + ckb_change_cell]
 */
export class SwapSellTransformation implements Transformation {

  //remaining all ckb amount,
  //must be set outside due to tip
  ckbChangeAmount:bigint
  //result x amount
  sudtXAmount: bigint

  request: SwapSellReq
  processed: boolean
  skip: boolean
  outputSudtX?: SudtX
  outputCkb?: Ckb

  constructor(request: SwapSellReq) {
    this.ckbChangeAmount = 0n
    this.sudtXAmount = 0n
    this.request = request
    this.processed = false
    this.skip = false
  }

  public minCapacity():bigint{
    return SudtX.calcMinCapacity(this.request.originalUserLock) + Ckb.calcMinCapacity(this.request.originalUserLock)
  }

  process(): void {
    if (!this.processed) {
      let ckbLeft = this.ckbChangeAmount
      this.outputSudtX = SudtX.from(this.sudtXAmount, this.request.originalUserLock)
      ckbLeft -= this.outputSudtX.capacity
      this.outputCkb = Ckb.from(ckbLeft, this.request.originalUserLock)

    }
    this.processed = true
  }

  toCellInput(): Array<CKBComponents.CellInput> {
    return this.request.toCellInput()
  }

  toCellOutput(): Array<CKBComponents.CellOutput> {
    this.process()

    return [this.outputSudtX!.toCellOutput(),this.outputCkb!.toCellOutput()]
  }

  toCellOutputData(): Array<string> {
    this.process()

    return [this.outputSudtX!.toCellOutputData(),this.outputCkb!.toCellOutputData()]
  }
}
