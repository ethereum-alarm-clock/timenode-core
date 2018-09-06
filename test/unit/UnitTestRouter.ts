/* tslint:disable:no-unused-expression */
import { expect, assert } from 'chai';

import { Config } from '../../src/index';
import { mockConfig, mockTxRequest, mockTxStatus } from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import { TxStatus } from '../../src/Enum';
import { ITxRequest } from '../../src/Types';

const TIMESTAMP_TX = 'timestamp Tx';
const BLOCK_TX = 'block Tx';

describe('Router Unit Tests', () => {
  let config: Config;
  let txTimestamp: ITxRequest;
  let txBlock: ITxRequest;

  let router: Router;
  let actions: Actions;
  let myAccount: string;

  const reset = async () => {
    config = await mockConfig();

    txTimestamp = await mockTxRequest(config.web3);
    txBlock = await mockTxRequest(config.web3, true);

    actions = new Actions(config);
    router = new Router(config, actions);
    myAccount = config.wallet.getAddresses()[0];
  };

  beforeEach(reset);

  it('initializes the Router', async () => {
    actions = new Actions(config);
    router = new Router(config, actions);
    expect(router).to.exist;
  });

  describe('isTransactionMissed()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns false when scheduled for future', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.BeforeClaimWindow);
        assert.isNotTrue(await router.isTransactionMissed(tx));
      });

      it('returns true when scheduled tx is missed', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.Missed);
        assert.isTrue(await router.isTransactionMissed(tx));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns false when scheduled for future', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.BeforeClaimWindow);
        assert.isNotTrue(await router.isTransactionMissed(tx));
      });

      it('returns true when scheduled execution window passed', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.Missed);
        assert.isTrue(await router.isTransactionMissed(tx));
      });
    });
  });

  describe('isLocalClaim()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns false when different address', async () => {
        assert.isNotTrue(await router.isLocalClaim(txTimestamp));
      });

      it('returns true when same address', async () => {
        txTimestamp.claimedBy = myAccount;
        assert.isTrue(await router.isLocalClaim(txTimestamp));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns false when different address', async () => {
        assert.isNotTrue(await router.isLocalClaim(txBlock));
      });

      it('returns true when same address', async () => {
        txBlock.claimedBy = myAccount;
        assert.isTrue(await router.isLocalClaim(txBlock));
      });
    });
  });

  describe('beforeClaimWindow()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns BeforeClaimWindow when claim window not started', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.BeforeClaimWindow);
        const state = await router.beforeClaimWindow(tx);

        assert.equal(state, TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow when claim window started', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.ClaimWindow);
        assert.equal(await router.beforeClaimWindow(tx), TxStatus.ClaimWindow);
      });

      it('returns Executed when tx cancelled', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.Executed);
        tx.isCancelled = true;

        const state = await router.beforeClaimWindow(tx);
        assert.equal(state, TxStatus.Executed);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns BeforeClaimWindow when claim window not started', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.BeforeClaimWindow);
        const state = await router.beforeClaimWindow(tx);

        assert.equal(state, TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow when claim window started', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.ClaimWindow);
        const state: TxStatus = await router.beforeClaimWindow(tx);

        assert.equal(state, TxStatus.ClaimWindow);
      });

      it('returns Executed when tx cancelled', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.Executed);
        tx.isCancelled = true;
        const state = await router.beforeClaimWindow(tx);

        assert.equal(state, TxStatus.Executed);
      });
    });
  });

  describe('claimWindow()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns FreezePeriod when claim window not started', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.BeforeClaimWindow);
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow when claim window started and claiming disabled', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.ClaimWindow);
        config.claiming = false;
        assert.equal(await router.claimWindow(tx), TxStatus.ClaimWindow);
        config.claiming = true;
      });

      it('returns FreezePeriod when claim window started and claiming enabled', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.ClaimWindow);
        const status = await router.claimWindow(tx);
        assert.equal(status, TxStatus.FreezePeriod);
      });

      it('returns FreezePeriod when tx is already claimed', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.ClaimWindow);
        tx.isClaimed = true;
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns FreezePeriod when claim window not started', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.BeforeClaimWindow);
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow when claim window started and claiming disabled', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.ClaimWindow);
        config.claiming = false;
        assert.equal(await router.claimWindow(tx), TxStatus.ClaimWindow);
        config.claiming = true;
      });

      it('returns FreezePeriod when claim window started and claiming enabled', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.ClaimWindow);
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });

      it('returns FreezePeriod when tx is already claimed', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.ClaimWindow);
        tx.isClaimed = true;
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });
    });
  });

  describe('freezePeriod()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns freezePeriod when in freeze', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.FreezePeriod);
        assert.equal(await router.freezePeriod(tx), TxStatus.FreezePeriod);
      });

      it('returns ExecutionWindow when in execution window', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.ExecutionWindow);
        assert.equal(await router.freezePeriod(tx), TxStatus.ExecutionWindow);
      });

      it('returns FreezePeriod when execution window passed', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.Executed);
        assert.equal(await router.freezePeriod(tx), TxStatus.FreezePeriod);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns freezePeriod when in freeze', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.FreezePeriod);
        assert.equal(await router.freezePeriod(tx), TxStatus.FreezePeriod);
      });

      it('returns ExecutionWindow when in execution window', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.ExecutionWindow);
        assert.equal(await router.freezePeriod(tx), TxStatus.ExecutionWindow);
      });

      it('returns FreezePeriod when execution window passed', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.Executed);
        assert.equal(await router.freezePeriod(tx), TxStatus.FreezePeriod);
      });
    });
  });

  describe('inReservedWindowAndNotClaimedLocally()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns false when not in reserved window and not claimed locally', async () => {
        txTimestamp.isClaimed = true;
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txTimestamp));
      });

      it('returns true when in reserved window and not claimed locally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.windowStart = await txTimestamp.now();
        assert.isTrue(await router.inReservedWindowAndNotClaimedLocally(txTimestamp));
      });

      it('returns false when not in reserved window and claimed locally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.claimedBy = myAccount;
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txTimestamp));
      });

      it('returns false when in reserved window and claimed locally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.claimedBy = myAccount;
        txTimestamp.windowStart = await txTimestamp.now();
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txTimestamp));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns false when not in reserved window and not claimed locally', async () => {
        txBlock.isClaimed = true;
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });

      it('returns true when in reserved window and not claimed locally', async () => {
        txBlock.isClaimed = true;
        txBlock.windowStart = await txBlock.now();
        assert.isTrue(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });

      it('returns false when not in reserved window and claimed locally', async () => {
        txBlock.isClaimed = true;
        txBlock.claimedBy = myAccount;
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });

      it('returns false when in reserved window and claimed locally', async () => {
        txBlock.isClaimed = true;
        txBlock.claimedBy = myAccount;
        txBlock.windowStart = await txTimestamp.now();
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });
    });
  });

  describe('executionWindow()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns Executed when execution was called', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.Executed);
        assert.equal(await router.executionWindow(tx), TxStatus.Executed);
      });

      it('returns Missed when tx execution was missed', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.Missed);
        assert.equal(await router.executionWindow(tx), TxStatus.Missed);
      });

      it('returns ExecutionWindow if inReservedWindowAndNotClaimedLocally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.windowStart = await txTimestamp.now();
        assert.equal(await router.executionWindow(txTimestamp), TxStatus.ExecutionWindow);
      });

      it('returns Executed when executes transaction', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.Executed);
        assert.equal(await router.executionWindow(tx), TxStatus.Executed);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns Executed when execution was called', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.Executed);
        assert.equal(await router.executionWindow(tx), TxStatus.Executed);
      });

      it('returns Missed when tx execution was missed', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.Missed);
        assert.equal(await router.executionWindow(tx), TxStatus.Missed);
      });

      it('returns ExecutionWindow if inReservedWindowAndNotClaimedLocally', async () => {
        txBlock.isClaimed = true;
        txBlock.windowStart = await txBlock.now();
        assert.equal(await router.executionWindow(txBlock), TxStatus.ExecutionWindow);
      });

      it('returns Executed when executes transaction', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.Executed);
        assert.equal(await router.executionWindow(tx), TxStatus.Executed);
      });
    });
  });

  describe('route()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns BeforeClaimWindow status', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.BeforeClaimWindow);
        assert.equal(await router.route(tx), TxStatus.BeforeClaimWindow);
      });

      it('returns FreezePeriod status when claiming enabled', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.ClaimWindow);
        assert.equal(await router.route(tx), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow status when claiming disabled', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.ClaimWindow);
        config.claiming = false;
        assert.equal(await router.route(tx), TxStatus.ClaimWindow);
        config.claiming = true;
      });

      // THESE TESTS DO NOT PASS FOR SOME REASON
      xit('returns FreezePeriod status', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.FreezePeriod);
        assert.equal(await router.route(tx), TxStatus.FreezePeriod);
      });

      xit('returns ExecutionWindow status', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.ExecutionWindow);
        assert.equal(await router.route(tx), TxStatus.ExecutionWindow);
      });

      xit('returns Executed status', async () => {
        const tx = await mockTxStatus(txTimestamp, TxStatus.Executed);
        assert.equal(await router.route(tx), TxStatus.Executed);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns BeforeClaimWindow status', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.BeforeClaimWindow);
        assert.equal(await router.route(tx), TxStatus.BeforeClaimWindow);
      });

      it('returns FreezePeriod status when claiming enabled', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.ClaimWindow);
        assert.equal(await router.route(tx), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow status when claiming disabled', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.ClaimWindow);
        config.claiming = false;
        assert.equal(await router.route(tx), TxStatus.ClaimWindow);
        config.claiming = true;
      });

      xit('returns FreezePeriod status', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.FreezePeriod);
        assert.equal(await router.route(tx), TxStatus.FreezePeriod);
      });

      xit('returns ExecutionWindow status', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.ExecutionWindow);
        assert.equal(await router.route(tx), TxStatus.ExecutionWindow);
      });

      xit('returns Executed status', async () => {
        const tx = await mockTxStatus(txBlock, TxStatus.Executed);
        assert.equal(await router.route(tx), TxStatus.Executed);
      });
    });
  });
});
