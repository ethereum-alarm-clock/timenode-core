import * as EAC from 'eac.js-lib';
import * as Bb from 'bluebird';
import * as Web3 from 'web3';
import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import { calcEndowment, providerUrl } from '../helpers';
// import { createWallet } from './helpers';

const CLAIM_WINDOW_SIZE = 255;

export const getHelperMethods = (web3: any) => {
  function sendRpc(method: any, params?: any) {
    return new Promise(function(resolve) {
      web3.currentProvider.sendAsync(
        {
          jsonrpc: '2.0',
          method,
          params: params || [],
          id: new Date().getTime()
        },
        function(err: any, res: any) {
          resolve(res);
        }
      );
    });
  }

  function waitUntilBlock(seconds: any, targetBlock: any) {
    return new Promise(function(resolve) {
      let asyncIterator = function asyncIterator() {
        return web3.eth.getBlock('latest', function(e: any, _ref: any) {
          let number = _ref.number;

          if (number >= targetBlock - 1) {
            return sendRpc('evm_increaseTime', [seconds])
              .then(function() {
                return sendRpc('evm_mine');
              })
              .then(resolve);
          }
          return sendRpc('evm_mine').then(asyncIterator);
        });
      };
      asyncIterator();
    });
  }

  return { waitUntilBlock };
};

export const SCHEDULED_TX_PARAMS = {
  callValue: new BigNumber(Math.pow(10, 18))
};

export const scheduleTestTx = async () => {
  const provider = new Web3.providers.HttpProvider(providerUrl);
  const web3 = new Web3(provider);
  const eac = EAC(web3);

  const { waitUntilBlock } = getHelperMethods(web3);

  const scheduler = await eac.scheduler();

  let latestBlock = await Bb.fromCallback(callback => web3.eth.getBlockNumber(callback));

  /*
     * Since in transaction request library there's check that subtracts
     * claimWindowSize from current block then this block should be higher than claimWindowSize
     * to make sure calculations work fine
     */
  if (latestBlock < CLAIM_WINDOW_SIZE + 1) {
    await waitUntilBlock(0, CLAIM_WINDOW_SIZE);
  }

  latestBlock = await Bb.fromCallback(callback => web3.eth.getBlockNumber(callback));

  const { callValue } = SCHEDULED_TX_PARAMS;

  const callGas = new BigNumber(1000000);
  const gasPrice = new BigNumber(1);
  const fee = new BigNumber(0);
  const bounty = new BigNumber(0);

  const endowment = calcEndowment(eac, callGas, callValue, gasPrice, fee, bounty);

  // const filename = 'wallet.txt';
  // const wallet = createWallet(web3, 1, filename, 'password123');
  const mainAccount = web3.eth.accounts[0]; // wallet.getAddresses()[0];

  await scheduler.initSender({
    from: mainAccount,
    gas: 4000000,
    value: endowment
  });

  const receipt = await scheduler.blockSchedule(
    mainAccount,
    callGas,
    '', // callData
    callValue,
    '255', // windowSize
    latestBlock + 270, // windowStart
    1, // gasPrice
    fee,
    bounty,
    '0', // requiredDeposit
    true
  );

  return eac.Util.getTxRequestFromReceipt(receipt);
};

if (process.env.RUN_ONLY_OPTIONAL_TESTS !== 'true') {
  describe('ScheduleTx', () => {
    it('schedules a basic transaction', async () => {
      const receipt = await scheduleTestTx();

      expect(receipt).to.exist;
    }).timeout(20000);
  });
}
