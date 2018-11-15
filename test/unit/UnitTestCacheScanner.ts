import * as TypeMoq from 'typemoq';
import IRouter from '../../src/Router';
import { Config } from '../../src';
import CacheScanner from '../../src/Scanner/CacheScanner';
import Cache, { ICachedTxDetails } from '../../src/Cache';
import { TxStatus } from '../../src/Enum';
import { ITxRequest } from '../../src/Types';
import { assert } from 'chai';

describe('Cache Scanner Unit Tests', () => {
  it('does not route when cache empty', async () => {
    const cache = TypeMoq.Mock.ofType<Cache<ICachedTxDetails>>();
    cache.setup(c => c.isEmpty()).returns(() => true);

    const router = TypeMoq.Mock.ofType<IRouter>();
    const config = TypeMoq.Mock.ofType<Config>();
    config.setup(c => c.cache).returns(() => cache.object);

    const scanner = new CacheScanner(config.object, router.object);

    await scanner.scanCache();

    router.verify(r => r.route(TypeMoq.It.isAny()), TypeMoq.Times.never());
  });

  it('does prioritize requests in FreezePeriod ', async () => {
    const tx1 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx1.setup(tx => tx.status).returns(() => TxStatus.FreezePeriod);

    const tx2 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx2.setup(tx => tx.status).returns(() => TxStatus.Executed);

    const tx3 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx3.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);

    const cache = new Cache<ICachedTxDetails>();
    cache.set('3', tx3.object);
    cache.set('2', tx2.object);
    cache.set('1', tx1.object);

    const routed: ITxRequest[] = [];

    const router = TypeMoq.Mock.ofType<IRouter>();
    router.setup(r => r.route(TypeMoq.It.isAny())).callback(txRequest => routed.push(txRequest));

    const eac = {
      transactionRequest: (address: any) => {
        const req = TypeMoq.Mock.ofType<ITxRequest>();
        req.setup(r => r.address).returns(() => address);
        return req.object;
      }
    };

    const config = TypeMoq.Mock.ofType<Config>();
    config.setup(c => c.cache).returns(() => cache);
    config.setup(c => c.eac).returns(() => eac);

    const scanner = new CacheScanner(config.object, router.object);

    await scanner.scanCache();

    router.verify(r => r.route(TypeMoq.It.isAny()), TypeMoq.Times.exactly(3));

    assert.equal('1', routed.shift().address);
  });
});
