const BigNumber = require('bignumber.js');

function calcEndowment(
  eac,
  gasAmount = 0,
  amountToSend = 0,
  gasPrice = 0,
  fee = 0,
  payment = 0
) {
  gasAmount = gasAmount || 0;
  amountToSend = amountToSend || 0;
  gasPrice = gasPrice || 0;
  fee = fee || 0;
  payment = payment || 0;

  const {
    Util: { calcEndowment },
  } = eac;

  const endowment = calcEndowment(
    new BigNumber(gasAmount),
    new BigNumber(amountToSend),
    new BigNumber(gasPrice),
    new BigNumber(fee),
    new BigNumber(payment)
  );

  return endowment;
}

module.exports = calcEndowment;