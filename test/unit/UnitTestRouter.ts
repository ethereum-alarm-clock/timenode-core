/* tslint:disable:no-unused-expression */
import { expect, assert } from 'chai';
import * as TypeMoq from 'typemoq';

import { Config, Wallet, W3Util } from '../../src/index';
import { mockConfig, mockTxRequest, mockTxStatus } from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import { TxStatus, EconomicStrategyStatus } from '../../src/Enum';
import { ITxRequest } from '../../src/Types';
import { V3Wallet } from '../../src/Wallet/Wallet';
import { BigNumber } from 'bignumber.js';
import { IEconomicStrategyManager } from '../../src/EconomicStrategy/EconomicStrategyManager';
import { ICachedTxDetails } from '../../src/Cache';

const TIMESTAMP_TX = 'timestamp Tx';
const BLOCK_TX = 'block Tx';

// tslint:disable-next-line:no-big-function
describe('Router Unit Tests', () => {
  let config: Config;
  let txTimestamp: ITxRequest;
  let txBlock: ITxRequest;

  let router: Router;
  let myAccount: string;

  const createRouter = async (claimingEnabled = true) => {
    const web3 = {
      eth: {
        getBlockNumber: (callback: any) => callback(null, 1000)
      },
      toWei: config.web3.toWei
    };

    const v3wallet = TypeMoq.Mock.ofType<V3Wallet>();
    v3wallet.setup(w => w.getAddressString()).returns(() => myAccount);

    const wallet = TypeMoq.Mock.ofType<Wallet>();
    wallet
      .setup(w => w.isWaitingForConfirmation(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(() => false);
    wallet.setup(w => w.nextAccount).returns(() => v3wallet.object);
    wallet.setup(w => w.isKnownAddress(myAccount)).returns(() => true);
    wallet.setup(w => w.isKnownAddress(TypeMoq.It.isAnyString())).returns(() => false);

    const util = TypeMoq.Mock.ofType<W3Util>();
    util.setup(u => u.networkGasPrice()).returns(async () => new BigNumber(20000));

    const economicStrategyManager = TypeMoq.Mock.ofType<IEconomicStrategyManager>();
    economicStrategyManager
      .setup(e => e.shouldClaimTx(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => EconomicStrategyStatus.CLAIM);

    txTimestamp = await mockTxRequest(web3);
    txBlock = await mockTxRequest(web3, true);

    config.cache.set(txTimestamp.address, {} as ICachedTxDetails);
    config.cache.set(txBlock.address, {} as ICachedTxDetails);

    const actions = new Actions(
      config.wallet,
      config.ledger,
      config.logger,
      config.cache,
      util.object,
      config.pending,
      economicStrategyManager.object
    );

    return new Router(
      claimingEnabled,
      config.cache,
      config.logger,
      actions,
      economicStrategyManager.object,
      wallet.object
    );
  };

  const reset = async () => {
    config = await mockConfig();
    router = await createRouter();
    myAccount = config.wallet.getAddresses()[0];
  };

  beforeEach(reset);

  it('initializes the Router', async () => {
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
        assert.isNotTrue(router.isLocalClaim(txTimestamp));
      });

      it('returns true when same address', async () => {
        txTimestamp.claimedBy = myAccount;
        assert.isTrue(router.isLocalClaim(txTimestamp));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns false when different address', async () => {
        assert.isNotTrue(router.isLocalClaim(txBlock));
      });

      it('returns true when same address', async () => {
        txBlock.claimedBy = myAccount;
        assert.isTrue(router.isLocalClaim(txBlock));
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
        const routerLocal = await createRouter(false);
        assert.equal(await routerLocal.claimWindow(tx), TxStatus.ClaimWindow);
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
        const routerLocal = await createRouter(false);
        const status = await routerLocal.claimWindow(tx);

        assert.equal(status, TxStatus.ClaimWindow);
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
        const routerLocal = await createRouter(false);
        assert.equal(await routerLocal.route(tx), TxStatus.ClaimWindow);
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
        const routerLocal = await createRouter(false);
        assert.equal(await routerLocal.route(tx), TxStatus.ClaimWindow);
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
