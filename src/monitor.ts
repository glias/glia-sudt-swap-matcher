import {container} from './sudt2sudt/container'
import {InversifyExpressServer} from 'inversify-express-utils'
import helmet from 'helmet'
import cors from 'cors'
import bodyParser from 'body-parser'
import * as express from 'express'
import * as swagger from 'swagger-express-ts'

export const kickupMonitor = () => {
    const server = new InversifyExpressServer(container)

    server.setConfig((app) => {
        app.use(helmet({contentSecurityPolicy: false}))
        app.use(cors())
        app.use(
            bodyParser.urlencoded({
                extended: true
            })
        )
        app.use(bodyParser.json())

        app.use('/swagger', express.static('swagger'))
        app.use(
            '/api-docs/swagger/assets',
            express.static('node_modules/swagger-ui-dist')
        )
        app.use(
            swagger.express({
                definition: {
                    info: {
                        title: 'Monitor',
                        version: '1.0'
                    },
                }
            })
        )

    })

    const serverInstance = server.build()
    serverInstance.listen(8080)
}
