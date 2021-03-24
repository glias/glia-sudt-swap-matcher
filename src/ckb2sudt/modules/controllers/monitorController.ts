import { modules } from '../../container'
import {
  ApiOperationGet,
  ApiPath,
  SwaggerDefinitionConstant
} from 'swagger-express-ts'
import { inject, LazyServiceIdentifer } from 'inversify'
import * as express from 'express'
import { controller, httpGet } from 'inversify-express-utils'
import { workerLogger } from '../../utils/workerLogger'
import MonitorService from '../services/monitorService'
import { prepare0xPrefix } from '../../../tools'


@ApiPath({
  path: '/',
  name: 'MonitorController',
  security: { basicAuth: [] }
})
@controller('/')
export default class MonitorController {

  #monitorService : MonitorService

  // @ts-ignore
  #info = (msg: string) => {
    workerLogger.info(`MonitorController: ${msg}`)
  }

  // @ts-ignore
  #error = (msg: string) => {
    workerLogger.error(`MonitorController: ${msg}`)
  }

  constructor (
    @inject(new LazyServiceIdentifer(() => modules[MonitorService.name])) monitorService: MonitorService,
  ) {
    this.#monitorService = monitorService
  }

  @ApiOperationGet({
    path: 'request',
    description: 'get match request status',
    summary: '',
    parameters: {
      query: {
        txHash: {
          name: 'txHash',
          type: 'string',
          required: true,
          description: 'txHash of outpoint of request in Hex format'
        },
        index: {
          name: 'index',
          type: 'string',
          required: true,
          description: 'index of outpoint of request in Hex format'
        },
      }
    },
    responses: {
      200: {
        description: 'Success',
        type: SwaggerDefinitionConstant.Response.Type.STRING,
        //model: 'string'
      },
      400: { description: 'Parameters fail' }
    }
  })
  @httpGet('request')
  request (
    req: express.Request,
    res: express.Response
  ): void {

    let txHash = <string>req.query.txHash
    let index = <string>req.query.index

    txHash = prepare0xPrefix(txHash)
    index = prepare0xPrefix(index)

    try {
      const result = this.#monitorService.read(`${txHash}-${index}`)

      res.status(200).send(result)
    } catch (err) {
      res.status(500).send()
    }

  }
}
