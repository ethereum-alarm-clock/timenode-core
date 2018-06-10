const EAC = require('eac.js-lib');
const Bb = require('bluebird');
const Web3 = require('web3');
const expect = require('chai').expect;
const { promisify } = require('util');
const calcEndowment = require('./helpers/calcEndowment');

const { TimeNode } = require('../index');
const standardConfig = require('./helpers/standardConfig');

describe('ScheduleTx', () => {

  it('schedules a basic transaction', async () => {
    const provider = new Web3.providers.HttpProvider('http://localhost:8545');
    const web3 = new Web3(provider);
    const eac = EAC(web3);

    const scheduler = await eac.scheduler();

    const latestBlock = await Bb.fromCallback((callback) => web3.eth.getBlockNumber(callback));
    const mainAccount = web3.eth.accounts[0];

    const toAddress = mainAccount;
    const callGas = 1000000;
    const callValue = 1;
    const gasPrice = 1;
    const fee = 0;
    const bounty = 0;

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

    expect(receipt).to.exist;
  }).timeout(15000);

})
