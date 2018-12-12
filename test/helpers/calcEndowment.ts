import BigNumber from 'bignumber.js';
import { EAC } from '@ethereum-alarm-clock/lib';

export function calcEndowment(
  eac: EAC,
  gasAmount: BigNumber = new BigNumber(0),
  amountToSend: BigNumber = new BigNumber(0),
  gasPrice: BigNumber = new BigNumber(0),
  fee: BigNumber = new BigNumber(0),
  payment: BigNumber = new BigNumber(0)
) {
  return eac.util.calcEndowment(gasAmount, amountToSend, gasPrice, fee, payment);
}
