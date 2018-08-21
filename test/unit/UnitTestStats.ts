import BigNumber from 'bignumber.js';
import * as loki from 'lokijs';
import { StatsDB } from '../../src/Stats';
import { assert } from 'chai';

describe('Stats Unit Tests', () => {
  const account1: string = '0xd0700ed9f4d178adf25b45f7fa8a4ec7c230b098';
  const account2: string = '0x0054a7eef4dc5d729115c71cba074151b3d41804';

  const tx1: string = '0xaa55bf414ecef0285dcece4ddf78a0ee8beb6707';
  const tx2: string = '0x9b7b4a8fdafda1b688c22fcb6f4bc97ed29ff676';
  const tx3: string = '0x57f1b33b8b44689982ce7b3f560577e89375b2da';
  let stats: StatsDB;
  let cost: BigNumber;
  let bounty: BigNumber;

  const reset = async () => {
    stats = new StatsDB(new loki('stats.db'));
    cost = new BigNumber(10);
    bounty = new BigNumber(15);
  };

  beforeEach(reset);

  describe('getFailedExecutions()', () => {
    it('returns an empty array if none', () => {
      assert.isEmpty(stats.getFailedExecutions(account1));
    });

    it('returns 1 after failing execution', () => {
      assert.isEmpty(stats.getFailedExecutions(account1));

      bounty = new BigNumber(0);
      stats.executed(account1, tx2, cost, bounty, false);

      assert.equal(stats.getFailedExecutions(account1).length, 1);
    });
  });

  describe('getSuccessfulExecutions()', () => {
    it('returns an empty array if none', () => {
      assert.isEmpty(stats.getSuccessfulExecutions(account1));
    });

    it('returns 1 after executed', () => {
      assert.isEmpty(stats.getSuccessfulExecutions(account1));
      stats.executed(account1, tx1, cost, bounty, true);
      assert.equal(stats.getSuccessfulExecutions(account1).length, 1);
    });
  });

  describe('getFailedClaims()', () => {
    it('returns an empty array if none', () => {
      assert.isEmpty(stats.getFailedClaims(account1));
    });

    it('returns 1 after failing claim', () => {
      assert.isEmpty(stats.getFailedClaims(account1));
      stats.claimed(account1, tx2, cost, false);
      assert.equal(stats.getFailedClaims(account1).length, 1);
    });
  });

  describe('getSuccessfulClaims()', () => {
    it('returns an empty array if none', () => {
      assert.isEmpty(stats.getSuccessfulClaims(account1));
    });

    it('returns 1 after claimed', () => {
      assert.isEmpty(stats.getSuccessfulClaims(account1));
      stats.claimed(account1, tx1, cost, true);
      assert.equal(stats.getSuccessfulClaims(account1).length, 1);
    });
  });

  describe('getDiscovered()', () => {
    it('returns an empty array if none', () => {
      assert.isEmpty(stats.getDiscovered(account1));
    });

    it('returns 1 after discovered', () => {
      assert.isEmpty(stats.getDiscovered(account1));
      stats.discovered(account1, tx1);
      assert.equal(stats.getDiscovered(account1).length, 1);
    });
  });

  describe('discovered()', () => {
    it('inserts discovered', () => {
      stats.discovered(account1, tx1);
      stats.discovered(account2, tx1);

      const discoveredAccount1 = stats.getDiscovered(account1);
      const discoveredAccount2 = stats.getDiscovered(account2);

      assert.lengthOf(discoveredAccount1, 1);
      assert.lengthOf(discoveredAccount2, 1);
    });

    it('selects unique discovered', () => {
      stats.discovered(account1, tx1);
      stats.discovered(account1, tx1);
      stats.discovered(account1, tx1);
      stats.discovered(account2, tx1);

      const discoveredAccount1 = stats.getDiscovered(account1);
      const discoveredAccount2 = stats.getDiscovered(account2);

      assert.lengthOf(discoveredAccount1, 1);
      assert.lengthOf(discoveredAccount2, 1);
    });
  });

  describe('claimed()', () => {
    it('inserts and selects successful claims', () => {
      const expectedBounty = new BigNumber(0);

      stats.claimed(account1, tx1, cost, true);

      stats.claimed(account2, tx2, cost, false);
      stats.claimed(account2, tx2, cost, true);

      const successfulClaimsAccount1 = stats.getSuccessfulClaims(account1);
      const successfulClaimsAccount2 = stats.getSuccessfulClaims(account2);

      assert.lengthOf(successfulClaimsAccount1, 1);
      assert.equal(successfulClaimsAccount1[0].from, account1);
      assert.equal(successfulClaimsAccount1[0].txAddress, tx1);

      assert.isTrue(successfulClaimsAccount1[0].cost.equals(cost));
      assert.isTrue(successfulClaimsAccount1[0].bounty.equals(expectedBounty));

      assert.lengthOf(successfulClaimsAccount2, 1);
      assert.equal(successfulClaimsAccount2[0].from, account2);
      assert.equal(successfulClaimsAccount2[0].txAddress, tx2);

      assert.isTrue(successfulClaimsAccount2[0].cost.equals(cost));
      assert.isTrue(successfulClaimsAccount2[0].bounty.equals(expectedBounty));
    });

    it('inserts and selects failed claims', () => {
      stats.claimed(account1, tx1, cost, true);
      stats.claimed(account2, tx2, cost, false);

      const failedClaimsAccount1 = stats.getFailedClaims(account1);
      const failedClaimsAccount2 = stats.getFailedClaims(account2);

      assert.lengthOf(failedClaimsAccount1, 0);
      assert.lengthOf(failedClaimsAccount2, 1);
    });
  });

  describe('executed()', () => {
    it('inserts and selects successful executions', () => {
      stats.executed(account1, tx1, cost, bounty, true);

      stats.executed(account2, tx2, cost, bounty, false);
      stats.executed(account2, tx2, cost, bounty, true);

      const successfulExecutionsAccount1 = stats.getSuccessfulExecutions(account1);
      const successfulExecutionsAccount2 = stats.getSuccessfulExecutions(account2);

      assert.lengthOf(successfulExecutionsAccount1, 1);
      assert.equal(successfulExecutionsAccount1[0].from, account1);
      assert.equal(successfulExecutionsAccount1[0].txAddress, tx1);

      assert.isTrue(successfulExecutionsAccount1[0].cost.equals(cost));
      assert.isTrue(successfulExecutionsAccount1[0].bounty.equals(bounty));

      assert.lengthOf(successfulExecutionsAccount2, 1);
      assert.equal(successfulExecutionsAccount2[0].from, account2);
      assert.equal(successfulExecutionsAccount2[0].txAddress, tx2);

      assert.isTrue(successfulExecutionsAccount2[0].cost.equals(cost));
      assert.isTrue(successfulExecutionsAccount2[0].bounty.equals(bounty));
    });

    it('inserts and selects failed executions', () => {
      bounty = new BigNumber(0);

      stats.executed(account1, tx1, cost, bounty, true);
      stats.executed(account2, tx2, cost, bounty, false);

      const failedExecutionsAccount1 = stats.getFailedExecutions(account1);
      const failedExecutionsAccount2 = stats.getFailedExecutions(account2);

      assert.lengthOf(failedExecutionsAccount1, 0);
      assert.lengthOf(failedExecutionsAccount2, 1);
    });
  });

  describe('clear()', () => {
    it('clears nothing', () => {
      stats.clear(account1);
    });

    it('remove entries for given address', () => {
      stats.executed(account1, tx1, cost, bounty, true);
      stats.executed(account2, tx2, cost, bounty, true);

      stats.claimed(account1, tx1, cost, false);
      stats.claimed(account2, tx2, cost, false);

      let successfulExecutionsAccount1 = stats.getSuccessfulExecutions(account1);
      let successfulExecutionsAccount2 = stats.getSuccessfulExecutions(account2);

      assert.lengthOf(successfulExecutionsAccount1, 1);
      assert.lengthOf(successfulExecutionsAccount2, 1);

      let failedClaimsAccount1 = stats.getFailedClaims(account1);
      let failedClaimsAccount2 = stats.getFailedClaims(account2);

      assert.lengthOf(failedClaimsAccount1, 1);
      assert.lengthOf(failedClaimsAccount2, 1);

      stats.clear(account1);

      successfulExecutionsAccount1 = stats.getSuccessfulExecutions(account1);
      successfulExecutionsAccount2 = stats.getSuccessfulExecutions(account2);

      assert.lengthOf(successfulExecutionsAccount1, 0);
      assert.lengthOf(successfulExecutionsAccount2, 1);

      failedClaimsAccount1 = stats.getFailedClaims(account1);
      failedClaimsAccount2 = stats.getFailedClaims(account2);

      assert.lengthOf(failedClaimsAccount1, 0);
      assert.lengthOf(failedClaimsAccount2, 1);
    });
  });

  describe('clearAll()', () => {
    it('removes all entries', () => {
      stats.executed(account1, tx1, cost, bounty, true);
      stats.executed(account2, tx2, cost, bounty, true);

      stats.claimed(account1, tx1, cost, false);
      stats.claimed(account2, tx2, cost, false);

      let successfulExecutionsAccount1 = stats.getSuccessfulExecutions(account1);
      let successfulExecutionsAccount2 = stats.getSuccessfulExecutions(account2);

      assert.lengthOf(successfulExecutionsAccount1, 1);
      assert.lengthOf(successfulExecutionsAccount2, 1);

      let failedClaimsAccount1 = stats.getFailedClaims(account1);
      let failedClaimsAccount2 = stats.getFailedClaims(account2);

      assert.lengthOf(failedClaimsAccount1, 1);
      assert.lengthOf(failedClaimsAccount2, 1);

      stats.clearAll();

      successfulExecutionsAccount1 = stats.getSuccessfulExecutions(account1);
      successfulExecutionsAccount2 = stats.getSuccessfulExecutions(account2);

      assert.lengthOf(successfulExecutionsAccount1, 0);
      assert.lengthOf(successfulExecutionsAccount2, 0);

      failedClaimsAccount1 = stats.getFailedClaims(account1);
      failedClaimsAccount2 = stats.getFailedClaims(account2);

      assert.lengthOf(failedClaimsAccount1, 0);
      assert.lengthOf(failedClaimsAccount2, 0);
    });
  });

  describe('totalBounty()', () => {
    it('returns zero when none', () => {
      assert.equal(stats.totalBounty(account1).toNumber(), 0);
    });

    it('should sum up all bounties for the account', () => {
      stats.executed(account1, tx1, cost, bounty, true);
      stats.executed(account1, tx3, cost, bounty, true);
      stats.executed(account2, tx2, cost, bounty, true);

      const expectedAccount1Bounty = bounty.mul(2);
      const expectedAccount2Bounty = bounty;

      const totalBountiesAccount1 = stats.totalBounty(account1);
      const totalBountiesAccount2 = stats.totalBounty(account2);

      assert.isTrue(totalBountiesAccount1.equals(expectedAccount1Bounty));
      assert.isTrue(totalBountiesAccount2.equals(expectedAccount2Bounty));
    });
  });

  describe('totalCost()', () => {
    it('returns zero when none', () => {
      assert.equal(stats.totalCost(account1).toNumber(), 0);
    });

    it('should sum up all costs for the account', () => {
      stats.executed(account1, tx1, cost, bounty, false);
      stats.executed(account1, tx3, cost, bounty, false);
      stats.executed(account2, tx2, cost, bounty, false);

      stats.claimed(account1, tx1, cost, true);
      stats.claimed(account1, tx2, cost, false);

      const expectedAccount1Cost = cost.mul(4); //2 executions 2claims
      const expectedAccount2Cost = cost;

      const totalCostAccount1 = stats.totalCost(account1);
      const totalCostAccount2 = stats.totalCost(account2);

      assert.isTrue(totalCostAccount1.equals(expectedAccount1Cost));
      assert.isTrue(totalCostAccount2.equals(expectedAccount2Cost));
    });
  });
});
