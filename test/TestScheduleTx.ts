import * as EAC from 'eac.js-lib';
import * as Bb from 'bluebird';
import * as Web3 from 'web3';
import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import calcEndowment from './helpers/calcEndowment';
import 'mocha';

describe('ScheduleTx', () => {
  it('schedules a basic transaction', async () => {
    const provider = new Web3.providers.HttpProvider('http://localhost:8545/');
    const web3 = new Web3(provider);
    const eac = EAC(web3);

    const scheduler = await eac.scheduler();

    const latestBlock = await Bb.fromCallback((callback) => web3.eth.getBlockNumber(callback));
    const mainAccount = web3.eth.accounts[0];

    const callGas = new BigNumber(1000000);
    const callValue = new BigNumber(1);
    const gasPrice = new BigNumber(1);
    const fee = new BigNumber(0);
    const bounty = new BigNumber(0);

    const endowment = calcEndowment(eac, callGas, callValue, gasPrice, fee, bounty);

    await scheduler.initSender({
      from: mainAccount,
      gas: 4000000,
      value: endowment,
    });

    const receipt = await scheduler.blockSchedule(
      mainAccount,
      callGas,
      '', // callData
      callValue,
      '255', // windowSize
      latestBlock + 100, // windowStart
      1, // gasPrice
      fee,
      bounty,
      '0', // requiredDeposit
      true
    );

    console.log(receipt.logs[1].topics[0]);
    expect(receipt).to.exist;
  }).timeout(15000);

})
