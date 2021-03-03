import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 1000*60*10,
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
}

export default config
