import winston, { format, transports } from 'winston'

export const logger = winston.createLogger({
  // do not depend to envs.ts to eliminate cross dependencies
  level: process.env.LOG_LEVEL!,
  format: format.combine(format.simple()),
  transports: [
    new transports.Console({ level: process.env.LOG_LEVEL! }),
    new transports.File({ filename: 'log.log', level: process.env.FILE_LOG_LEVEL! }),
  ],
})
