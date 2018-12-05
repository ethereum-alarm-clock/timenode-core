import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';

import { W3Util } from '../../src';
import { CLAIMED_EVENT, EXECUTED_EVENT } from '../../src/Actions/Helpers';
import { ITxPoolTxDetails } from '../../src/TxPool';
import TxPoolProcessor from '../../src/TxPool/TxPoolProcessor';
import { Operation } from '../../src/Types/Operation';

describe('TxPoolProcessor Unit Tests', () => {
  function setup(tx: { to: string; gasPrice: BigNumber }) {
    const util = TypeMoq.Mock.ofType<W3Util>();
    util.setup(u => u.getTransaction(TypeMoq.It.isAnyString())).returns(async () => tx);
    const pool = new Map<string, ITxPoolTxDetails>();
    const processor = new TxPoolProcessor(util.object);
    return { processor, pool };
  }

  it('registers tx in pool with pending type', async () => {
    const address = '1';
    const type = 'pending';
    const gasPrice = new BigNumber(10000);
    const transactionHash = '1';

    const tx = { to: address, gasPrice };
    const { processor, pool } = setup(tx);

    const filterTx = {
      address,
      blockNumber: 1,
      topics: [CLAIMED_EVENT],
      transactionHash,
      type
    };

    await processor.process(null, filterTx, pool);

    const res = pool.get(transactionHash);

    assert.isTrue(pool.has(transactionHash));
    assert.equal(res.operation, Operation.CLAIM);
    assert.equal(res.to, address);
    assert.equal(res.type, type);
    assert.isTrue(res.gasPrice.equals(gasPrice));
  });

  it('registers tx in pool with mined type', async () => {
    const address = '1';
    const type = 'mined';
    const gasPrice = new BigNumber(10000);
    const transactionHash = '1';

    const tx = { to: address, gasPrice };
    const { processor, pool } = setup(tx);

    const filterTx = {
      address,
      blockNumber: 1,
      topics: [EXECUTED_EVENT],
      transactionHash,
      type
    };

    await processor.process(null, filterTx, pool);

    const res = pool.get(transactionHash);

    assert.isTrue(pool.has(transactionHash));
    assert.equal(res.operation, Operation.EXECUTE);
    assert.equal(res.to, address);
    assert.equal(res.type, type);
    assert.isTrue(res.gasPrice.equals(gasPrice));
  });
});
