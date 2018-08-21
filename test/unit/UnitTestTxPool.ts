import { assert } from 'chai';
import BigNumber from 'bignumber.js';
import { Pool } from '../../src/TxPool/Pool';
import TxPool from '../../src/TxPool';
import { Config } from '../../src';

const ADDRESSES = [
  '0x72059fee98e3a3fa80618cb1446b550af0f5e1ec',
  '0x48e258a63f5acd3630d9e2a4e2c6a9f8f6aed4e8',
  '0xa4b197b83b06f97c1be081e95f872458f7f9a978',
  '0x72059fee98e3a3fa80618cb1446b550af0f5e1ec',
  '0x48e258a63f5acd3630d9e2a4e2c6a9f8f6aed4e8',
  '0xa4b197b83b06f97c1be081e95f872458f7f9a978',
  '0x72059fee98e3a3fa80618cb1446b550af0f5e1ec',
  '0x48e258a63f5acd3630d9e2a4e2c6a9f8f6aed4e8',
  '0xa4b197b83b06f97c1be081e95f872458f7f9a978'
]

const TRANSACTIONS = [
  '0x1733012b5e992830e47d6ae621757195d1628f4a9ccba1235bc21d01afb2f705',
  '0x382d38086d01e0a6e0bf62def66950d324d1395090193a1b5829dd1740204b75',
  '0x30e02327fece704bf4ae7a6d95db7be34f9f56b5c9a936c895ba63e86d78c14d',
  '0x8c2b0ae72ab69479650309201194aa2a2bffa0905b40735c3af865e59a75b724',
  '0xcdb4365181a7f52e16cc29bb27825501d06330f79ff3d5f19d993d6722388135',
  '0x294d614d4a2a2cef8ac9489facf05c75ece680d4a9a44892f1ccaa83c71bd095',
  '0xc1177e30296886e47dc16687b63e5d7be4f781f7b37ed567e2164641a02dae10',
  '0x733b185fdb6f77d07de61d6fd77f4854102f6fc935c9b8a5a45365adae0bc859',
  '0xad08860f3d0c9b0f22b6a48f01b992d2c614dc94e8c19fd21d8dc9a007038e0d'
]

const mockTxDetails = (opts: any) => {
  opts.gasPrice = opts.gasPrice || 0x20;
  return {
    transactionHash : opts.transactionHash || 0x0,
    gasPrice: new BigNumber(opts.gasPrice),
    from: opts.from || 0x0,
    to: opts.to || 0x0,
    input: opts.input || '0x0',
    timestamp: opts.input || new Date().getTime()
  }
}


describe('TxPool unit tests', () => {
  describe('constructor()', () => {
    it('Instantiates new pool', () => {
      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545' }));
      assert.exists(txPool.pool);
      assert.exists(txPool.config);
    });
  })

  describe('start()', () => {
    it('Successfully starts new pool', async () => {
      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545' }));
      await txPool.start();
      
      assert.exists(txPool.subs.pending);
      assert.exists(txPool.subs.latest);
      assert.exists(txPool.subs.mined);
    });
  })

  describe('stop()', () => {
    it('Successfully starts new pool', async () => {
      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545' }));
      await txPool.start();
      
      assert.exists(txPool.subs.pending);
      assert.exists(txPool.subs.latest);
      assert.exists(txPool.subs.mined);

      await txPool.stop();
      
      assert.notExists(txPool.subs.pending);
      assert.notExists(txPool.subs.latest);
      assert.notExists(txPool.subs.mined);
    });
  })

  describe('TxPool flow', () => {

    it('preSet()', async () => {
      const tx = TRANSACTIONS[Math.floor(Math.random()*TRANSACTIONS.length)];
      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545', disableDetection: true }));

      expect(txPool.pool.preSet(tx)).to.be.true;
      expect(txPool.pool.get(tx, 'transactionHash')).to.deep.equal([true]);
      expect(txPool.pool.preSet(tx)).to.be.false;
    });

    it('set()', async () => {
      const tx = TRANSACTIONS[Math.floor(Math.random()*TRANSACTIONS.length)];
      const from = ADDRESSES[Math.floor(Math.random()*TRANSACTIONS.length)];
      const to = ADDRESSES[Math.floor(Math.random()*TRANSACTIONS.length)];
      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545', disableDetection: true }));

      txPool.pool.set(tx, mockTxDetails({
        transactionHash : tx,
        gasPrice: new BigNumber(0x20),
        from,
        to,
      }))

      expect(txPool.pool.has(tx, 'transactionHash')).to.be.true;
    });

    it('length()', async () => {
      const count = Math.floor( Math.random() * TRANSACTIONS.length );

      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545', disableDetection: true }));
      for( let i = 0; i < count; i++) {
        txPool.pool.set(TRANSACTIONS[i], mockTxDetails({
          transactionHash : TRANSACTIONS[i],
          from: ADDRESSES[i],
          to: ADDRESSES[i]
        }))
      }

      expect(txPool.pool.length()).to.be.equal(count);
    });

    it('stored()', async () => {
      const count = Math.floor( Math.random() * TRANSACTIONS.length );
      const expected: any = [];

      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545', disableDetection: true }));
      for( var i = 0; i < count; i++) {
        txPool.pool.set(TRANSACTIONS[i], mockTxDetails({
          transactionHash : TRANSACTIONS[i],
          from: ADDRESSES[i],
          to: ADDRESSES[i]
        }))
        expected.push(TRANSACTIONS[i]);
      }

      expect(txPool.pool.stored()).to.deep.equal(expected);
    });

    it('del()', async () => {
      const tx = TRANSACTIONS[Math.floor(Math.random()*10)];
      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545', disableDetection: true }));

      txPool.pool.pool[tx] = mockTxDetails({
        transactionHash : tx
      })

      expect(txPool.pool.has(tx, 'transactionHash')).to.be.true;
      txPool.pool.del(tx);
      expect(txPool.pool.has(tx, 'transactionHash')).to.be.false;
    });

    it('wipe()', async () => {
      const tx = TRANSACTIONS[Math.floor(Math.random()*TRANSACTIONS.length)];
      const txPool: TxPool = new TxPool(new Config({ providerUrl: 'http://localhost:8545', disableDetection: true }));

      txPool.pool.set(tx, mockTxDetails({
        transactionHash : tx
      }))

      expect(txPool.pool.length()).to.equal(1);

      txPool.pool.wipe();
      expect(txPool.pool.isEmpty()).to.be.true;
    });

  });
});
