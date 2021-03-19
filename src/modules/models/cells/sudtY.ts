import { calcScriptLength, defaultScript, Uint128BigIntToLeHex, Uint64BigIntToHex } from '../../../utils/tools'
import { CellOutputType } from './interfaces/CellOutputType'
import { SUDT_Y_TYPE_SCRIPT } from '../../../utils/workEnv'

/*

capacity: - 8 bytes
data: amount: u128 16 bytes
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock 53
 */
export class SudtY implements CellOutputType {
  static SUDT_FIXED_BASE_CAPACITY = BigInt(89 * 10 ** 8)

  capacity: bigint = 0n
  sudtAmount: bigint = 0n

  originalUserLock: CKBComponents.Script

  constructor(sudtAmount: bigint, originalUserLock: CKBComponents.Script) {
    this.sudtAmount = sudtAmount
    this.originalUserLock = originalUserLock
    this.capacity = SudtY.calcMinCapacity(originalUserLock)
  }

  static from(sudtAmount: bigint, originalUserLock: CKBComponents.Script): SudtY {
    return new SudtY(sudtAmount, originalUserLock)
  }

  static default(): SudtY {
    return new SudtY(0n, defaultScript())
  }

  static calcMinCapacity(script : CKBComponents.Script):bigint{
    return SudtY.SUDT_FIXED_BASE_CAPACITY + calcScriptLength(script)
  }

  toCellOutput(): CKBComponents.CellOutput {
    return {
      capacity: Uint64BigIntToHex(this.capacity),
      type: SUDT_Y_TYPE_SCRIPT,
      lock: this.originalUserLock,
    }
  }

  toCellOutputData(): string {
    return `${Uint128BigIntToLeHex(this.sudtAmount)}`
  }
}
