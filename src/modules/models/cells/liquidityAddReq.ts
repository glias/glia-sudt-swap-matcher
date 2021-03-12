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
import {SUDT_X_TYPE_SCRIPT_HASH,SUDT_Y_TYPE_SCRIPT_HASH} from '../../../utils/envs'
import {CellInputType} from './interfaces/CellInputType'

/*

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: sudt_x_type - 65 bytes
lock: - 170 bytes
    code: LIQUIDITY_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: info_type_hash (32 bytes, 0..32) //137 bytes
        | user_lock_hash (32 bytes, 32..64)
        | version (u8, 1 byte, 64..65)
        | sudt_x_min (u128, 16 bytes, 65..81)
        | sudt_y_min (u128, 16 bytes, 81..97)
        | tips_ckb(8 bytes, 97..105)
        | tips_sudt_x (16 bytes, 105..121)
        | tips_sudt_y (16 bytes, 121..137)

capacity: - 8 bytes
data: - 16 bytes
    sudt_amount: u128
type: sudt_y_type - 65 bytes
lock: - 130 bytes
    code: LIQUIDITY_LOCK_CODE_HASH - 32 bytes + 1 byte
    args: info_type_hash (32 bytes, 0..32) //97 bytes
        | user_lock_hash (32 bytes, 32..64)
        | version (u8, 1 byte, 64..65)
        | req_sudt_x_cell_lock_hash (32 bytes, 65..97)

 */
export class LiquidityAddReq implements CellInputType {
    static LIQUIDITY_ADD_X_REQUEST_FIXED_CAPACITY = BigInt(259 * 10 ** 8)
    static LIQUIDITY_ADD_Y_REQUEST_FIXED_CAPACITY = BigInt(219 * 10 ** 8)

    //total capacity the req holds
    capacity: bigint

    // given capacity for add, the ckb is in it, should be greater than LIQUIDITY_ADD_REQUEST_FIXED_CAPACITY
    sudtXAmount: bigint
    // given sudt for add
    sudtYAmount: bigint

    infoTypeHash: string

    public userLockHash: string
    version: string

    sudtXMin: bigint

    sudtYMin: bigint

    tips: bigint
    tipsSudtX: bigint
    tipsSudtY: bigint

    originalUserLock: CKBComponents.Script

    outPointX: OutPoint
    outPointY: OutPoint

    constructor(
        capacity: bigint,
        sudtXAmount: bigint,
        sudtYAmount: bigint,
        infoTypeHash: string,
        userLockHash: string,
        version: string,
        sudtXMin: bigint,
        sudtYMin: bigint,
        tips: bigint,
        tipsSudtX: bigint,
        tipsSudtY: bigint,
        originalUserLock: CKBComponents.Script,
        outPointX: OutPoint,
        outPointY: OutPoint,
    ) {
        this.capacity = capacity
        this.sudtXAmount = sudtXAmount
        this.sudtYAmount = sudtYAmount

        this.infoTypeHash = infoTypeHash

        this.userLockHash = userLockHash
        this.version = version

        this.sudtXMin = sudtXMin
        this.sudtYMin = sudtYMin

        this.tips = tips
        this.tipsSudtX = tipsSudtX
        this.tipsSudtY = tipsSudtY

        this.outPointX = outPointX
        this.outPointY = outPointY
        this.originalUserLock = originalUserLock
    }

    static fromCell(cellX: Cell, cellY: Cell, script: CKBComponents.Script): LiquidityAddReq | null {
        if (!LiquidityAddReq.validateX(cellX) || !LiquidityAddReq.validateY(cellY)) {
            return null
        }

        let capacity = BigInt(cellX.cell_output.capacity) + BigInt(cellY.cell_output.capacity)

        let sudtXAmount = leHexToBigIntUint128(cellX.data)
        let sudtYAmount = leHexToBigIntUint128(cellY.data)

        const args = cellX.cell_output.lock.args.substring(2)

        let infoTypeHash = args.substring(0, 64)
        let userLockHash = args.substring(64, 128)
        let version = args.substring(128, 130)

        let sudtXMin = leHexToBigIntUint128(args.substring(130, 162))
        let sudtYMin = leHexToBigIntUint128(args.substring(162, 194))


        let tips = leHexToBigIntUint64(args.substring(194, 210))
        let tipsXSudt = leHexToBigIntUint128(args.substring(210, 242))
        let tipsYSudt = leHexToBigIntUint128(args.substring(242, 274))

        let outPointX = cellX.out_point!
        let outPointY = cellY.out_point!

        return new LiquidityAddReq(
            capacity,
            sudtXAmount,
            sudtYAmount,
            infoTypeHash,
            userLockHash,
            version,
            sudtXMin,
            sudtYMin,
            tips,
            tipsXSudt,
            tipsYSudt,
            script,
            outPointX,
            outPointY,
        )
    }

    static default(): LiquidityAddReq {
        return new LiquidityAddReq(0n,0n, 0n, '', '','', 0n, 0n,  0n, 0n, 0n, defaultScript(), defaultOutPoint(), defaultOutPoint())
    }

    static validateX(cellX: Cell) {
        if (scriptHash(cellX.cell_output.type!) != SUDT_X_TYPE_SCRIPT_HASH) {
            return false
        }
        if (BigInt(cellX.cell_output.capacity) < LiquidityAddReq.LIQUIDITY_ADD_X_REQUEST_FIXED_CAPACITY) {
            return false
        }

        if (!cellX.out_point) {
            return false
        }
        return true
    }

    static validateY(cellY: Cell) {
        if (scriptHash(cellY.cell_output.type!) != SUDT_Y_TYPE_SCRIPT_HASH) {
            return false
        }
        if (BigInt(cellY.cell_output.capacity) < LiquidityAddReq.LIQUIDITY_ADD_Y_REQUEST_FIXED_CAPACITY) {
            return false
        }

        if (!cellY.out_point) {
            return false
        }
        return true
    }

    // for both x and y
    static getUserLockHash(cell: Cell): string {
        return prepare0xPrefix(cell.cell_output.lock.args.substring(2).substring(64, 128))
    }

    // for only y
    static getReqSudtXCellLockHash(cell:Cell) : string|null{
        const args = cell.cell_output.lock.args.substring(2)

        if(args.length != 97*2){
            return null
        }
        return args.substring(130,194)
    }

    toCellInput(): Array<CKBComponents.CellInput> {
        return [{
            previousOutput: {
                txHash: this.outPointX.tx_hash,
                index: this.outPointX.index,
            },
            since: '0x0',
        },
            {
                previousOutput: {
                    txHash: this.outPointY.tx_hash,
                    index: this.outPointY.index,
                },
                since: '0x0',
            }]
    }

    // we only track x's outpoint since y is controlled by x
    getOutPoint(): string {
        return `${this.outPointX.tx_hash}-${this.outPointX.index}`
    }
}
