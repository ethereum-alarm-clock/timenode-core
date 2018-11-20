import * as TypeMoq from 'typemoq';
import IRouter from '../../src/Router';
import { Config } from '../../src';
import CacheScanner from '../../src/Scanner/CacheScanner';
import Cache, { ICachedTxDetails } from '../../src/Cache';
import W3Util from '../../src/Util';
import { TxStatus } from '../../src/Enum';
import { ITxRequest } from '../../src/Types';
import { assert } from 'chai';
import BigNumber from 'bignumber.js';

describe('Cache Scanner Unit Tests', () => {
  const BLOCKTIME = 14;
  const EAC = {
    transactionRequest: (address: any) => {
      const req = TypeMoq.Mock.ofType<ITxRequest>();
      req.setup(r => r.address).returns(() => address);
      return req.object;
    }
  };

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

  it('calculates the average blocktime', async () => {
    const util = TypeMoq.Mock.ofType<W3Util>();
    util.setup(u => u.getAverageBlockTime()).returns(() => Promise.resolve(BLOCKTIME));

    const transaction = TypeMoq.Mock.ofType<ICachedTxDetails>();
    transaction.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);

    const cache = new Cache<ICachedTxDetails>();
    cache.set('1', transaction.object);

    const router = TypeMoq.Mock.ofType<IRouter>();
    const config = TypeMoq.Mock.ofType<Config>();
    config.setup(c => c.cache).returns(() => cache);
    config.setup(c => c.util).returns(() => util.object);
    config.setup(c => c.eac).returns(() => EAC);

    const scanner = new CacheScanner(config.object, router.object);
    assert.notExists(scanner.avgBlockTime);

    await scanner.scanCache();

    assert.exists(scanner.avgBlockTime);
    assert.strictEqual(scanner.avgBlockTime, BLOCKTIME);
  });

  it('does prioritize requests in FreezePeriod ', async () => {
    const tx1 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx1.setup(tx => tx.status).returns(() => TxStatus.FreezePeriod);
    tx1.setup(tx => tx.temporalUnit).returns(() => 2);
    tx1.setup(tx => tx.windowStart).returns(() => new BigNumber(10000));
    tx1.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(9750));
    tx1.setup(tx => tx.bounty).returns(() => new BigNumber(10e9));

    const tx2 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx2.setup(tx => tx.status).returns(() => TxStatus.Executed);
    tx2.setup(tx => tx.temporalUnit).returns(() => 2);
    tx2.setup(tx => tx.windowStart).returns(() => new BigNumber(10000));
    tx2.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(9750));
    tx2.setup(tx => tx.bounty).returns(() => new BigNumber(10e9));

    const tx3 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx3.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);
    tx3.setup(tx => tx.temporalUnit).returns(() => 1);
    tx3.setup(tx => tx.windowStart).returns(() => new BigNumber(10000));
    tx3.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(9750));
    tx3.setup(tx => tx.bounty).returns(() => new BigNumber(10e9));

    const cache = new Cache<ICachedTxDetails>();
    cache.set('3', tx3.object);
    cache.set('2', tx2.object);
    cache.set('1', tx1.object);

    const routed: ITxRequest[] = [];

    const router = TypeMoq.Mock.ofType<IRouter>();
    router.setup(r => r.route(TypeMoq.It.isAny())).callback(txRequest => routed.push(txRequest));

    const config = TypeMoq.Mock.ofType<Config>();
    config.setup(c => c.cache).returns(() => cache);
    config.setup(c => c.eac).returns(() => EAC);

    const util = TypeMoq.Mock.ofType<W3Util>();
    util.setup(u => u.getAverageBlockTime()).returns(() => Promise.resolve(BLOCKTIME));
    config.setup(c => c.util).returns(() => util.object);

    const scanner = new CacheScanner(config.object, router.object);

    await scanner.scanCache();

    router.verify(r => r.route(TypeMoq.It.isAny()), TypeMoq.Times.exactly(3));

    assert.equal(routed.shift().address, '1');
  });

  it('prioritizes the tx with a higher bounty', async () => {
    const tx1 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx1.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);
    tx1.setup(tx => tx.temporalUnit).returns(() => 2);
    tx1.setup(tx => tx.windowStart).returns(() => new BigNumber(15000));
    tx1.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(14750));
    tx1.setup(tx => tx.bounty).returns(() => new BigNumber(10e9));

    const tx2 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx2.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);
    tx2.setup(tx => tx.temporalUnit).returns(() => 2);
    tx2.setup(tx => tx.windowStart).returns(() => new BigNumber(15000));
    tx2.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(14750));
    tx2.setup(tx => tx.bounty).returns(() => new BigNumber(10e10));

    const tx3 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx3.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);
    tx3.setup(tx => tx.temporalUnit).returns(() => 2);
    tx3.setup(tx => tx.windowStart).returns(() => new BigNumber(15000));
    tx3.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(14750));
    tx3.setup(tx => tx.bounty).returns(() => new BigNumber(10e8));

    const cache = new Cache<ICachedTxDetails>();
    cache.set('3', tx3.object);
    cache.set('2', tx2.object);
    cache.set('1', tx1.object);

    const routed: ITxRequest[] = [];

    const router = TypeMoq.Mock.ofType<IRouter>();
    router.setup(r => r.route(TypeMoq.It.isAny())).callback(txRequest => routed.push(txRequest));

    const config = TypeMoq.Mock.ofType<Config>();
    config.setup(c => c.cache).returns(() => cache);
    config.setup(c => c.eac).returns(() => EAC);

    const util = TypeMoq.Mock.ofType<W3Util>();
    util.setup(u => u.getAverageBlockTime()).returns(() => Promise.resolve(BLOCKTIME));
    config.setup(c => c.util).returns(() => util.object);

    const scanner = new CacheScanner(config.object, router.object);

    await scanner.scanCache();

    router.verify(r => r.route(TypeMoq.It.isAny()), TypeMoq.Times.exactly(3));

    assert.equal(routed.shift().address, '2');
  });

  it('prioritizes block tx over timestamp tx even if a higher bounty', async () => {
    const tx1 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx1.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);
    tx1.setup(tx => tx.temporalUnit).returns(() => 2);
    tx1.setup(tx => tx.windowStart).returns(() => new BigNumber(15000));
    tx1.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(14750));
    tx1.setup(tx => tx.bounty).returns(() => new BigNumber(10e9));

    const tx2 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx2.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);
    tx2.setup(tx => tx.temporalUnit).returns(() => 2);
    tx2.setup(tx => tx.windowStart).returns(() => new BigNumber(15000));
    tx2.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(14750));
    tx2.setup(tx => tx.bounty).returns(() => new BigNumber(10e10));

    const tx3 = TypeMoq.Mock.ofType<ICachedTxDetails>();
    tx3.setup(tx => tx.status).returns(() => TxStatus.ClaimWindow);
    tx3.setup(tx => tx.temporalUnit).returns(() => 1);
    tx3.setup(tx => tx.windowStart).returns(() => new BigNumber(15000));
    tx3.setup(tx => tx.claimWindowStart).returns(() => new BigNumber(14750));
    tx3.setup(tx => tx.bounty).returns(() => new BigNumber(10e8));

    const cache = new Cache<ICachedTxDetails>();
    cache.set('1', tx1.object);
    cache.set('2', tx2.object);
    cache.set('3', tx3.object);

    const routed: ITxRequest[] = [];

    const router = TypeMoq.Mock.ofType<IRouter>();
    router.setup(r => r.route(TypeMoq.It.isAny())).callback(txRequest => routed.push(txRequest));

    const config = TypeMoq.Mock.ofType<Config>();
    config.setup(c => c.cache).returns(() => cache);
    config.setup(c => c.eac).returns(() => EAC);

    const util = TypeMoq.Mock.ofType<W3Util>();
    util.setup(u => u.getAverageBlockTime()).returns(() => Promise.resolve(BLOCKTIME));
    config.setup(c => c.util).returns(() => util.object);

    const scanner = new CacheScanner(config.object, router.object);

    await scanner.scanCache();

    router.verify(r => r.route(TypeMoq.It.isAny()), TypeMoq.Times.exactly(3));

    assert.equal(routed.shift().address, '3');
  });
});
