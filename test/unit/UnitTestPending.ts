import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { ITxPool } from '../../src/TxPool';
import { Pending } from '../../src/Actions/Pending';

describe('Pending Unit Tests', () => {
  it('should return false when pool is not running', async () => {
    const txPool = TypeMoq.Mock.ofType<ITxPool>();
    txPool.setup(p => p.running()).returns(() => false);

    const pending = new Pending(null, txPool.object);
    const result = await pending.hasPending(null, null);

    assert.isFalse(result);
  });
});
