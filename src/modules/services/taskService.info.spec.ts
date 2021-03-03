/*
            /----C1-------C2
          /     |         |\
        /       A5----A6  | A8(user cancel)---A9
      /                   |
D1----D2-----A1------A2   B1------B2,New

 */

export const req1 = '0x1111111111111111111111111111111111111111111111111111111111111101'
export const req2 = '0x1111111111111111111111111111111111111111111111111111111111111102'
export const req3 = '0x1111111111111111111111111111111111111111111111111111111111111103'

export const D1 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000D1',
    preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000D0',
    tx: 'null',
    info: 'null',
    pool: 'null',
    matcherChange: 'null',
    reqOutpoints: '',
    status: 0,
}}

export const D2 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000D2',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000D1',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const A1 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000A1',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000D2',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const A2 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000A2',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000A1',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const C1 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000C1',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000D2',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const C2 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000C2',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000C1',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const A5 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000A5',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000C1',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const A6 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000A6',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000A5',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const A8 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000A8',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000C2',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const A9 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000A9',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000A8',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

export const B1 = () =>  {return{
  txHash: '0x00000000000000000000000000000000000000000000000000000000000000B1',
  preTxHash: '0x00000000000000000000000000000000000000000000000000000000000000C2',
  tx: 'null',
  info: 'null',
  pool: 'null',
  matcherChange: 'null',
  reqOutpoints: '',
  status: 0,
}}

describe('nothing to test', () => {it('nothing', async () => {})})
