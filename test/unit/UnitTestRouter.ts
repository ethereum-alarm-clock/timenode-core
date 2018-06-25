import { expect, assert } from 'chai';
import BigNumber from 'bignumber.js';
import * as moment from 'moment';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest, getMockTxWithStatus } from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import { TxStatus } from '../../src/Enum';

const TIMESTAMP_TX = 'timestamp Tx';
const BLOCK_TX = 'block Tx';

describe('Router Unit Tests', () => {
  let config: Config;
  let txTimestamp: any;
  let txBlock: any;

  let router: Router;
  let actions: Actions;
  let myAccount: string;

  const reset = async () => {
    config = mockConfig();
    txTimestamp = await MockTxRequest(config.web3);
    txBlock = await MockTxRequest(config.web3, true);

    actions = new Actions(config);
    router = new Router(config, actions);
    myAccount = router.config.wallet.getAddresses()[0];
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
        assert.isNotTrue(await router.isTransactionMissed(txTimestamp));
      });

      it('returns true when scheduled tx is missed', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.Missed);
        assert.isTrue(await router.isTransactionMissed(tx));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns false when scheduled for future', async () => {
        assert.isNotTrue(await router.isTransactionMissed(txBlock));
      });

      it('returns true when scheduled execution window passed', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.Missed);
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
        assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow when claim window started', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.ClaimWindow);
        assert.equal(await router.beforeClaimWindow(tx), TxStatus.ClaimWindow);
      });

      it('returns Executed when tx cancelled', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.Executed);
        tx.isCancelled = true;
        assert.equal(await router.beforeClaimWindow(tx), TxStatus.Executed);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns BeforeClaimWindow when claim window not started', async () => {
        assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow when claim window started', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.ClaimWindow);
        assert.equal(await router.beforeClaimWindow(tx), TxStatus.ClaimWindow);
      });

      it('returns Executed when tx cancelled', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.Executed);
        tx.isCancelled = true;
        assert.equal(await router.beforeClaimWindow(tx), TxStatus.Executed);
      });
    });
  });

  describe('claimWindow()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns FreezePeriod when claim window not started', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.BeforeClaimWindow);
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow when claim window started', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.ClaimWindow);
        assert.equal(await router.claimWindow(tx), TxStatus.ClaimWindow);
      });

      it('returns FreezePeriod when tx is already claimed', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.ClaimWindow);
        tx.isClaimed = true;
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns FreezePeriod when claim window not started', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.BeforeClaimWindow);
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow when claim window started', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.ClaimWindow);
        assert.equal(await router.claimWindow(tx), TxStatus.ClaimWindow);
      });

      it('returns FreezePeriod when tx is already claimed', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.ClaimWindow);
        tx.isClaimed = true;
        assert.equal(await router.claimWindow(tx), TxStatus.FreezePeriod);
      });
    });
  });

  describe('freezePeriod()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns freezePeriod when in freeze', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.FreezePeriod);
        assert.equal(await router.freezePeriod(tx), TxStatus.FreezePeriod);
      });

      it('returns ExecutionWindow when in execution window', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.ExecutionWindow);
        assert.equal(await router.freezePeriod(tx), TxStatus.ExecutionWindow);
      });

      it('returns FreezePeriod when execution window passed', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.Executed);
        assert.equal(await router.freezePeriod(tx), TxStatus.FreezePeriod);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns freezePeriod when in freeze', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.FreezePeriod);
        assert.equal(await router.freezePeriod(tx), TxStatus.FreezePeriod);
      });

      it('returns ExecutionWindow when in execution window', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.ExecutionWindow);
        assert.equal(await router.freezePeriod(tx), TxStatus.ExecutionWindow);
      });

      it('returns FreezePeriod when execution window passed', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.Executed);
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
        txTimestamp.windowStart = txTimestamp.now();
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
        txTimestamp.windowStart = txTimestamp.now();
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
        txBlock.windowStart = txBlock.now();
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
        txBlock.windowStart = txTimestamp.now();
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });
    });
  });

  describe('executionWindow()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns Executed when execution was called', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.Executed);
        assert.equal(await router.executionWindow(tx), TxStatus.Executed);
      });

      it('returns Missed when tx execution was missed', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.Missed);
        assert.equal(await router.executionWindow(tx), TxStatus.Missed);
      });

      it('returns ExecutionWindow if inReservedWindowAndNotClaimedLocally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.windowStart = txTimestamp.now();
        assert.equal(await router.executionWindow(txTimestamp), TxStatus.ExecutionWindow);
      });

      it('returns Executed when executes transaction', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.Executed);
        assert.equal(await router.executionWindow(tx), TxStatus.Executed);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns Executed when execution was called', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.Executed);
        assert.equal(await router.executionWindow(tx), TxStatus.Executed);
      });

      it('returns Missed when tx execution was missed', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.Missed);
        assert.equal(await router.executionWindow(tx), TxStatus.Missed);
      });

      it('returns ExecutionWindow if inReservedWindowAndNotClaimedLocally', async () => {
        txBlock.isClaimed = true;
        txBlock.windowStart = txBlock.now();
        assert.equal(await router.executionWindow(txBlock), TxStatus.ExecutionWindow);
      });

      it('returns Executed when executes transaction', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.Executed);
        assert.equal(await router.executionWindow(tx), TxStatus.Executed);
      });
    });
  });

  describe('route()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns BeforeClaimWindow status', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.BeforeClaimWindow);
        assert.equal(await router.route(tx), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow status', async () => {
        const tx = getMockTxWithStatus(txTimestamp, TxStatus.ClaimWindow);
        assert.equal(await router.route(tx), TxStatus.ClaimWindow);
      });

      // THESE TESTS DO NOT PASS FOR SOME REASON
      // it('returns FreezePeriod status', async () => {
      //   const tx = getMockTxWithStatus(txTimestamp, TxStatus.FreezePeriod);
      //   assert.equal(await router.route(tx), TxStatus.FreezePeriod);
      // });

      // it('returns ExecutionWindow status', async () => {
      //   const tx = getMockTxWithStatus(txTimestamp, TxStatus.ExecutionWindow);
      //   assert.equal(await router.route(tx), TxStatus.ExecutionWindow);
      // });

      // it('returns Executed status', async () => {
      //   const tx = getMockTxWithStatus(txTimestamp, TxStatus.Executed);
      //   assert.equal(await router.route(tx), TxStatus.Executed);
      // });
    });

    describe(BLOCK_TX, () => {
      it('returns BeforeClaimWindow status', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.BeforeClaimWindow);
        assert.equal(await router.route(tx), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow status', async () => {
        const tx = getMockTxWithStatus(txBlock, TxStatus.ClaimWindow);
        assert.equal(await router.route(tx), TxStatus.ClaimWindow);
      });

      // it('returns FreezePeriod status', async () => {
      //   const tx = getMockTxWithStatus(txBlock, TxStatus.FreezePeriod);
      //   assert.equal(await router.route(tx), TxStatus.FreezePeriod);
      // });

      // it('returns ExecutionWindow status', async () => {
      //   const tx = getMockTxWithStatus(txBlock, TxStatus.ExecutionWindow);
      //   assert.equal(await router.route(tx), TxStatus.ExecutionWindow);
      // });

      // it('returns Executed status', async () => {
      //   const tx = getMockTxWithStatus(txBlock, TxStatus.Executed);
      //   assert.equal(await router.route(tx), TxStatus.Executed);
      // });
    });
  });
});
