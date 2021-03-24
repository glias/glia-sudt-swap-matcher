import {INSTANCE_NAME, NODE_ENV} from './ckb2sudt/utils/workerEnv'

import 'reflect-metadata'
import boostrap from './ckb2sudt/bootstrap'
import { container, modules } from './ckb2sudt/container'
import { workerLogger } from './ckb2sudt/utils/workerLogger'
import TaskService from './ckb2sudt/modules/services/taskService'
// @ts-ignore
import { kickupMonitor } from './monitor'

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
