import fs from 'fs'
import path from 'path'
import {promisify} from 'util'
import {container, modules} from './container'
import {workerLogger} from './utils/workerLogger'

// import { createConnection } from 'typeorm'
// import {INSTANCE_NAME,NODE_ENV} from './utils/workEnv'
// import {SqliteConnectionOptions} from "typeorm/driver/sqlite/SqliteConnectionOptions";

const registerModule = async (modulePath: string) => {
    const {default: m} = await import(modulePath)
    modules[m.name] = Symbol(m.name)
    container.bind(modules[m.name]).to(m)
}

/*const connectDatabase = async () => {
  try{
    const connexionConfig : SqliteConnectionOptions= {
      name: `${INSTANCE_NAME}`,
      database: `db/glia-amm.sqlite3.${INSTANCE_NAME}.${NODE_ENV}`,
      type: "sqlite",
      entities: [`src/!**!/!*.entity.ts`],
      logging:false,
      logger:`advanced-console`,
      synchronize:true
    }

    const connection = await createConnection(connexionConfig)
    workerLogger.info(`database connected to ${connection.name}`)
    //return connection
  }catch (e){
    workerLogger.error(e)
  }
}*/

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
                workerLogger.info(`inversify: registered module: ${injectablePath}`)
            } catch (e) {
                // we just skip for files don't have injectables :)
            }
        }
    }

    // connect to db
    //await connectDatabase()
}

export default bootstrap
