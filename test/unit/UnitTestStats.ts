import BigNumber from 'bignumber.js';
import * as loki from 'lokijs';
import { StatsDB } from '../../src/Stats';
import { assert } from 'chai';

describe('Stats Unit Tests', () => {
  const account_1: string = '0xd0700ed9f4d178adf25b45f7fa8a4ec7c230b098';
  const account_2: string = '0x0054a7eef4dc5d729115c71cba074151b3d41804';

  const tx_1: string = '0xaa55bf414ecef0285dcece4ddf78a0ee8beb6707';
  const tx_2: string = '0x9b7b4a8fdafda1b688c22fcb6f4bc97ed29ff676';
  let stats: StatsDB;

  const reset = async () => {
    stats = new StatsDB(new loki('stats.db'));
  };

  beforeEach(reset);

  describe('discovered()', () => {
    it('inserts discovered', async () => {
      stats.discovered(account_1, tx_1);
      stats.discovered(account_2, tx_1);

      const account_1Discovered = stats.getDiscovered(account_1);

      assert.lengthOf(account_1Discovered, 1);
    });

    it('selects unique discovered', async () => {
      stats.discovered(account_1, tx_1);
      stats.discovered(account_1, tx_1);
      stats.discovered(account_1, tx_1);
      stats.discovered(account_2, tx_1);

      const account_1Discovered = stats.getDiscovered(account_1);

      assert.lengthOf(account_1Discovered, 1);
    });
  });

  describe('claimed()', () => {
    it('inserts and selects successful claims', async () => {
      const cost = new BigNumber(10);
      const expectedBounty = new BigNumber(0);

      stats.claimed(account_1, tx_1, cost, true);
      stats.claimed(account_2, tx_2, cost, true);

      const successfulClaims = stats.getSuccessfulClaims(account_1);

      assert.lengthOf(successfulClaims, 1);
      assert.equal(successfulClaims[0].from, account_1);
      assert.equal(successfulClaims[0].txAddress, tx_1);

      assert.isTrue(successfulClaims[0].cost.equals(cost));
      assert.isTrue(successfulClaims[0].bounty.equals(expectedBounty));
    });

    it('inserts and selects failed claims', async () => {
      const cost = new BigNumber(10);

      stats.claimed(account_1, tx_1, cost, true);
      stats.claimed(account_2, tx_2, cost, false);

      const failedClaims_1 = stats.getFailedClaims(account_1);
      const failedClaims_2 = stats.getFailedClaims(account_2);

      assert.lengthOf(failedClaims_1, 0);
      assert.lengthOf(failedClaims_2, 1);
    });
  });

  describe('executed()', () => {
    it('inserts and selects successful executions', async () => {
      const cost = new BigNumber(10);
      const bounty = new BigNumber(15);

      stats.executed(account_1, tx_1, cost, bounty, true);
      stats.executed(account_2, tx_2, cost, bounty, true);

      const successfulExecutions = stats.getSuccessfulExecutions(account_1);

      assert.lengthOf(successfulExecutions, 1);
      assert.equal(successfulExecutions[0].from, account_1);
      assert.equal(successfulExecutions[0].txAddress, tx_1);

      assert.isTrue(successfulExecutions[0].cost.equals(cost));
      assert.isTrue(successfulExecutions[0].bounty.equals(bounty));
    });

    it('inserts and selects failed executions', async () => {
      const cost = new BigNumber(10);
      const bounty = new BigNumber(0);

      stats.executed(account_1, tx_1, cost, bounty, true);
      stats.executed(account_2, tx_2, cost, bounty, false);

      const failedExecutions_1 = stats.getFailedExecutions(account_1);
      const failedExecutions_2 = stats.getFailedExecutions(account_2);

      assert.lengthOf(failedExecutions_1, 0);
      assert.lengthOf(failedExecutions_2, 1);
    });
  });
});
