// mark a transformation
import {CellInputGenerator} from './CellInputGenerator'
import {CellOutputGenerator} from './CellOutputGenerator'

export interface Transformation extends CellInputGenerator, CellOutputGenerator {
    // this Transformation is fully processed and all fields are up-to-date, and Output cells are generated
    processed: boolean
    // skip this Transformation since the Transformation fails according to business logic
    skip: boolean

    minCapacity(...x: [any]): bigint
}
