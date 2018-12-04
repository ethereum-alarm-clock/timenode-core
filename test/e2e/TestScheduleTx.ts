import { EAC, Util } from '@ethereum-alarm-clock/lib';
import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import { providerUrl } from '../helpers';
import { getHelperMethods } from '../helpers/Helpers';

const web3 = Util.getWeb3FromProviderUrl(providerUrl);

export const SCHEDULED_TX_PARAMS = {
  callValue: new BigNumber(Math.pow(10, 18))
};

export const scheduleTestTx = async (blocksInFuture = 270) => {
  const eac = new EAC(web3);

  const { callValue } = SCHEDULED_TX_PARAMS;

  const callGas = new BigNumber(1000000);
  const gasPrice = new BigNumber(web3.utils.toWei('20', 'gwei'));
  const fee = new BigNumber(0);
  const bounty = new BigNumber(web3.utils.toWei('0.1', 'ether'));

  const accounts = await web3.eth.getAccounts();
  const mainAccount = accounts[0];

  const receipt = await eac.schedule({
    from: mainAccount,
    toAddress: mainAccount,
    callGas,
    callData: '',
    callValue,
    windowSize: new BigNumber(30),
    windowStart: new BigNumber((await web3.eth.getBlockNumber()) + blocksInFuture),
    gasPrice,
    fee,
    bounty,
    requiredDeposit: new BigNumber('0'),
    timestampScheduling: false
  });

  return eac.getTxRequestFromReceipt(receipt);
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
