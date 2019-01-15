import { Util } from '@ethereum-alarm-clock/lib';
import { expect } from 'chai';
import { providerUrl } from '../helpers';
import { getHelperMethods } from '../helpers/Helpers';
import { scheduleTestTx } from '../helpers/scheduleTestTx';

const web3 = Util.getWeb3FromProviderUrl(providerUrl);

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
