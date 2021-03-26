import {INSTANCE_NAME, NODE_ENV} from './utils/workerEnv'

import 'reflect-metadata'
import boostrap from './bootstrap'
import { container, modules } from './container'
import { workerLogger } from './utils/workerLogger'
import TaskService from './modules/services/taskService'

export default class Ckb2SudtWorker {
  #ready = false

  #log = (msg: string) => {
    workerLogger.info(`${msg}`)
  }

  private static get taskService() {
    return container.get<TaskService>(modules[TaskService.name])
  }

  #bootstrap = async () => {
    if (!this.#ready) {
      try {
        await boostrap()
        // if(NODE_ENV === 'development'){
        //   this.#log('kick up monitor')
        //   kickupMonitor()
        // }
        this.#ready = true
      } catch (err) {
        workerLogger.error(err)
      }
    }
  }

  public run = async () => {
    // TODO: use decorator to handle bootstrap

    this.#log(`Glia-Swap-Matcher ${INSTANCE_NAME} is running under: ${NODE_ENV}`)

    await this.#bootstrap()

    await Ckb2SudtWorker.taskService.start()
    this.#log(`Glia-Swap-Matcher ${INSTANCE_NAME} started`)
  }
}

new Ckb2SudtWorker().run()
