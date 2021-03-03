import { injectable } from 'inversify'
import { logger } from '../../utils/logger'

@injectable()
export default class MonitorService {

  // @ts-ignore
  #info = (msg: string) => {
    logger.info(`MonitorService: ${msg}`)
  }

  // @ts-ignore
  #error = (msg: string) => {
    logger.error(`MonitorService: ${msg}`)
  }

  // outPoint -> information
  #information : Map<string,string>= new Map<string, string>();

  constructor () {
  }

  update = (outPoint:string,info:string) =>{
    this.#information.set(outPoint,info)
  }

  read = (outPoint:string):string =>{
    if(this.#information.has(outPoint)){
      return this.#information.get(outPoint)!
    }
    return 'no info found'
  }
}
