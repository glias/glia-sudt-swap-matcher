import { container, modules } from '../../container'
import { injectable } from 'inversify'
import { LiquidityAddTransformation } from '../models/transformation/liquidityAddTransformation'
import { LiquidityRemoveTransformation } from '../models/transformation/liquidityRemoveTransformation'
import { SwapBuyTransformation } from '../models/transformation/swapBuyTransformation'
import { SwapSellTransformation } from '../models/transformation/swapSellTransformation'
import { Info } from '../models/cells/info'
import { PoolX } from '../models/cells/poolX'
import { MatcherChange } from '../models/cells/matcherChange'
import { DealStatus } from '../models/entities/deal.entity'
import winston, { format, transports } from 'winston'

import ScanService from './scanService'
import TaskService from './taskService'
import DealService from './dealService'
import RpcService from './rpcService'
import MatcherService from './matcherService'
import TransactionService from './transactionService'
import { LiquidityAddReq } from '../models/cells/liquidityAddReq'
import { createConnection } from 'typeorm'
import { NODE_ENV, TYPEORM_ENV } from '../../utils/envs'
import { D1,D2,A1,A2,C1,C2,A5,A6,A8,A9,B1,req1, req2, req3 } from './taskService.info.spec'
import JSONbig from 'json-bigint'
import MonitorService from './monitorService'

jest.setMock('../../utils/logger', {
  logger: winston.createLogger({
    level: 'debug',
    format: format.combine(format.simple()),
    transports: [new transports.Console({ level: 'debug' })],
  }),
})
let scanAllReturn: [
  Array<LiquidityAddTransformation>,
  Array<LiquidityRemoveTransformation>,
  Array<SwapBuyTransformation>,
  Array<SwapSellTransformation>,
  Info,
  PoolX,
  MatcherChange,
] | null = null

@injectable()
class MockScanService {
  scanAll = jest.fn().mockImplementation(() => {
    return Promise.resolve(scanAllReturn)
  })
  getTip = jest.fn().mockResolvedValue(1n)
}

let getTxsStatusReturnStatus: Record<string, DealStatus>

@injectable()
class MockRpcService {
  getTxsStatus = jest.fn().mockImplementation((txHashes: Array<string>) => {
    const ret = txHashes.map((hash) => {
      return [hash, getTxsStatusReturnStatus[hash]]
    })
    return Promise.resolve(ret)
  })
  getLockScript = jest.fn().mockImplementation(() => {
    return null
  })
  sendTransaction = jest.fn().mockImplementation(() => {
    return null
  })
}

/*//let matchSwapReturn: SwapMatch
//let matchLiquidityReturn: MatchRecord
@injectable()
class MockMatcherService {
  // @ts-ignore
  matchSwap = jest.fn().mockImplementation(() => {
    return null
  })
  // @ts-ignore
  matchLiquidity = jest.fn().mockImplementation(() => {
    return null
  })
  initLiquidity = jest.fn().mockImplementation(() => {
    return null
  })
}*/

/*@injectable()
class MockTransactionService {
  // @ts-ignore
  composeLiquidityInitTransaction = jest.fn().mockImplementation(() => {
    return null
  })
  // @ts-ignore
  composeTransaction = jest.fn().mockImplementation(() => {
    return null
  })
}*/

describe('Test tasks module', () => {
  let taskService: TaskService
  let dealService: DealService
  // let mockRpcService: MockRpcService
  // let mockMatcherService: MockMatcherService
  //let spyTransactionService: TransactionService
  // let spyTask
  // let spyHandler
  // @ts-ignore
  let signWitness
  let handler
  const mark: bigint = 1234n
  beforeAll(async () => {

    const connection = await createConnection(TYPEORM_ENV)

    modules[ScanService.name] = Symbol(ScanService.name)
    modules[DealService.name] = Symbol(DealService.name)
    modules[RpcService.name] = Symbol(RpcService.name)
    modules[MatcherService.name] = Symbol(MatcherService.name)
    modules[TransactionService.name] = Symbol(TransactionService.name)
    modules[TaskService.name] = Symbol(TaskService.name)
    modules[MonitorService.name] = Symbol(MonitorService.name)
    container.bind(modules[ScanService.name]).to(MockScanService)
    container.bind(modules[DealService.name]).to(DealService)
    container.bind(modules[RpcService.name]).to(MockRpcService)
    container.bind(modules[MatcherService.name]).to(MatcherService)
    container.bind(modules[TransactionService.name]).to(TransactionService)
    container.bind(modules[TaskService.name]).to(TaskService)
    container.bind(modules[MonitorService.name]).to(MonitorService)

    taskService = container.get(modules[TaskService.name])
    dealService = container.get(modules[DealService.name])
    // mockRpcService = container.get(modules[RpcService.name])
    // mockMatcherService = container.get(modules[MatcherService.name])
    // mockTransactionService = container.get(modules[TransactionService.name])

    handler = jest.spyOn(taskService, 'handler').mockImplementation(async () => {
      return
    })

    await dealService.clearDb()
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    await dealService.clearDb()

  })

  it('0, save deal', async () => {
    await dealService.saveDeal({
      txHash: '0x7c603c9df830c0c59b3524417de5197da3fc49b00e255fff0ba3fbc883d786ac',
      preTxHash: '0x1111111111111111111111111111111111111111111111111111111111111100',
      tx: '{"version":"0x0","headerDeps":[],"cellDeps":[{"outPoint":{"txHash":"0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0x9b4b038fa701001ee8b2898880f3cb9a9ad8acea3352a0476381c07edf38b83d","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0xbc050cd03f79232ab36a03f1f66a606c7c25fc8794fe0a642bf77c6b5cda5b1f","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0x26988bb050e3e6c9e5b96a839fd1a1ee4ce389c50a01826b04c60dacbc081671","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0x80151855e5041081959a4c72cbccd73bd114439c099e20308a0a8dd7a3b533dd","index":"0x0"},"depType":"code"},{"outPoint":{"txHash":"0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37","index":"0x0"},"depType":"depGroup"}],"inputs":[{"previousOutput":{"txHash":"0x1111111111111111111111111111111111111111111111111111111111111100","index":"0x0"},"since":"0x0"},{"previousOutput":{"txHash":"0x1111111111111111111111111111111111111111111111111111111111111100","index":"0x1"},"since":"0x0"},{"previousOutput":{"txHash":"0x1111111111111111111111111111111111111111111111111111111111111111","index":"0x0"},"since":"0x0"},{"previousOutput":{"txHash":"0x3333333333333333333333333333333333333333333333333333333333333300","index":"0x1"},"since":"0x0"}],"witnesses":["0x1c00000010000000100000001c000000080000000000000000000000","0x","0x5500000010000000550000005500000041000000aad8b1d1c5fdfeadb65ecf777cae880dcfc9da00b509e241876b52dd829e8128113231a302eb66cc595f0c543e34d66caab06ddae4636f0f6d77c0e7e9611fee01","0x"],"outputs":[{"capacity":"0x5d21dba00","type":{"codeHash":"0xb31869abb8b9f2f62bbb89ad89e525fa39b54ee57383a53949a89d80fc468929","hashType":"data","args":"0x0000000000000000000000000000000000000000000000000000000000000016"},"lock":{"codeHash":"0x74f5bee3f3ebc5ff31dbeb4da1b37099dfde61fe5f251375fe3ca9618542cca2","hashType":"data","args":"0xbfb315567328439666a3a56a3f5cf7ea671142c24189404c306c5ffd5a3a11d0e6b60edd8c90130829a2ee360c356069aba738fae25b9f89ebe3fbb31e5076a6"}},{"capacity":"0x749a01900","type":{"codeHash":"0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4","hashType":"type","args":"0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902"},"lock":{"codeHash":"0x74f5bee3f3ebc5ff31dbeb4da1b37099dfde61fe5f251375fe3ca9618542cca2","hashType":"data","args":"0xbfb315567328439666a3a56a3f5cf7ea671142c24189404c306c5ffd5a3a11d0e6b60edd8c90130829a2ee360c356069aba738fae25b9f89ebe3fbb31e5076a6"}},{"capacity":"0x1b31d2900","type":null,"lock":{"codeHash":"0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8","hashType":"type","args":"0x7e5cb4abd670e6f9c1bd925fe12cb1bec51b35e7"}},{"capacity":"0x395e95a00","type":{"codeHash":"0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4","hashType":"type","args":"0x0cd23f2e82f785ba11dcd46554d01b8f527aa397e479da9c7a697fa72aab4721"},"lock":{"args":"0x","codeHash":"0x0000000000000000000000000000000000000000000000000000000000000000","hashType":"data"}},{"capacity":"0x395e95a00","type":{"codeHash":"0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4","hashType":"type","args":"0x6fe3733cd9df22d05b8a70f7b505d0fb67fb58fb88693217135ff5079713e902"},"lock":{"args":"0x","codeHash":"0x0000000000000000000000000000000000000000000000000000000000000000","hashType":"data"}}],"outputsData":["0x009ffaf4020000000000000000000000019ffaf4020000000000000000000000019ffaf40200000000000000000000003ecc589fd5838c71dc2e607c887dde781090fdea736214bb7485d2d43b911851","0x019ffaf4020000000000000000000000","0x","0x01bbeea0000000000000000000000000","0xff281db3010000000000000000000000"]}',
      info: '{"capacity":25000000000,"ckbReserve":12700000000,"sudtReserve":12700000001,"totalLiquidity":12700000001,"ckbReserveOriginal":10000000000,"sudtReserveOriginal":10000000000,"totalLiquidityOriginal":10000000000,"outPoint":{"tx_hash":"0x1111111111111111111111111111111111111111111111111111111111111100","index":"0x0"}}',
      pool: '{"capacity":31300000000,"sudtYInAmount":12700000001,"capacityOriginal":28600000000,"sudtReserveOriginal":10000000000,"outPoint":{"tx_hash":"0x1111111111111111111111111111111111111111111111111111111111111100","index":"0x1"}}',
      matcherChange: '{"capacity":7300000000,"ckbReserveOriginal":0,"outPoint":{"tx_hash":"0x1111111111111111111111111111111111111111111111111111111111111111","index":"0x0"}}',
      reqOutpoints: '0x3333333333333333333333333333333333333333333333333333333333333300-0x1',
      status: 0,
    })

    await dealService.getAllSentDeals()

    await dealService.clearDb()
  })

  /*
             /----C1-------C2
           /     |         |\
         /       A5----A6  | A8(user cancel)---A9
       /                   |  \-----------------\
 D1----D2-----A1------A2   B1------B2,New        B3,new

  info is on D1
  D1 is committed, D2 is sent, A1 should base on D2
  req1 in D2
  now receive req1 and req2
 */

  it('1, D1 is committed, D2 is sent, A1 should base on D2', async () => {
    let d1 = D1()
    //D1.status = DealStatus.Committed
    await dealService.saveDeal(d1)

    let d2 = D2()
    d2.reqOutpoints = req1 + '-0x0'
    d2.info = JSONbig.stringify({ totalLiquidity: mark })
    await dealService.saveDeal(d2)

    let request1 = LiquidityAddReq.default()
    request1.outPoint.tx_hash = req1

    let request2 = LiquidityAddReq.default()
    request2.outPoint.tx_hash = req2

    scanAllReturn = [
      [
        new LiquidityAddTransformation(request1),
        new LiquidityAddTransformation(request2),
      ],
      [],
      [],
      [],
      new Info(0n,
        0n,
        0n,
        0n,
        {
          tx_hash: D1().txHash,
          index: '0x0',
        },
      ),
      PoolX.default(),
      MatcherChange.default(),
    ]

    getTxsStatusReturnStatus = DealStatus.Sent

    await taskService.task()
    expect(handler).toHaveBeenCalled()

    //console.log(JSONbig.stringify(handler.mock.calls[0], null, 2))

    const args = handler.mock.calls[0]
    // check requests
    expect(args[0].length).toEqual(1)
    expect(args[0][0].request.outPoint.tx_hash).toEqual(req2)

    // chech info, should be D2
    expect(args[4].totalLiquidity).toEqual(mark)


  })

  /*
             /----C1-------C2
           /     |         |\
         /       A5----A6  | A8(user cancel)---A9
       /                   |  \-----------------\
 D1----D2-----A1------A2   B1------B2,New        B3,new

  D1 D2 are committed,
  A1 and A2 are sent
  C1 is grabbed by competitor
  now receive req1, and we should cut off A1 and A2
  and compose based on C1
 */
  it('2, D1 & D2 are committed', async () => {

    let d1 = D1()
    await dealService.saveDeal(d1)

    let d2 = D2()
    await dealService.saveDeal(d2)

    let a1 = A1()
    await dealService.saveDeal(a1)

    let a2 = A2()
    await dealService.saveDeal(a2)


    // we should match this request in A5
    let request1 = LiquidityAddReq.default()
    request1.outPoint.tx_hash = req1


    scanAllReturn = [
      [
        new LiquidityAddTransformation(request1),
      ],
      [],
      [],
      [],
      // this is C1
      new Info(
        0n,
        0n,
        0n,
        mark,
        {
          tx_hash: C1().txHash,
          index: '0x0',
        },
      ),
      PoolX.default(),
      MatcherChange.default(),
    ]

    getTxsStatusReturnStatus = {}
    getTxsStatusReturnStatus[D1().txHash] = DealStatus.Committed
    getTxsStatusReturnStatus[D2().txHash] = DealStatus.Committed
    getTxsStatusReturnStatus[A1().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A2().txHash] = DealStatus.CutOff

    await taskService.task()

    expect(handler).toHaveBeenCalled()

    //console.log(JSONbig.stringify(handler.mock.calls[0], null, 2))

    const args = handler.mock.calls[0]
    expect(args[0].length).toEqual(1)
    expect(args[0][0].request.outPoint.tx_hash).toEqual(req1)

    //
    expect(args[4].totalLiquidity).toEqual(mark)

    expect((await dealService.getByTxHash(D1().txHash))!.status).toEqual(DealStatus.Committed)
    expect((await dealService.getByTxHash(D2().txHash))!.status).toEqual(DealStatus.Committed)
    expect((await dealService.getByTxHash(A1().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A2().txHash))!.status).toEqual(DealStatus.CutOff)

  })

  /*
             /----C1-------C2
           /     |         |\
         /       A5----A6  | A8(user cancel)---A9
       /                   |  \-----------------\
 D1----D2-----A1------A2   B1------B2,New        B3,new

 D1 and D2 are committed,
 A1 and A2 are sent should be cutoff
 C1 is grabbed by competitor
 A5 and A6 is composed but opponent grabbed C2
 now receive req1, and we should cut off all and compose B1
*/
  it('3, D1 & D2 are committed, A5 & A6 is based on C1 but now is C2, B1 is composed', async () => {
    let d1 = D1()
    await dealService.saveDeal(d1)

    let d2 = D2()
    await dealService.saveDeal(d2)

    let a1 = A1()
    await dealService.saveDeal(a1)

    let a2 = A2()
    await dealService.saveDeal(a2)

    let a5 = A5()
    await dealService.saveDeal(a5)

    let a6 = A6()
    await dealService.saveDeal(a6)

    // we should match this request in A5
    let request1 = LiquidityAddReq.default()
    request1.outPoint.tx_hash = req1


    scanAllReturn = [
      [
        new LiquidityAddTransformation(request1),
      ],
      [],
      [],
      [],
      // this is C2
      new Info(
        0n,
        0n,
        0n,
        mark,
        {
          tx_hash: C2().txHash,
          index: '0x0',
        },
      ),
      PoolX.default(),
      MatcherChange.default(),
    ]

    getTxsStatusReturnStatus = {}
    getTxsStatusReturnStatus[D1().txHash] = DealStatus.Committed
    getTxsStatusReturnStatus[D2().txHash] = DealStatus.Committed
    getTxsStatusReturnStatus[A1().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A2().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A5().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A6().txHash] = DealStatus.CutOff

    await taskService.task()

    expect(handler).toHaveBeenCalled()

    //console.log(JSONbig.stringify(handler.mock.calls[0], null, 2))

    const args = handler.mock.calls[0]
    expect(args[0].length).toEqual(1)
    expect(args[0][0].request.outPoint.tx_hash).toEqual(req1)

    //
    expect(args[4].totalLiquidity).toEqual(mark)

    expect((await dealService.getByTxHash(D1().txHash))!.status).toEqual(DealStatus.Committed)
    expect((await dealService.getByTxHash(D2().txHash))!.status).toEqual(DealStatus.Committed)
    expect((await dealService.getByTxHash(A1().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A2().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A5().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A6().txHash))!.status).toEqual(DealStatus.CutOff)

  })


  /*
             /----C1-------C2
           /     |         |\
         /       A5----A6  | A8(user cancel)---A9
       /                   |  \-----------------\
 D1----D2-----A1------A2   B1------B2,New        B3,new

 D1 and D2 are committed,
 A1 and A2 are sent should be cutoff
 C1 is grabbed by competitor
 A5 and A6 is composed but opponent grabbed C2
 A8 is composed with req1 and A9 is composed somehow
 now receive req2 and req3, and we should cut off all and compose B1 with req and req3
*/
  it('4, D1 & D2 are committed, A5 & A6 are based on C1\
  A8 & A9 are based on C2, now user cancel req in A8, should compose B1', async () => {
    let d1 = D1()
    await dealService.saveDeal(d1)

    let d2 = D2()
    await dealService.saveDeal(d2)

    let a1 = A1()
    await dealService.saveDeal(a1)

    let a2 = A2()
    await dealService.saveDeal(a2)

    let a5 = A5()
    await dealService.saveDeal(a5)

    let a6 = A6()
    await dealService.saveDeal(a6)

    let a8 = A8()
    a8.reqOutpoints = req1 + '-0x0'
    a8.info = JSONbig.stringify({ totalLiquidity: mark })
    await dealService.saveDeal(a8)

    let a9 = A9()
    await dealService.saveDeal(a9)


    // we should match this request in A5
    let request2 = LiquidityAddReq.default()
    request2.outPoint.tx_hash = req2

    let request3 = LiquidityAddReq.default()
    request3.outPoint.tx_hash = req3

    scanAllReturn = [
      [
        new LiquidityAddTransformation(request2),
        new LiquidityAddTransformation(request3),
      ],
      [],
      [],
      [],
      // this is C2
      new Info(
        0n,
        0n,
        0n,
        mark,
        {
          tx_hash: C2().txHash,
          index: '0x0',
        },
      ),
      PoolX.default(),
      MatcherChange.default(),
    ]

    getTxsStatusReturnStatus = {}
    getTxsStatusReturnStatus[D1().txHash] = DealStatus.Committed
    getTxsStatusReturnStatus[D2().txHash] = DealStatus.Committed
    getTxsStatusReturnStatus[A1().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A2().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A5().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A6().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A8().txHash] = DealStatus.Sent
    getTxsStatusReturnStatus[A9().txHash] = DealStatus.Sent

    await taskService.task()

    expect(handler).toHaveBeenCalled()

    //console.log(JSONbig.stringify(handler.mock.calls[0], null, 2))

    const args = handler.mock.calls[0]
    expect(args[0].length).toEqual(2)
    expect(args[0][0].request.outPoint.tx_hash).toEqual(req2)
    expect(args[0][1].request.outPoint.tx_hash).toEqual(req3)

    //
    expect(args[4].totalLiquidity).toEqual(mark)

    expect((await dealService.getByTxHash(D1().txHash))!.status).toEqual(DealStatus.Committed)
    expect((await dealService.getByTxHash(D2().txHash))!.status).toEqual(DealStatus.Committed)
    expect((await dealService.getByTxHash(A1().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A2().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A5().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A6().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A8().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A9().txHash))!.status).toEqual(DealStatus.CutOff)

  })


  /*
             /----C1-------C2
           /     |         |\
         /       A5----A6  | A8---A9(user cancel)
       /                   |  \-----------------\
 D1----D2-----A1------A2   B1------B2,New        B3,new

 D1 and D2 are committed,
 A1 and A2 are sent should be cutoff
 C1 is grabbed by competitor
 A5 and A6 is composed but opponent grabbed C2, a.k.a. C2 is committed
 A8 is composed with req1 and A9 is composed with req2
 now receive req1 and req3, which means req2 is canceled and A9 should be cut off
 we should cut off all and compose B3 with req2
*/
  it('5, D1 & D2 are committed, A5 & A6 are based on C1\
  A8 & A9 are based on C2, now user cancel req in A8, should compose B1', async () => {
    let d1 = D1()
    await dealService.saveDeal(d1)

    let d2 = D2()
    await dealService.saveDeal(d2)

    let a1 = A1()
    await dealService.saveDeal(a1)

    let a2 = A2()
    await dealService.saveDeal(a2)

    let a5 = A5()
    await dealService.saveDeal(a5)

    let a6 = A6()
    await dealService.saveDeal(a6)

    let a8 = A8()
    a8.reqOutpoints = req1 + '-0x0'
    a8.info = JSONbig.stringify({ totalLiquidity: mark })
    await dealService.saveDeal(a8)

    let a9 = A9()
    a8.reqOutpoints = req2 + '-0x0'
    await dealService.saveDeal(a9)


    // we should match this request in A5
    let request1 = LiquidityAddReq.default()
    request1.outPoint.tx_hash = req1

    let request3 = LiquidityAddReq.default()
    request3.outPoint.tx_hash = req3

    scanAllReturn = [
      [
        new LiquidityAddTransformation(request1),
        new LiquidityAddTransformation(request3),
      ],
      [],
      [],
      [],
      // this is C2
      new Info(
        0n,
        0n,
        0n,
        mark,
        {
          tx_hash: C2().txHash,
          index: '0x0',
        },
      ),
      PoolX.default(),
      MatcherChange.default(),
    ]

    getTxsStatusReturnStatus = {}
    getTxsStatusReturnStatus[D1().txHash] = DealStatus.Committed
    getTxsStatusReturnStatus[D2().txHash] = DealStatus.Committed
    getTxsStatusReturnStatus[A1().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A2().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A5().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A6().txHash] = DealStatus.CutOff
    getTxsStatusReturnStatus[A8().txHash] = DealStatus.Sent
    getTxsStatusReturnStatus[A9().txHash] = DealStatus.Sent

    await taskService.task()

    expect(handler).toHaveBeenCalled()

    //console.log(JSONbig.stringify(handler.mock.calls[0], null, 2))

    //B3 is based on A8
    const args = handler.mock.calls[0]
    expect(args[0].length).toEqual(1)
    expect(args[0][0].request.outPoint.tx_hash).toEqual(req3)

    //
    expect(args[4].totalLiquidity).toEqual(mark)

    expect((await dealService.getByTxHash(D1().txHash))!.status).toEqual(DealStatus.Committed)
    expect((await dealService.getByTxHash(D2().txHash))!.status).toEqual(DealStatus.Committed)
    expect((await dealService.getByTxHash(A1().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A2().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A5().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A6().txHash))!.status).toEqual(DealStatus.CutOff)
    expect((await dealService.getByTxHash(A8().txHash))!.status).toEqual(DealStatus.Sent)
    expect((await dealService.getByTxHash(A9().txHash))!.status).toEqual(DealStatus.CutOff)

  })
})
