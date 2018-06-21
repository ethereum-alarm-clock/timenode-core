import { expect, assert } from 'chai';
import BigNumber from 'bignumber.js';
import * as moment from 'moment';

import { Config } from '../../src/index';
import {
  mockConfig,
  MockTxRequestTimestamp,
  MockTxRequestBlock
} from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import { TxStatus } from '../../src/Enum';

describe('Router Unit Tests', () => {
  let config: Config;
  let txTimestamp: any;
  let txBlock: any;
  
  const reset = async () => {
    config = mockConfig();
    txTimestamp = MockTxRequestTimestamp();
    txBlock = await MockTxRequestBlock(config.web3);

    actions = new Actions(config);
    router = new Router(config, actions);
  };
  
  let router: Router;
  let actions: Actions;

  beforeEach(reset);
  
  it('initializes the Router', async () => {
    actions = new Actions(config);
    router = new Router(config, actions);
    expect(router).to.exist;
  });

  it('isTransactionMissed() when scheduled for future', async () => {
    assert.isNotTrue(await router.isTransactionMissed(txBlock));
    assert.isNotTrue(await router.isTransactionMissed(txTimestamp));
  });

  it('isTransactionMissed() when scheduled for past', async () => {
    txBlock.executionWindowEnd = new BigNumber(10);
    assert.isTrue(await router.isTransactionMissed(txBlock));

    txTimestamp.executionWindowEnd = new BigNumber(moment().subtract(1, 'week').unix());
    assert.isTrue(await router.isTransactionMissed(txTimestamp));
  });

  it('isLocalClaim() when different address', async () => {
    assert.isNotTrue(await router.isLocalClaim(txBlock));
    assert.isNotTrue(await router.isLocalClaim(txTimestamp));

    router.config.wallet = null;
    assert.isNotTrue(await router.isLocalClaim(txBlock));
    assert.isNotTrue(await router.isLocalClaim(txTimestamp));
  });

  it('isLocalClaim() when same address', async () => {
    let myAccount = router.config.wallet.getAddresses()[0];
    txBlock.claimedBy = myAccount;
    txTimestamp.claimedBy = myAccount;

    assert.isTrue(await router.isLocalClaim(txBlock));
    assert.isTrue(await router.isLocalClaim(txTimestamp));

    router.config.wallet = null;

    myAccount = router.config.web3.eth.accounts[0];
    txBlock.claimedBy = myAccount;
    txTimestamp.claimedBy = myAccount;

    assert.isTrue(await router.isLocalClaim(txBlock));
    assert.isTrue(await router.isLocalClaim(txTimestamp));
  });

  it('beforeClaimWindow() when claim window not started', async () => {
    assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.BeforeClaimWindow);
    assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.BeforeClaimWindow);
  });

  it('beforeClaimWindow() when claim window started', async () => {
    txBlock.claimWindowStart = new BigNumber(10);
    txTimestamp.claimWindowStart = new BigNumber(moment().subtract(1, 'hour').unix());

    assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.ClaimWindow);
    assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.ClaimWindow);
  });

  it('beforeClaimWindow() when tx executed', async () => {
    txBlock.isCancelled = true;
    txTimestamp.isCancelled = true;

    assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.Executed);
    assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.Executed);
  });

  it('route()', async () => {
    // assert.isTrue(await router.route(txBlock));
    // assert.isTrue(await router.route(txTimestamp));
  });

})
