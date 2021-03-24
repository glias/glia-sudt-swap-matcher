import { LiquidityAddReq } from '../cells/liquidityAddReq'
import { Lpt } from '../cells/lpt'
import { Sudt } from '../cells/sudt'
import { Ckb } from '../cells/ckb'
import { Transformation } from './interfaces/transformation'

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
[removed_liquidity_cell]                [sudt_cell + ckb_cell]
[add_liquidity_cell]                    [liquidity_cell + (sudt_cell或者ckb_cell)]
 */

type changeType = 'ckb'|'sudt'

export class LiquidityAddTransformation implements Transformation {


  // for liquidity cell
  lptAmount: bigint

  // for change cell's ckb change, include all capacity for hold 2 cells
  capacityChangeAmount: bigint
  sudtChangeAmount: bigint

  request: LiquidityAddReq
  processed: boolean
  skip: boolean

  outputLpt?: Lpt
  outputSudtOrCkb?: Sudt | Ckb
  constructor(request: LiquidityAddReq) {
    this.request = request
    this.lptAmount = 0n
    this.sudtChangeAmount = 0n
    this.capacityChangeAmount = 0n
    this.processed = false
    this.skip = false
  }

  minCapacity(which: changeType): bigint {
    if(which === 'ckb'){
      return this.minCapacityForCkbChange()
    }else{
      return this.minCapacityForSudtChange()
    }
  }

  private minCapacityForSudtChange():bigint{
    return Sudt.calcMinCapacity(this.request.originalUserLock) + Lpt.calcMinCapacity(this.request.originalUserLock)
  }


  private minCapacityForCkbChange():bigint{
    return Ckb.calcMinCapacity(this.request.originalUserLock) + Lpt.calcMinCapacity(this.request.originalUserLock)
  }

  process(): void {
    if (!this.processed) {
      this.outputLpt = Lpt.from(this.lptAmount, this.request.originalUserLock)
      if (this.sudtChangeAmount === 0n) {
        // compose ckb
        this.outputSudtOrCkb = Ckb.from(
          this.capacityChangeAmount - Lpt.calcMinCapacity( this.request.originalUserLock),
          this.request.originalUserLock,
        )
      } else {
        // compose sudt
        this.outputSudtOrCkb = Sudt.from(this.sudtChangeAmount, this.request.originalUserLock)
      }
    }
    this.processed = true
  }

  toCellInput(): CKBComponents.CellInput {
    return this.request.toCellInput()
  }

  toCellOutput(): Array<CKBComponents.CellOutput> {
    this.process()

    return [this.outputLpt!.toCellOutput(), this.outputSudtOrCkb!.toCellOutput()]
  }

  toCellOutputData(): Array<string> {
    this.process()

    return [this.outputLpt!.toCellOutputData(), this.outputSudtOrCkb!.toCellOutputData()]
  }


}
