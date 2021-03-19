import { injectable } from 'inversify'
import { getConnection, In } from 'typeorm'
import DealRepository from '../repositories/deal.repository'
import { Deal, DealStatus } from '../models/entities/deal.entity'
import { INSTANCE_NAME,NODE_ENV } from '../../utils/workEnv'
import { workerLogger } from '../../utils/workerLogger'

@injectable()
export default class DealService {
  #dealRepository: DealRepository

  constructor() {
    this.#info(`using db profile ${INSTANCE_NAME}`)
    this.#dealRepository = getConnection(INSTANCE_NAME).getCustomRepository(DealRepository)
  }

  #error = (msg: string) => {
    workerLogger.error(`DealService: ${msg}`)
  }
  #info = (msg: string) => {
    workerLogger.info(`DealService: ${msg}`)
  }

  clearDb = async (): Promise<void> =>{
    if(NODE_ENV !== 'test'){
      this.#error('clearDb is forbidden for not test environment')
      return
    }
    await this.#dealRepository.clear()
  }

  getAllSentDeals = async (): Promise<Array<Deal>> => {
    return await this.#dealRepository.getAllSentDeals()

  }

  getByPreTxHash = async (preTxHash: string): Promise<Deal | null> => {
    return await this.#dealRepository.getByPreTxHahs(preTxHash)
  }

  getByTxHash = async (txHash: string): Promise<Deal | null> => {
    return await this.#dealRepository.getByTxHahs(txHash)
  }

  saveDeal = async (deal: Omit<Deal, 'createdAt' | 'id'>): Promise<void> => {
    return await this.#dealRepository.saveDeal(deal)
  }

  updateDealStatus = async (txHash: string, status: DealStatus) => {
    await this.#dealRepository
      .createQueryBuilder()
      .update(Deal)
      .set({
        status: status,
      })
      .where({
        txHash: txHash,
      })
      .execute()
  }
  // only update Committed and Cut-off status
  updateDealsStatus = async (input: Array<[string, Omit<DealStatus, DealStatus.Sent>]>) => {
    let committed_deals: Array<string> = input
      .filter(([_txHash, status]) => {
        return status === DealStatus.Committed
      })
      .map(([txHash, _status]) => {
        return txHash
      })

    if (committed_deals.length) {
      await this.#dealRepository
        .createQueryBuilder()
        .update(Deal)
        .set({
          status: DealStatus.Committed,
        })
        .where({
          txHash: In(committed_deals),
        })
        .execute()
    }

    let cut_off_deals: Array<string> = input
      .filter(([_txHash, status]) => {
        return status === DealStatus.CutOff
      })
      .map(([txHash, _status]) => {
        return txHash
      })

    if (cut_off_deals.length) {
      await this.#dealRepository
        .createQueryBuilder()
        .update(Deal)
        .set({
          status: DealStatus.CutOff,
        })
        .where({
          txHash: In(cut_off_deals),
        })
        .execute()
    }
  }

  // if a deal is already marked 'Committed', all its ancestors must be 'Committed'
  updateDealTxsChainsToCommitted = async (deal: Deal) => {
    let pointer: Deal = deal
    while (pointer.status == DealStatus.Sent) {
      pointer.status = DealStatus.Committed
      await this.#dealRepository.saveDeal(pointer)

      // get the pre tx and recursive check if it need to be set Committed
      pointer = (await this.getByPreTxHash(pointer.preTxHash))!
    }
  }

  getAllDerivates = async (txHash:string) :Promise<Array<Deal>> => {
    let derivatives : Array<Deal> =[]

    let currentTxHash = txHash
    while (true){
      let derivative = await this.getByPreTxHash(currentTxHash)
      if(derivative){
        derivatives.push(derivative)
        currentTxHash = derivative.txHash
        continue
      }
      break
    }
    return derivatives
  }
}
