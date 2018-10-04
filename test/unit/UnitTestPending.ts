import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { ITxPool, ITxPoolTxDetails } from '../../src/TxPool';
import { Pending } from '../../src/Actions/Pending';
import { W3Util } from '../../src';
import { BigNumber } from 'bignumber.js';
import { Operation } from '../../src/Types/Operation';

describe('Pending Unit Tests', () => {
  function createTxPoolDetails(address: string, poolOperation: Operation, gasPrice: BigNumber) {
    const item = TypeMoq.Mock.ofType<ITxPoolTxDetails>();
    item.setup(i => i.to).returns(() => address);
    item.setup(i => i.operation).returns(() => poolOperation);
    item.setup(i => i.gasPrice).returns(() => gasPrice);
    return item;
  }

  function createUtils(gasPrice: BigNumber) {
    const util = TypeMoq.Mock.ofType<W3Util>();
    util.setup(u => u.networkGasPrice()).returns(async () => gasPrice);
    return util;
  }

  function createPool(transactionHash: string, item: ITxPoolTxDetails) {
    const pool = new Map<string, ITxPoolTxDetails>();
    pool.set(transactionHash, item);

    const txPool = TypeMoq.Mock.ofType<ITxPool>();
    txPool.setup(p => p.running()).returns(() => true);
    txPool.setup(p => p.pool).returns(() => pool);
    return txPool;
  }

  it('should return false when pool is not running', async () => {
    const txPool = TypeMoq.Mock.ofType<ITxPool>();
    txPool.setup(p => p.running()).returns(() => false);

    const pending = new Pending(null, txPool.object);
    const result = await pending.hasPending(null, null);

    assert.isFalse(result);
  });

  it('should return false when pool is empty', async () => {
    const address = '2';
    const gasPrice = new BigNumber(100000);

    const poolOperation = Operation.CLAIM;
    const requestedOperation = poolOperation;

    const txPool = TypeMoq.Mock.ofType<ITxPool>();
    txPool.setup(p => p.running()).returns(() => false);
    txPool.setup(p => p.pool).returns(() => new Map<string, ITxPoolTxDetails>());

    const util = createUtils(gasPrice);

    const pending = new Pending(util.object, txPool.object);

    const result = await pending.hasPending(
      { address, gasPrice },
      { type: requestedOperation, checkGasPrice: false }
    );

    assert.isFalse(result);
  });

  it('should return true when pool contains request and gasPrice check is off', async () => {
    const transactionHash = '1';
    const address = '2';
    const gasPrice = new BigNumber(100000);

    const poolOperation = Operation.CLAIM;
    const requestedOperation = poolOperation;

    const item = createTxPoolDetails(address, poolOperation, gasPrice);
    const txPool = createPool(transactionHash, item.object);
    const util = createUtils(gasPrice);

    const pending = new Pending(util.object, txPool.object);

    const result = await pending.hasPending(
      { address, gasPrice },
      { type: requestedOperation, checkGasPrice: false }
    );

    assert.isTrue(result);
  });

  it('should return false when pool contains CLAIM transaction but request is for EXECUTE operation', async () => {
    const transactionHash = '1';
    const address = '2';
    const gasPrice = new BigNumber(100000);

    const poolOperation = Operation.CLAIM;
    const requestedOperation = Operation.EXECUTE;

    const item = createTxPoolDetails(address, poolOperation, gasPrice);
    const txPool = createPool(transactionHash, item.object);
    const util = createUtils(gasPrice);

    const pending = new Pending(util.object, txPool.object);

    const result = await pending.hasPending(
      { address, gasPrice },
      { type: requestedOperation, checkGasPrice: false }
    );

    assert.isFalse(result);
  });

  it('should return false when pool contains transaction but gasPrice is lower than 1/3 of network gasPrice', async () => {
    const transactionHash = '1';
    const address = '2';
    const networkGasPrice = new BigNumber(100000);
    const gasPrice = networkGasPrice.div(5);

    const poolOperation = Operation.CLAIM;
    const requestedOperation = poolOperation;

    const item = createTxPoolDetails(address, poolOperation, gasPrice);
    const txPool = createPool(transactionHash, item.object);
    const util = createUtils(networkGasPrice);

    const pending = new Pending(util.object, txPool.object);

    const result = await pending.hasPending(
      { address, gasPrice },
      { type: requestedOperation, checkGasPrice: true }
    );

    assert.isFalse(result);
  });
});
