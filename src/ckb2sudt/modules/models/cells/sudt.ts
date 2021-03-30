import {calcScriptLength, defaultScript, Uint128BigIntToLeHex, Uint64BigIntToHex} from '../../../../tools'
import {CellOutputType} from './interfaces/CellOutputType'
import {SUDT_TYPE_SCRIPT} from '../../../utils/workerEnv'

/*
define SUDT_CAPACITY = 154 * 10^8

capacity: - 8 bytes
data: amount: u128 16 bytes
type: - 65 bytes
    code: sudt_type_script
    args: owner_lock_hash
lock: user_lock 53
 */
export class Sudt implements CellOutputType {
    static SUDT_FIXED_BASE_CAPACITY = BigInt(89 * 10 ** 8)

    sudtAmount: bigint = 0n
    capacity: bigint = 0n

    originalUserLock: CKBComponents.Script

    constructor(sudtAmount: bigint, originalUserLock: CKBComponents.Script) {
        this.sudtAmount = sudtAmount
        this.originalUserLock = originalUserLock
        this.capacity = Sudt.calcMinCapacity(originalUserLock)
    }

    static from(sudtAmount: bigint, originalUserLock: CKBComponents.Script): Sudt {
        return new Sudt(sudtAmount, originalUserLock)
    }

    static default(): Sudt {
        return new Sudt(0n, defaultScript())
    }

    static calcMinCapacity(script: CKBComponents.Script): bigint {
        return Sudt.SUDT_FIXED_BASE_CAPACITY + calcScriptLength(script)
    }

    toCellOutput(): CKBComponents.CellOutput {
        return {
            capacity: Uint64BigIntToHex(this.capacity),
            type: SUDT_TYPE_SCRIPT,
            lock: this.originalUserLock,
        }
    }

    toCellOutputData(): string {
        return `${Uint128BigIntToLeHex(this.sudtAmount)}`
    }
}
