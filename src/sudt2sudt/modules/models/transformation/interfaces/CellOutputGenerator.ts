export interface CellOutputGenerator {
    toCellOutput(): Array<CKBComponents.CellOutput>

    toCellOutputData(): Array<string>
}
