import { Cell, OutPoint } from '@ckb-lumos/base'
import { defaultOutPoint, leHexToBigIntUint128, Uint128BigIntToLeHex, Uint64BigIntToHex } from '../../../../tools'
import { CellOutputType } from './interfaces/CellOutputType'
import { CellInputType } from './interfaces/CellInputType'
import { POOL_LOCK_SCRIPT, POOL_TYPE_SCRIPT } from '../../../utils/workerEnv'

/*
define POOL_BASE_CAPACITY =  186 * 10^8

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount
type: sudt_type - 65 bytes
lock: - 97 bytes
    code: INFO_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: hash(ckb | asset_sudt_type_hash) 32 bytes | info_type_hash - 32 bytes
 */
export class Pool implements CellInputType, CellOutputType {
  static POOL_FIXED_CAPACITY = BigInt(186 * 10 ** 8)

  capacity: bigint
  sudtAmount: bigint

  // for debug
  readonly capacityOriginal: bigint
  readonly sudtReserveOriginal: bigint

  outPoint: OutPoint

  constructor(capacity: bigint, sudtAmount: bigint, outPoint: OutPoint) {
    this.capacity = capacity
    this.sudtAmount = sudtAmount

    this.capacityOriginal = capacity
    this.sudtReserveOriginal = sudtAmount

    this.outPoint = outPoint
  }

  static validate(cell: Cell): boolean {
    if (!cell.out_point) {
      return false
    }

    return true
  }

  static fromCell(cell: Cell): Pool | null {
    if (!Pool.validate(cell)) {
      return null
    }
    let capacity = BigInt(cell.cell_output.capacity)
    let sudtAmount = leHexToBigIntUint128(cell.data)

    let outPoint = cell.out_point!

    return new Pool(capacity, sudtAmount, outPoint)
  }

  static default(): Pool {
    return new Pool(0n, 0n, defaultOutPoint())
  }

  /*static cloneWith(pool: Pool, txHash: string, index: string): Pool {
    pool = JSONbig.parse(JSONbig.stringify(pool))
    pool.outPoint.tx_hash = txHash
    pool.outPoint.index = index
    return pool
  }*/

  toCellInput(): CKBComponents.CellInput {
    return {
      previousOutput: {
        txHash: this.outPoint.tx_hash,
        index: this.outPoint.index,
      },
      since: '0x0',
    }
  }

  toCellOutput(): CKBComponents.CellOutput {
    return {
      capacity: Uint64BigIntToHex(this.capacity),
      type: POOL_TYPE_SCRIPT,
      lock: POOL_LOCK_SCRIPT,
    }
  }

  toCellOutputData(): string {
    return `${Uint128BigIntToLeHex(this.sudtAmount)}`
  }

  getOutPoint(): string {
    return `${this.outPoint.tx_hash}-${this.outPoint.index}`
  }

  static fromJSON(source: Object): Pool {
    return Object.assign(Pool.default(), source);
  }
}
