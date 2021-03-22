import {Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique} from 'typeorm'

/*
        /------> Missing       <--\
  Sent --------> Pending <---------|
       \-------> Committed     <--/
 */
export enum DealStatus {
    Sent,
    Committed,
    CutOff,
}

@Entity()
@Unique(['txHash'])
export class Deal {
    @Index({unique: true})
    @PrimaryGeneratedColumn('increment', {name: 'id', type: 'integer'})
    id!: number

    // this deal's tx hash, which also means the output info cell's outpoint
    @Column('varchar', {name: 'tx_hash'})
    txHash!: string

    // easy for backwards retrieve, which also means the previous info cell's outpoint
    @Column('varchar', {name: 'pre_tx_hahs'})
    preTxHash!: string

    // the tx, used to re-send the tx, in JSONbig format
    @Column('varchar', {name: 'tx'})
    tx!: string

    // the info_cell this deal finishes, in JSONbig format
    @Column('varchar', {name: 'info'})
    info!: string

    // the pool_cell this deal finishes, in JSONbig format
    @Column('varchar', {name: 'poolX'})
    poolX!: string

    // the pool_cell this deal finishes, in JSONbig format
    @Column('varchar', {name: 'poolY'})
    poolY!: string

    // the matcher_change_cell this deal finishes, in JSONbig format
    @Column('varchar', {name: 'matcherChange'})
    matcherChange!: string

    //处理了哪些req,[0x????-0x??,0x????-0x??,0x????-0x??]
    @Column('varchar', {name: 'req_outpoint'})
    reqOutpoints!: string

    //只有deal有状态,order依赖于deal,没有状态
    @Column('int8', {name: 'staus'})
    status!: DealStatus

    @CreateDateColumn({name: 'created_at'})
    createdAt!: Date
}
