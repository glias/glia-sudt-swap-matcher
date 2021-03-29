import type { Cell } from '@ckb-lumos/base'
import { OutPoint } from '@ckb-lumos/base'
import {
  defaultOutPoint,
  defaultScript,
  leHexToBigIntUint128,
  leHexToBigIntUint64,
  prepare0xPrefix,
  scriptHash,
} from '../../../../tools'
import { SUDT_TYPE_SCRIPT_HASH } from '../../../utils/workerEnv'
import { CellInputType } from './interfaces/CellInputType'

/*
define LIQUIDITY_REQ_LOCK_CODE_HASH
define LIQUIDITY_REQ_CAPACITY = 235 * 10^8

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: asset_sudt_type - 65 bytes
lock: - 146 bytes
    code: LIQUIDITY_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: info_type_hash_32 (32 bytes, 0..32) |
          user_lock_hash (32 bytes, 32..64) |
		  version (u8, 1 byte, 64..65) |
		  sudtMin (u128, 16 bytes, 65..81) |
		  ckbMin (u64, 8 bytes, 81..89) |
		  tips (8 bytes, 89..97) |
		  tips_sudt (16 bytes, 97..113)

 */
export class LiquidityAddReq implements CellInputType {
  static LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY = BigInt(235 * 10 ** 8)

  // given capacity for add, the ckb is in it, should be greater than LIQUIDITY_ADD_REQUEST_FIXED_CAPACITY
  capacityAmount: bigint
  // given sudt for add
  sudtAmount: bigint

  infoTypeHash: string

  public userLockHash: string

  version: string

  sudtMin: bigint

  ckbMin: bigint

  tips: bigint
  tipsSudt: bigint

  originalUserLock: CKBComponents.Script

  outPoint: OutPoint

  constructor(
    capacityAmount: bigint,
    sudtAmount: bigint,
    infoTypeHash: string,
    version: string,
    sudtMin: bigint,
    ckbMin: bigint,
    userLockHash: string,
    tips: bigint,
    tipsSudt: bigint,
    originalUserLock: CKBComponents.Script,
    outPoint: OutPoint,
  ) {
    this.capacityAmount = capacityAmount
    this.sudtAmount = sudtAmount

    this.infoTypeHash = infoTypeHash
    this.version = version

    this.sudtMin = sudtMin
    this.ckbMin = ckbMin

    this.userLockHash = userLockHash

    this.tips = tips
    this.tipsSudt = tipsSudt

    this.outPoint = outPoint
    this.originalUserLock = originalUserLock
  }

  static fromCell(cell: Cell, script: CKBComponents.Script): LiquidityAddReq | null {
    if (!LiquidityAddReq.validate(cell)) {
      return null
    }

    let capacityAmount = BigInt(cell.cell_output.capacity)
    let sudtAmount = leHexToBigIntUint128(cell.data)

    const args = cell.cell_output.lock.args.substring(2)
    let infoTypeHash = args.substring(0, 64)

    let userLockHash = args.substring(64, 128)

    let version = args.substring(128, 130)

    let sudtMin = leHexToBigIntUint128(args.substring(130, 162))
    let ckbMin = leHexToBigIntUint64(args.substring(162, 178))

    let tips = leHexToBigIntUint64(args.substring(178, 194))
    let tipsSudt = leHexToBigIntUint128(args.substring(194, 226))

    let outPoint = cell.out_point!

    return new LiquidityAddReq(
      capacityAmount,
      sudtAmount,
      infoTypeHash,
      version,
      sudtMin,
      ckbMin,
      userLockHash,
      tips,
      tipsSudt,
      script,
      outPoint,
    )
  }

  static default(): LiquidityAddReq {
    return new LiquidityAddReq(0n, 0n, '', '', 0n, 0n, '', 0n, 0n, defaultScript(), defaultOutPoint())
  }

  static validate(cell: Cell) {
    if (scriptHash(cell.cell_output.type!) != SUDT_TYPE_SCRIPT_HASH) {
      return false
    }
    if (BigInt(cell.cell_output.capacity) < LiquidityAddReq.LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY) {
      return false
    }

    if (!cell.out_point) {
      return false
    }

    return true
  }

  static getUserLockHash(cell: Cell): string {
    return prepare0xPrefix(cell.cell_output.lock.args.substring(2).substring(114, 178))
  }

  toCellInput(): CKBComponents.CellInput {
    return {
      previousOutput: {
        txHash: this.outPoint.tx_hash,
        index: this.outPoint.index,
      },
      since: '0x0',
    }
  }

  getOutPoint(): string {
    return `${this.outPoint.tx_hash}-${this.outPoint.index}`
  }
}
