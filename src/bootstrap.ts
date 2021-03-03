import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { createConnection } from 'typeorm'
import { container, modules } from './container'
import { logger } from './utils/logger'
import { TYPEORM_ENV } from './utils/envs'

const registerModule = async (modulePath: string) => {
  const { default: m } = await import(modulePath)
  modules[m.name] = Symbol(m.name)
  container.bind(modules[m.name]).to(m)
}

const connectDatabase = async () => {
  try{
    const connection = await createConnection(TYPEORM_ENV)
    logger.info(`database connected to ${connection.name}`)
    //return connection
  }catch (e){
    logger.error(e)
  }
}

// register all ts files under modules with @injectable()
// connect to database
const bootstrap = async () => {
  // register module
  const modulesDir = path.join(__dirname, 'modules')
  const controllersDir = path.join(modulesDir, 'controllers')
  const servicesDir = path.join(modulesDir, 'services')

  for (let injectableDir of [controllersDir, servicesDir]) {
    const injectablePaths = await promisify(fs.readdir)(injectableDir, 'utf8').then(injectableNames =>
      injectableNames.map(injectableName => path.join(injectableDir, injectableName)),
    )
    for (const injectablePath of injectablePaths) {
      try {
        await registerModule(injectablePath)
        logger.info(`inversify: registered module: ${injectablePath}`)
      } catch (e) {
        // we just skip for files don't have injectables :)
      }
    }
  }

  // connect to db
  await connectDatabase()
}

export default bootstrap
