import * as EAC from 'eac.js-lib';
import * as Bb from 'bluebird';
import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import { calcEndowment, providerUrl } from '../helpers';
import { W3Util } from '../../src';

const CLAIM_WINDOW_SIZE = 255;
const w3Util = new W3Util();

export const getHelperMethods = (web3: any) => {
  function sendRpc(method: any, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync(
        {
          jsonrpc: '2.0',
          method,
          params: params || [],
          id: new Date().getTime()
        },
        (err: any, res: any) => {
          if (err) {
            reject(err);
          }
          resolve(res);
        }
      );
    });
  }

  function waitUntilBlock(seconds: any, targetBlock: any) {
    return new Promise((resolve, reject) => {
      const asyncIterator = function _asyncIterator() {
        return web3.eth.getBlock('latest', (err: any, ref: any) => {
          if (err) {
            reject(err);
          }

          const num = ref.number;

          if (num >= targetBlock - 1) {
            return sendRpc('evm_increaseTime', [seconds])
              .then(() => sendRpc('evm_mine'))
              .then(resolve);
          }
          return sendRpc('evm_mine').then(asyncIterator);
        });
      };
      asyncIterator();
    });
  }

  function takeSnapshot(): Promise<number> {
    return sendRpc('evm_snapshot').then(res => res.result);
  }

  function revertSnapshot(id: number): Promise<boolean> {
    return sendRpc('evm_revert', id).then(res => res.result);
  }

  async function withSnapshotRevert(fn: any): Promise<boolean> {
    const snapshot = await takeSnapshot();
    try {
      await fn();
    } catch (error) {
      console.log(`Error ${error} in withSnapshotRevert`);
    }
    return await revertSnapshot(snapshot);
  }

  return { waitUntilBlock, withSnapshotRevert };
};

export const SCHEDULED_TX_PARAMS = {
  callValue: new BigNumber(Math.pow(10, 18))
};

export const scheduleTestTx = async () => {
  const web3 = w3Util.getWeb3FromProviderUrl(providerUrl);
  const eac = EAC(web3);

  const { waitUntilBlock } = getHelperMethods(web3);

  const scheduler = await eac.scheduler();

  let latestBlock: number = (await Bb.fromCallback((callback: any) =>
    web3.eth.getBlockNumber(callback)
  )) as number;

  /*
     * Since in transaction request library there's check that subtracts
     * claimWindowSize from current block then this block should be higher than claimWindowSize
     * to make sure calculations work fine
     */
  if (latestBlock < CLAIM_WINDOW_SIZE + 1) {
    await waitUntilBlock(0, CLAIM_WINDOW_SIZE);
  }

  latestBlock = (await Bb.fromCallback((callback: any) =>
    web3.eth.getBlockNumber(callback)
  )) as number;

  const { callValue } = SCHEDULED_TX_PARAMS;

  const callGas = new BigNumber(1000000);
  const gasPrice = new BigNumber(web3.toWei(20, 'gwei'));
  const fee = new BigNumber(0);
  const bounty = new BigNumber(0);

  const endowment = calcEndowment(eac, callGas, callValue, gasPrice, fee, bounty);

  // const filename = 'wallet.txt';
  // const wallet = createWallet(web3, 1, filename, 'password123');

  const accounts = await Bb.fromCallback((callback: any) => web3.eth.getAccounts(callback));
  const mainAccount = accounts[0];

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
    gasPrice, // gasPrice
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
      const web3 = w3Util.getWeb3FromProviderUrl(providerUrl);
      const { withSnapshotRevert } = getHelperMethods(web3);

      await withSnapshotRevert(async () => {
        const receipt = await scheduleTestTx();

        expect(receipt).to.exist; // tslint:disable-line no-unused-expression
      });
    }).timeout(20000);
  });
}
