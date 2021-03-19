import winston, { format, transports } from 'winston'

export const workerLogger = winston.createLogger({
  // do not depend to workEnv.ts to eliminate cross dependencies
  level: process.env.LOG_LEVEL!,
  format: format.combine(format.simple()),
  transports: [
    new transports.Console({ level: process.env.LOG_LEVEL! }),
    new transports.File({ filename: `logs/${ process.env.SUDT_X_SYMBOL}-${ process.env.SUDT_Y_SYMBOL}.log`, level: process.env.FILE_LOG_LEVEL! }),
  ],
})
