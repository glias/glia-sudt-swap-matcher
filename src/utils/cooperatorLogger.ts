import winston, { format, transports } from 'winston'

export const logger = winston.createLogger({
  // do not depend to workEnv.ts to eliminate cross dependencies
  level: process.env.LOG_LEVEL!,
  format: format.combine(format.simple()),
  transports: [
    new transports.Console({ level: process.env.LOG_LEVEL! }),
    new transports.File({ filename: `logs/cooperator.log`, level: process.env.FILE_LOG_LEVEL! }),
  ],
})
