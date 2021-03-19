import {Cell, OutPoint} from '@ckb-lumos/base'
import {
    defaultOutPoint,
    leHexToBigIntUint128,
    remove0xPrefix,
    scriptHash,
    Uint128BigIntToLeHex,
    Uint64BigIntToHex,
} from '../../../utils/tools'
import {
    INFO_LOCK_SCRIPT,
    INFO_LOCK_SCRIPT_HASH,
    INFO_TYPE_SCRIPT,
    INFO_TYPE_SCRIPT_HASH,
    LPT_TYPE_SCRIPT_HASH,
} from '../../../utils/workEnv'
import {CellOutputType} from './interfaces/CellOutputType'
import {CellInputType} from './interfaces/CellInputType'

/*

capacity: - 8 bytes
data: - 80 bytes
    sudt_x_reserve: u128 0..16
    sudt_y_reserve: u128 16..32
    total_liquidity: u128 32..48
    sudt_lp_type_hash: 32 bytes 48..80
type: - 65 bytes
    code: INFO_TYPE_CODE_HASH - 32 bytes + 1 byte
    args: id - 32 bytes
lock: - 97 bytes
    code: INFO_TYPE_CODE_HASH - 32 bytes + 1 byte
    args: hash(sudt_x_type_hash | sudt_y_type_hash) - 32 bytes
        | info_type_hash - 32 bytes
 */
export class Info implements CellInputType, CellOutputType {
    static INFO_FIXED_CAPACITY = BigInt(250 * 10 ** 8)

    // this should be fixed
    capacity: bigint /*= Info.INFO_IFXED_CAPACITY*/

    sudtXReserve: bigint
    sudtYReserve: bigint
    totalLiquidity: bigint

    readonly sudtXReserveOriginal: bigint
    readonly sudtYReserveOriginal: bigint
    readonly totalLiquidityOriginal: bigint

    // keep the txHash to trace the Info cell
    outPoint: OutPoint

    constructor(capacity: bigint, sudtXReserve: bigint, sudtYReserve: bigint, totalLiquidity: bigint, outPoint: OutPoint) {
        this.capacity = capacity

        this.sudtXReserve = sudtXReserve
        this.sudtYReserve = sudtYReserve
        this.totalLiquidity = totalLiquidity

        this.sudtXReserveOriginal = sudtXReserve
        this.sudtYReserveOriginal = sudtYReserve
        this.totalLiquidityOriginal = totalLiquidity

        this.outPoint = outPoint
    }

    static validate(cell: Cell): boolean {
        if (BigInt(cell.cell_output.capacity) !== Info.INFO_FIXED_CAPACITY) {
            return false
        }

        // for liquidity_sudt_type_hash field in data
        if (cell.data.substring(2).substring(96, 160) !== remove0xPrefix(LPT_TYPE_SCRIPT_HASH)) {
            return false
        }
        if (scriptHash(cell.cell_output.type!) !== INFO_TYPE_SCRIPT_HASH) {
            return false
        }

        if (scriptHash(cell.cell_output.lock) !== INFO_LOCK_SCRIPT_HASH) {
            return false
        }

        if (!cell.out_point) {
            return false
        }

        if (cell.cell_output.lock.args.substring(2).length != 128) {
            return false
        }

        return true
    }

    static fromCell(cell: Cell): Info | null {
        if (!Info.validate(cell)) {
            return null
        }
        let capacity = BigInt(cell.cell_output.capacity)

        const args = cell.data.substring(2)

        let sudtXReserve = leHexToBigIntUint128(args.substring(0, 32))
        let sudtYReserve = leHexToBigIntUint128(args.substring(32, 64))
        let totalLiquidity = leHexToBigIntUint128(args.substring(64, 96))

        let outPoint = cell.out_point!

        return new Info(capacity, sudtXReserve, sudtYReserve, totalLiquidity, outPoint)
    }

    static default(): Info {
        return new Info(0n, 0n, 0n, 0n, defaultOutPoint())
    }

    /*static cloneWith(info: Info, txHash: string, index: string): Info {
      info = JSONbig.parse(JSONbig.stringify(info))
      info.outPoint.tx_hash = txHash
      info.outPoint.index = index
      return info
    }*/

    toCellInput(): Array<CKBComponents.CellInput> {
        return [{
            previousOutput: {
                txHash: this.outPoint.tx_hash,
                index: this.outPoint.index,
            },
            since: '0x0',
        }]
    }

    toCellOutput(): CKBComponents.CellOutput {
        return {
            capacity: Uint64BigIntToHex(this.capacity),
            type: INFO_TYPE_SCRIPT,
            lock: INFO_LOCK_SCRIPT,
        }
    }

    toCellOutputData(): string {
        return `${Uint128BigIntToLeHex(this.sudtXReserve)}${remove0xPrefix(Uint128BigIntToLeHex(this.sudtYReserve))}${remove0xPrefix(Uint128BigIntToLeHex(this.totalLiquidity))}${remove0xPrefix(LPT_TYPE_SCRIPT_HASH)}`
    }

    getOutPoint(): string {
        return `${this.outPoint.tx_hash}-${this.outPoint.index}`
    }

    static fromJSON(source: Object): Info {
        return Object.assign(Info.default(), source);
    }
}
