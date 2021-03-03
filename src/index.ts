import { NODE_ENV } from './utils/envs'

import 'reflect-metadata'
import boostrap from './bootstrap'
import { container, modules } from './container'
import { logger } from './utils/logger'
import TaskService from './modules/services/taskService'
import { kickupMonitor } from './monitor'

export default class GliaSwapMatcher {
  #ready = false

  #log = (msg: string) => {
    logger.info(`${msg}`)
  }

  private static get taskService() {
    return container.get<TaskService>(modules[TaskService.name])
  }

  #bootstrap = async () => {
    if (!this.#ready) {
      try {
        await boostrap()
        this.#ready = true
      } catch (err) {
        logger.error(err)
      }
    }
  }

  public run = async () => {
    // TODO: use decorator to handle bootstrap

    this.#log('Glia-Swap-Matcher is running under: ' + NODE_ENV)

    await this.#bootstrap()

    if(NODE_ENV === 'development'){
      this.#log('kick up monitor')
      kickupMonitor()
    }

    await GliaSwapMatcher.taskService.start()
    this.#log('started')
  }
}

new GliaSwapMatcher().run()
