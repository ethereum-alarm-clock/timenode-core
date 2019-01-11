import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { CLAIMED_EVENT, EXECUTED_EVENT } from '../../src/Actions/Helpers';
import { ITxPoolTxDetails } from '../../src/TxPool';
import TxPoolProcessor from '../../src/TxPool/TxPoolProcessor';
import { Operation } from '../../src/Types/Operation';
import { IFilterTx } from '../../src/TxPool/TxPool';
import { Util } from '@ethereum-alarm-clock/lib';

describe('TxPoolProcessor Unit Tests', () => {
  function setup(tx: { to: string; gasPrice: BigNumber }) {
    const util = TypeMoq.Mock.ofType<Util>();
    util.setup(u => u.getTransaction(TypeMoq.It.isAnyString())).returns(async () => tx as any);
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

    const filterTx: IFilterTx = {
      address,
      blockNumber: 1,
      data: '',
      logIndex: 0,
      blockHash: '',
      transactionIndex: 0,
      topics: [CLAIMED_EVENT],
      transactionHash,
      type
    };

    await processor.process(filterTx, pool);

    const res = pool.get(transactionHash);

    assert.isTrue(pool.has(transactionHash));
    assert.equal(res.operation, Operation.CLAIM);
    assert.equal(res.to, address);
    assert.equal(res.type, type);
    assert.isTrue(res.gasPrice.isEqualTo(gasPrice));
  });

  it('registers tx in pool with mined type', async () => {
    const address = '1';
    const type = 'mined';
    const gasPrice = new BigNumber(10000);
    const transactionHash = '1';

    const tx = { to: address, gasPrice };
    const { processor, pool } = setup(tx);

    const filterTx: IFilterTx = {
      address,
      data: '',
      transactionIndex: 0,
      blockHash: '',
      logIndex: 0,
      blockNumber: 1,
      topics: [EXECUTED_EVENT],
      transactionHash,
      type
    };

    await processor.process(filterTx, pool);

    const res = pool.get(transactionHash);

    assert.isTrue(pool.has(transactionHash));
    assert.equal(res.operation, Operation.EXECUTE);
    assert.equal(res.to, address);
    assert.equal(res.type, type);
    assert.isTrue(res.gasPrice.isEqualTo(gasPrice));
  });
});
