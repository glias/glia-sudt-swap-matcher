import { calcScriptLength } from './tools'

describe('tool test', () => {
  it('0, calcScriptLength', () => {
      const script: CKBComponents.Script = {
        codeHash: '0x86b757df2d9f20c950b6bfeec48349ce7b4c48c9c89575f1ff68cc13cf487fc8',
        hashType: 'data',
        args: '0x86b757df2d9f20c950b6bfeec48349ce7b4c48c9',
      }

      const length = calcScriptLength(script)
      expect(length).toEqual(BigInt(53*10**8))
  })
})
