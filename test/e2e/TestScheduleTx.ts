import * as EAC from 'eac.js-lib';
import * as Bb from 'bluebird';
import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import { calcEndowment, providerUrl } from '../helpers';
import { W3Util } from '../../src';
import { getHelperMethods } from '../helpers/Helpers';

const web3 = W3Util.getWeb3FromProviderUrl(providerUrl);
const util = new W3Util(web3);

export const SCHEDULED_TX_PARAMS = {
  callValue: new BigNumber(Math.pow(10, 18))
};

export const scheduleTestTx = async () => {
  const eac = EAC(web3);

  const scheduler = await eac.scheduler();

  const { callValue } = SCHEDULED_TX_PARAMS;

  const callGas = new BigNumber(1000000);
  const gasPrice = new BigNumber(web3.toWei(20, 'gwei'));
  const fee = new BigNumber(0);
  const bounty = web3.toWei('0.1', 'ether');

  const endowment = calcEndowment(eac, callGas, callValue, gasPrice, fee, bounty);

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
    30, // windowSize
    (await util.getBlockNumber()) + 270, // windowStart
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
      const { withSnapshotRevert } = getHelperMethods(web3);

      await withSnapshotRevert(async () => {
        const receipt = await scheduleTestTx();

        expect(receipt).to.exist; // tslint:disable-line no-unused-expression
      });
    }).timeout(20000);
  });
}
