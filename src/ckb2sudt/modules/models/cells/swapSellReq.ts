import type { Cell } from '@ckb-lumos/base'
import { OutPoint } from '@ckb-lumos/base'
import {
  defaultOutPoint,
  defaultScript,
  leHexToBigIntUint128,
  leHexToBigIntUint64,
  prepare0xPrefix,
} from '../../../../tools'
import { CellInputType } from './interfaces/CellInputType'

/*
define SWAP_ORDER_LOCK_CODE_HASH
define SWAP_ORDER_CAPACITY = 188 * 10^8

enum order_type {
    sell
    buy
}

define SWAP_REQ_LOCK_CODE_HASH
define SWAP_REQ_CAPACITY_SELL = 227 * 10^8
define SWAP_REQ_CAPACITY_BUY = 146 * 10^8

enum swap_request_type {
    sell
    buy
}

capacity: - 8 bytes
data: - 16 bytes for sell
    sudt_amount: u128
type: sudt_type for sell - 65 bytes
lock: - 138 bytes
    code: SWAP_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: sudt_type_hash (32 bytes, 0..32) |
		  user_lock_hash (32 bytes, 32..64) |
		  version (u8, 1 byte, 64..65) |
		  amountOutMin (u128, 16 bytes, 65..81) |
		  tips (8 bytes, 81..89) |
		  tips_sudt (16 bytes, 89..105)
 */

// note that the capacity is fixed to WAP_ORDER_CAPACITY = 155 * 10^8
export class SwapSellReq implements CellInputType {
  static SWAP_SELL_REQUEST_FIXED_CAPACITY = BigInt(227 * 10 ** 8)

  capacity: bigint
  sudtAmount: bigint
  sudtTypeHash: string
  version: string
  amountOutMin: bigint
  public userLockHash: string
  tips: bigint
  tips_sudt: bigint

  originalUserLock: CKBComponents.Script
  outPoint: OutPoint

  constructor(
    capacity: bigint,
    sudtAmount: bigint,
    sudtTypeHash: string,
    version: string,
    amountOutMin: bigint,
    userLockHash: string,
    tips: bigint,
    tips_sudt: bigint,
    originalUserLock: CKBComponents.Script,
    outPoint: OutPoint,
  ) {
    this.capacity = capacity
    this.sudtAmount = sudtAmount

    // should be all 0x00
    this.sudtTypeHash = sudtTypeHash
    this.version = version
    this.amountOutMin = amountOutMin
    this.userLockHash = userLockHash
    this.tips = tips
    this.tips_sudt = tips_sudt

    this.originalUserLock = originalUserLock
    this.outPoint = outPoint
  }

  static validate(_cell: Cell) {
    return true
  }

  static fromCell(cell: Cell, script: CKBComponents.Script): SwapSellReq | null {
    if (!SwapSellReq.validate(cell)) {
      return null
    }

    let capacity = BigInt(cell.cell_output.capacity)
    let sudtAmount = leHexToBigIntUint128(cell.data)

    const args = cell.cell_output.lock.args.substring(2)
    // should be all 0x00
    let sudtTypeHash = args.substring(0, 64)

    let version = args.substring(64, 128)

    let amountOutMin = leHexToBigIntUint128(args.substring(128, 130))

    let userLockHash = args.substring(130, 162)

    let tips = leHexToBigIntUint64(args.substring(162, 178))

    let tips_sudt = leHexToBigIntUint128(args.substring(178, 210))

    let outPoint = cell.out_point!

    return new SwapSellReq(
      capacity,
      sudtAmount,
      sudtTypeHash,
      version,
      amountOutMin,
      userLockHash,
      tips,
      tips_sudt,
      script,
      outPoint,
    )
  }

  static default(): SwapSellReq {
    return new SwapSellReq(0n, 0n, '', '', 0n, '', 0n, 0n, defaultScript(), defaultOutPoint())
  }

  static getUserLockHash(cell: Cell): string {
    return prepare0xPrefix(cell.cell_output.lock.args.substring(2).substring(98, 162))
  }

  getOutPoint(): string {
    return `${this.outPoint.tx_hash}-${this.outPoint.index}`
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
}
