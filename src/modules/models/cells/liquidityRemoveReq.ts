import type {Cell} from '@ckb-lumos/base'
import {OutPoint} from '@ckb-lumos/base'
import {
    defaultOutPoint,
    defaultScript,
    leHexToBigIntUint128,
    leHexToBigIntUint64,
    prepare0xPrefix,
    scriptHash,
} from '../../../utils/tools'
import {LPT_TYPE_SCRIPT_HASH} from '../../../utils/envs'
import {CellInputType} from './interfaces/CellInputType'

/*

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: sudt_lp_type - 65 bytes
lock: - 170 bytes
    code: LIQUIDITY_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: info_type_hash (32 bytes, 0..32)
        | user_lock_hash (32 bytes, 32..64)
        | version (u8, 1 byte, 64..65)
        | sudt_x_min (u128, 16 bytes, 65..81)
        | sudt_y_min (u128, 16 bytes, 81..97)
        | tips_ckb(8 bytes, 97..105)
        | tips_sudt_x/tips_sudt_lp (16 bytes, 105..121)
        | tips_sudt_y (16 bytes, 121..137) // 0x000000

 */
export class LiquidityRemoveReq implements CellInputType {
    static LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY = BigInt(259 * 10 ** 8)

    //total capacity the req contains
    capacity: bigint

    // given lpt to remove
    lptAmount: bigint

    infoTypeHash: string

    public userLockHash: string

    version: string

    sudtXMin: bigint

    sudtYMin: bigint

    tips: bigint
    tipsLp: bigint

    originalUserLock: CKBComponents.Script

    outPoint: OutPoint

    constructor(
        capacity: bigint,
        lptAmount: bigint,
        infoTypeHash: string,

        userLockHash: string,
        version: string,
        sudtXMin: bigint,
        sudtYMin: bigint,
        tips: bigint,
        tipsLp: bigint,
        originalUserLock: CKBComponents.Script,
        outPoint: OutPoint,
    ) {
        this.capacity = capacity
        this.lptAmount = lptAmount

        this.infoTypeHash = infoTypeHash

        this.userLockHash = userLockHash
        this.version = version

        this.sudtXMin = sudtXMin
        this.sudtYMin = sudtYMin

        this.tips = tips
        this.tipsLp = tipsLp

        this.outPoint = outPoint
        this.originalUserLock = originalUserLock
    }

    static fromCell(cell: Cell, script: CKBComponents.Script): LiquidityRemoveReq | null {
        if (!LiquidityRemoveReq.validate(cell)) {
            return null
        }

        let capacity = BigInt(cell.cell_output.capacity)
        let lptAmount = leHexToBigIntUint128(cell.data)

        const args = cell.cell_output.lock.args.substring(2)
        let infoTypeHash = args.substring(0, 64)
        let userLockHash = args.substring(64, 128)
        let version = args.substring(128, 130)

        let sudtXMin = leHexToBigIntUint128(args.substring(130, 162))
        let sudtYMin = leHexToBigIntUint64(args.substring(162, 194))

        let tips = leHexToBigIntUint64(args.substring(194, 210))
        let tipsLp = leHexToBigIntUint128(args.substring(210, 242))

        let outPoint = cell.out_point!

        return new LiquidityRemoveReq(
            capacity,
            lptAmount,
            infoTypeHash,
            userLockHash,
            version,
            sudtXMin,
            sudtYMin,
            tips,
            tipsLp,
            script,
            outPoint,
        )
    }

    static default(): LiquidityRemoveReq {
        return new LiquidityRemoveReq(0n, 0n, '', '','', 0n, 0n,  0n, 0n, defaultScript(), defaultOutPoint())
    }

    static validate(cell: Cell) {
        if (scriptHash(cell.cell_output.type!).toLowerCase() !== LPT_TYPE_SCRIPT_HASH.toLowerCase()) {
            return false
        }
        if (BigInt(cell.cell_output.capacity) !== LiquidityRemoveReq.LIQUIDITY_REMOVE_REQUEST_FIXED_CAPACITY) {
            return false
        }

        if (!cell.out_point) {
            return false
        }
        return true
    }

    static getUserLockHash(cell: Cell): string {
        return prepare0xPrefix(cell.cell_output.lock.args.substring(2).substring(64, 128))
    }

    toCellInput(): Array<CKBComponents.CellInput> {
        return[{
            previousOutput: {
                txHash: this.outPoint.tx_hash,
                index: this.outPoint.index,
            },
            since: '0x0',
        }]
    }

    getOutPoint(): string {
        return `${this.outPoint.tx_hash}-${this.outPoint.index}`
    }
}
