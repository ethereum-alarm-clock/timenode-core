import BigNumber from 'bignumber.js';
import { expect, assert } from 'chai';
import { Config } from '../../src/index';
import { mockConfig, clearStats } from '../helpers';

describe('Stats Unit Tests', () => {
  let config: Config;
  let myAccount: string;
  let myStats: any;
  let claimCost: BigNumber;
  let bounty: BigNumber;
  let executionCost: BigNumber;

  const reset = async () => {
    clearStats();

    config = mockConfig();
    myAccount = config.wallet.getAddresses()[0];

    config.statsDb.initialize([myAccount]);
    myStats = config.statsDb.getStats().find((stat: any) => stat.account === myAccount);

    claimCost = new BigNumber(config.web3.toWei(0.1, 'ether'));
    bounty = claimCost;
    executionCost = claimCost;
  };

  beforeEach(reset);

  describe('initialize()', () => {
    it('fetches stats after initialization', async () => {
      expect(myStats).to.exist;

      config.statsDb.initialize([myAccount]);
      expect(myStats).to.exist;
    });

    it('stats are set to 0', async () => {
      assert.strictEqual(myStats.claimed, 0);
      assert.strictEqual(myStats.executed, 0);
      assert.isTrue(myStats.bounties.eq(new BigNumber(0)));
      assert.isTrue(myStats.costs.eq(new BigNumber(0)));
    });
  });

  describe('updateClaimed()', () => {
    it('claim is incremented', async () => {
      config.statsDb.updateClaimed(myAccount, claimCost);
      assert.strictEqual(myStats.claimed, 1);
    });

    it('cost is accounted for', async () => {
      config.statsDb.updateClaimed(myAccount, claimCost);
      assert.isTrue(myStats.costs.eq(claimCost));
    });
  });

  describe('updateExecuted()', () => {
    it('executed is incremented', async () => {
      config.statsDb.updateExecuted(myAccount, bounty, executionCost);
      assert.strictEqual(myStats.executed, 1);
    });

    it('bounty is accounted for', async () => {
      config.statsDb.updateExecuted(myAccount, bounty, executionCost);
      assert.isTrue(myStats.bounties.eq(bounty));
    });

    it('cost is accounted for', async () => {
      config.statsDb.updateExecuted(myAccount, bounty, executionCost);
      assert.isTrue(myStats.costs.eq(executionCost));
    });
  });

  describe('addFailedClaim()', () => {
    it('before calling it array is empty', () => {
      assert.deepEqual(myStats.failedClaims, []);
    });

    it('adds failed claim', () => {
      const failedClaimAddress = '0xe87529a6123a74320e13a6dabf3606630683c029';
      config.statsDb.addFailedClaim(myAccount, failedClaimAddress);

      assert.deepEqual(myStats.failedClaims, ['0xe87529a6123a74320e13a6dabf3606630683c029']);
    });

    it('does not allow for duplicates of failed claims', () => {
      const failedClaimAddress = '0xe87529a6123a74320e13a6dabf3606630683c029';
      config.statsDb.addFailedClaim(myAccount, failedClaimAddress);

      assert.deepEqual(myStats.failedClaims, ['0xe87529a6123a74320e13a6dabf3606630683c029']);

      config.statsDb.addFailedClaim(myAccount, failedClaimAddress);

      assert.deepEqual(myStats.failedClaims, ['0xe87529a6123a74320e13a6dabf3606630683c029']);
    });
  });

  describe('incrementDiscovered()', () => {
    it('increments discovered', () => {
      assert.strictEqual(myStats.discovered, 0);

      config.statsDb.incrementDiscovered(myAccount);
      assert.strictEqual(myStats.discovered, 1);

      config.statsDb.incrementDiscovered(myAccount);
      assert.strictEqual(myStats.discovered, 2);
    });
  });

  describe('getStats()', () => {
    it('returns all stats', async () => {
      const stats = config.statsDb.getStats();
      assert.equal(stats.length, 1);
    });
  });
});
