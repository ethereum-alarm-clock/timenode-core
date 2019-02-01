import { Util } from '@ethereum-alarm-clock/lib';
import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { Log } from 'web3/types';

import { CLAIMED_EVENT } from '../../src/Actions/Helpers';
import { ITxPoolTxDetails } from '../../src/TxPool';
import TxPoolProcessor from '../../src/TxPool/TxPoolProcessor';
import { Operation } from '../../src/Types/Operation';

describe('TxPoolProcessor Unit Tests', () => {
  function setup(tx: { to: string; gasPrice: BigNumber }) {
    const util = TypeMoq.Mock.ofType<Util>();
    util.setup(u => u.getTransaction(TypeMoq.It.isAnyString())).returns(async () => tx as any);
    const pool = new Map<string, ITxPoolTxDetails>();
    const processor = new TxPoolProcessor(util.object);
    return { processor, pool };
  }

  it('registers tx in pool', async () => {
    const address = '1';
    const gasPrice = new BigNumber(10000);
    const transactionHash = '1';

    const tx = { to: address, gasPrice };
    const { processor, pool } = setup(tx);

    const filterTx: Log = {
      address,
      blockNumber: 1,
      data: '',
      logIndex: 0,
      blockHash: '',
      transactionIndex: 0,
      topics: [CLAIMED_EVENT],
      transactionHash
    };

    await processor.process(filterTx, pool);

    const res = pool.get(transactionHash);

    assert.isTrue(pool.has(transactionHash));
    assert.equal(res.operation, Operation.CLAIM);
    assert.equal(res.to, address);
    assert.isTrue(res.gasPrice.equals(gasPrice));
  });
});
