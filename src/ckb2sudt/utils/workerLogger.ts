import winston, {format, transports} from 'winston'

export const workerLogger = winston.createLogger({
    // do not depend to workerEnv.ts to eliminate cross dependencies
    level: process.env.LOG_LEVEL!,
    format: format.combine(format.simple()),
    transports: [
        new transports.Console({level: process.env.LOG_LEVEL!}),
        new transports.File({
            filename: `logs/ckb-${process.env.SUDT_SYMBOL}.log`,
            level: process.env.FILE_LOG_LEVEL!
        }),
    ],
})
