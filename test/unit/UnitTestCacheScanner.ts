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

  const mockTx = (params: any) => {
    const TX_DEFAULTS: ICachedTxDetails = {
      status: TxStatus.ClaimWindow,
      temporalUnit: 2,
      windowStart: new BigNumber(10000),
      claimWindowStart: new BigNumber(9750),
      claimedBy: '0x0',
      bounty: new BigNumber(10e9),
      wasCalled: false
    };

    const transaction = TypeMoq.Mock.ofType<ICachedTxDetails>();
    transaction.setup(tx => tx.status).returns(() => params.status || TX_DEFAULTS.status);
    transaction
      .setup(tx => tx.temporalUnit)
      .returns(() => params.temporalUnit || TX_DEFAULTS.temporalUnit);
    transaction
      .setup(tx => tx.windowStart)
      .returns(() => params.windowStart || TX_DEFAULTS.windowStart);
    transaction
      .setup(tx => tx.claimWindowStart)
      .returns(() => params.claimWindowStart || TX_DEFAULTS.claimWindowStart);
    transaction.setup(tx => tx.bounty).returns(() => params.bounty || TX_DEFAULTS.bounty);
    return transaction;
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
    const tx1 = mockTx({ status: TxStatus.FreezePeriod });
    const tx2 = mockTx({ status: TxStatus.Executed });
    const tx3 = mockTx({ status: TxStatus.ClaimWindow });

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

  it('prioritizes the tx with a higher bounty if in the same block', async () => {
    const tx1 = mockTx({ bounty: new BigNumber(10e9) });
    const tx2 = mockTx({ bounty: new BigNumber(10e10) });
    const tx3 = mockTx({ bounty: new BigNumber(10e8) });

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
    const tx1 = mockTx({ temporalUnit: 2 });
    const tx2 = mockTx({ temporalUnit: 2 });
    const tx3 = mockTx({ temporalUnit: 1 });

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
