import BigNumber from 'bignumber.js';
import * as loki from 'lokijs';
import { StatsDB } from '../../src/Stats';
import { assert } from 'chai';

describe('Stats Unit Tests', () => {
  const account1: string = '0xd0700ed9f4d178adf25b45f7fa8a4ec7c230b098';
  const account2: string = '0x0054a7eef4dc5d729115c71cba074151b3d41804';

  const tx1: string = '0xaa55bf414ecef0285dcece4ddf78a0ee8beb6707';
  const tx2: string = '0x9b7b4a8fdafda1b688c22fcb6f4bc97ed29ff676';
  let stats: StatsDB;

  const reset = async () => {
    stats = new StatsDB(new loki('stats.db'));
  };

  beforeEach(reset);

  describe('discovered()', () => {
    it('inserts discovered', async () => {
      stats.discovered(account1, tx1);
      stats.discovered(account2, tx1);

      const discoveredAccount1 = stats.getDiscovered(account1);

      assert.lengthOf(discoveredAccount1, 1);
    });

    it('selects unique discovered', async () => {
      stats.discovered(account1, tx1);
      stats.discovered(account1, tx1);
      stats.discovered(account1, tx1);
      stats.discovered(account2, tx1);

      const discoveredAccount1 = stats.getDiscovered(account1);

      assert.lengthOf(discoveredAccount1, 1);
    });
  });

  describe('claimed()', () => {
    it('inserts and selects successful claims', async () => {
      const cost = new BigNumber(10);
      const expectedBounty = new BigNumber(0);

      stats.claimed(account1, tx1, cost, true);
      stats.claimed(account2, tx2, cost, true);

      const successfulClaimsAccount1 = stats.getSuccessfulClaims(account1);

      assert.lengthOf(successfulClaimsAccount1, 1);
      assert.equal(successfulClaimsAccount1[0].from, account1);
      assert.equal(successfulClaimsAccount1[0].txAddress, tx1);

      assert.isTrue(successfulClaimsAccount1[0].cost.equals(cost));
      assert.isTrue(successfulClaimsAccount1[0].bounty.equals(expectedBounty));
    });

    it('inserts and selects failed claims', async () => {
      const cost = new BigNumber(10);

      stats.claimed(account1, tx1, cost, true);
      stats.claimed(account2, tx2, cost, false);

      const failedClaimsAccount1 = stats.getFailedClaims(account1);
      const failedClaimsAccount2 = stats.getFailedClaims(account2);

      assert.lengthOf(failedClaimsAccount1, 0);
      assert.lengthOf(failedClaimsAccount2, 1);
    });
  });

  describe('executed()', () => {
    it('inserts and selects successful executions', async () => {
      const cost = new BigNumber(10);
      const bounty = new BigNumber(15);

      stats.executed(account1, tx1, cost, bounty, true);
      stats.executed(account2, tx2, cost, bounty, true);

      const successfulExecutionsAccount1 = stats.getSuccessfulExecutions(account1);

      assert.lengthOf(successfulExecutionsAccount1, 1);
      assert.equal(successfulExecutionsAccount1[0].from, account1);
      assert.equal(successfulExecutionsAccount1[0].txAddress, tx1);

      assert.isTrue(successfulExecutionsAccount1[0].cost.equals(cost));
      assert.isTrue(successfulExecutionsAccount1[0].bounty.equals(bounty));
    });

    it('inserts and selects failed executions', async () => {
      const cost = new BigNumber(10);
      const bounty = new BigNumber(0);

      stats.executed(account1, tx1, cost, bounty, true);
      stats.executed(account2, tx2, cost, bounty, false);

      const failedExecutionsAccount1 = stats.getFailedExecutions(account1);
      const failedExecutionsAccount2 = stats.getFailedExecutions(account2);

      assert.lengthOf(failedExecutionsAccount1, 0);
      assert.lengthOf(failedExecutionsAccount2, 1);
    });
  });
});
