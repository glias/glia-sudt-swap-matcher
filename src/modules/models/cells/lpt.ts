import { calcScriptLength, defaultScript, Uint128BigIntToLeHex, Uint64BigIntToHex } from '../../../utils/tools'
import { CellOutputType } from './interfaces/CellOutputType'
import { LPT_TYPE_SCRIPT } from '../../../utils/workEnv'

// though LPT is a specific type of SUDT, we give it a unique class to represent
// and note that the capacity is fixed to SUDT_CAPACITY = 142 * 10^8
/*
define LPT_CAPACITY = 142 * 10^8

capacity: - 8 bytes
data: amount: u128 16 bytes
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock 1 + 32 + 20
 */
export class Lpt implements CellOutputType{
  static LPT_FIXED_BASE_CAPACITY = BigInt(89 * 10 ** 8)

  lptAmount: bigint = 0n
  capacity: bigint = 0n
  originalUserLock: CKBComponents.Script

  constructor(lptAmount: bigint, originalUserLock: CKBComponents.Script) {
    this.lptAmount = lptAmount
    this.originalUserLock = originalUserLock
    this.capacity = Lpt.calcMinCapacity(originalUserLock)
  }

  static from(lptAmount: bigint, originalUserLock: CKBComponents.Script): Lpt {
    return new Lpt(lptAmount, originalUserLock)
  }

  static default(): Lpt {
    return new Lpt(0n, defaultScript())
  }

  static calcMinCapacity(script : CKBComponents.Script):bigint{
    return Lpt.LPT_FIXED_BASE_CAPACITY + calcScriptLength(script)
  }

  toCellOutput(): CKBComponents.CellOutput {
    return {
      capacity: Uint64BigIntToHex(this.capacity),
      type: LPT_TYPE_SCRIPT,
      lock: this.originalUserLock,
    }
  }

  toCellOutputData(): string {
    return `${Uint128BigIntToLeHex(this.lptAmount)}`
  }
}
