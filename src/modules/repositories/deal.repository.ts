import { EntityRepository, Repository } from 'typeorm'
import { Deal, DealStatus } from '../models/entities/deal.entity'
import { workerLogger } from '../../utils/workerLogger'

@EntityRepository(Deal)
class DealRepository extends Repository<Deal> {
  // @ts-ignore
  #error = (msg: string) => {
    workerLogger.error(`DealRepository: ${msg}`)
  }

  saveDeal = async (deal: Omit<Deal, 'id' | 'createdAt'>): Promise<void> => {
    const dealTosave: Deal = this.create(deal)

    await this.save(dealTosave)

    return
  }

  updateDealStatus = async (txHash: string, status: DealStatus) => {
    await this.update(txHash, { status })
  }

  getByTxHahs = async (txHash: string): Promise<Deal | null> => {
    return (await this.findOne({
      where: {
        txHash: txHash,
      },
    }) || null)
  }

  getByPreTxHahs = async (preTxHash: string): Promise<Deal | null> => {
    return (
      (await this.findOne({
        where: {
          preTxHash: preTxHash,
        },
      })) || null
    )
  }

  getAllSentDeals = async (): Promise<Array<Deal>> => {


    return await this.find({
      where: {
        status: DealStatus.Sent,
      },
      order: {
        id: 'ASC',
      },
    })

  }
}

export default DealRepository
