import type {Cell} from '@ckb-lumos/base'
import {OutPoint} from '@ckb-lumos/base'
import {
    defaultOutPoint,
    defaultScript,
    leHexToBigIntUint128,
    leHexToBigIntUint64,
    prepare0xPrefix,
} from '../../../utils/tools'
import {CellInputType} from './interfaces/CellInputType'

/*

  sudt_y -> sudt_x


capacity: - 8 bytes
data: - 16 bytes
    sudt_y_amount: u128
type: sudt_type - 65 bytes
lock: - 138 bytes
    code: SWAP_REQ_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: sudt_x_type_hash (32 bytes, 0..32)
        | user_lock_hash (32 bytes, 32..64)
        | version (u8, 1 byte, 64..65)
        | amount_out_min (u128, 16 bytes, 65..81)
        | tips(8 bytes, 81..89)
        | tips_sudt_y (16 bytes, 89..105)
 */

export class SwapSellReq implements CellInputType {
    static SWAP_SELL_REQUEST_FIXED_CAPACITY = BigInt(227 * 10 ** 8)

    //total capacity the req holds
    capacity: bigint

    sudtYInAmount: bigint

    sudtTypeHash: string
    public userLockHash: string
    version: string
    amountOutMin: bigint
    tips: bigint
    tips_sudt: bigint

    originalUserLock: CKBComponents.Script
    outPoint: OutPoint

    constructor(
        capacity: bigint,
        sudtYInAmount: bigint,
        sudtTypeHash: string,
        userLockHash: string,
        version: string,
        amountOutMin: bigint,
        tips: bigint,
        tips_sudt: bigint,
        originalUserLock: CKBComponents.Script,
        outPoint: OutPoint,
    ) {
        this.capacity = capacity
        this.sudtYInAmount = sudtYInAmount
        this.sudtTypeHash = sudtTypeHash

        this.userLockHash = userLockHash
        this.version = version
        this.amountOutMin = amountOutMin

        this.tips = tips
        this.tips_sudt = tips_sudt

        this.originalUserLock = originalUserLock
        this.outPoint = outPoint
    }

    static validate(cell: Cell) {
        if (!cell.out_point) {
            return false
        }
        return true
    }

    static fromCell(cell: Cell, script: CKBComponents.Script): SwapSellReq | null {
        if (!SwapSellReq.validate(cell)) {
            return null
        }

        let capacity = BigInt(cell.cell_output.capacity)
        let sudtYInAmount = leHexToBigIntUint128(cell.data)

        const args = cell.cell_output.lock.args.substring(2)
        let sudtTypeHash = args.substring(0, 64)
        let userLockHash = args.substring(64, 128)

        let version = args.substring(128, 130)
        let amountOutMin = leHexToBigIntUint128(args.substring(130, 162))
        let tips = leHexToBigIntUint64(args.substring(162, 178))
        let tips_sudt = leHexToBigIntUint128(args.substring(178, 210))

        let outPoint = cell.out_point!

        return new SwapSellReq(
            capacity,
            sudtYInAmount,
            sudtTypeHash,
            userLockHash,
            version,
            amountOutMin,
            tips,
            tips_sudt,
            script,
            outPoint,
        )
    }

    static default(): SwapSellReq {
        return new SwapSellReq(0n, 0n, '', '', '', 0n, 0n, 0n, defaultScript(), defaultOutPoint())
    }

    static getUserLockHash(cell: Cell): string {
        return prepare0xPrefix(cell.cell_output.lock.args.substring(2).substring(64, 128))
    }

    getOutPoint(): string {
        return `${this.outPoint.tx_hash}-${this.outPoint.index}`
    }

    toCellInput(): Array<CKBComponents.CellInput> {
        return [{
            previousOutput: {
                txHash: this.outPoint.tx_hash,
                index: this.outPoint.index,
            },
            since: '0x0',
        }]
    }
}
