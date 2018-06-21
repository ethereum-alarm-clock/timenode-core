import BigNumber from 'bignumber.js';

export function calcEndowment(
  eac: any,
  gasAmount: BigNumber = new BigNumber(0),
  amountToSend: BigNumber = new BigNumber(0),
  gasPrice: BigNumber = new BigNumber(0),
  fee: BigNumber = new BigNumber(0),
  payment: BigNumber = new BigNumber(0),
) {
  const {
    Util: { calcEndowment },
  } = eac;

  const endowment = calcEndowment(
    gasAmount,
    amountToSend,
    gasPrice,
    fee,
    payment
  );

  return endowment;
}
