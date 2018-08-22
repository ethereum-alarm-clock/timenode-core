import { expect, assert } from 'chai';

import Config from '../../src/Config';
import { mockConfig, MockTxRequest } from '../helpers';
import { FnSignatures } from '../../src/Enum';
import hasPending from '../../src/Actions/Pending';
import BigNumber from 'bignumber.js';
import TxPool, { ITxPoolTxDetails, IPool } from '../../src/TxPool';

const CLIENTS = ['geth', 'parity'];
const startAddr = '0x2ffd48cc061331d071a1a8178cfc2a3863d56d4e';
const PENDINGS = [
  {
    from: startAddr,
    to: startAddr
  },
  {
    from: startAddr,
    to: startAddr + 1
  },
  {
    from: startAddr + 1,
    to: startAddr
  },
  {
    from: startAddr + 1,
    to: startAddr + 1
  }
];

class PendingTxPool {
  public result: any;

  constructor(opts?: any) {
    this.result = Object.assign(
      {
        to: '0x0',
        from: '0x0',
        input: '0x0',
        transactionHashtimestamp: new Date().getTime(),
        gasPrice: 0x0
      },
      opts
    );
  }

  public getPool = (list: any): IPool => {
    const pool: any = [];
    list.forEach(
      (item: any): any => {
        const transactionHash =
          item.transactionHash || '0x0' + new Date().getTime() * Math.random();
        pool[transactionHash] = Object.assign({}, this.result, item);
        pool[transactionHash].gasPrice = new BigNumber(pool[transactionHash].gasPrice);
      }
    );
    return pool;
  };
}

const preConfig = (config: Config, opt?: any) => {
  opt.noPool = opt.noPool === false ? opt.noPool : true;
  if (opt.noPool) {
    config.txPool.stop();
  }
  config.web3 = {
    eth: {
      getGasPrice: async (callback?: any) => {
        const gasPrice = opt.netGasPrice ? opt.netGasPrice : opt.gasPrice;
        if (callback) {
          callback(null, new BigNumber(gasPrice));
        }
        return gasPrice;
      }
    }
  };
  config.util.web3 = config.web3;
  return config;
};

const mockTx = (opts: any) => {
  return {
    address: opts.address,
    gasPrice: opts.gasPrice
  };
};

describe('hasPending()', () => {
  it('Pending defaults to false', async () => {
    const gasPrice = 1 * 1e12;
    const options = { gasPrice };
    const config = preConfig(await mockConfig(), options);
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), {
      checkGasPrice: true
    });
    assert.isFalse(pending);
  });

  it('Pending pool defaults to false', async () => {
    const gasPrice = 1 * 1e12;
    const config = preConfig(await mockConfig(), { noPool: true, gasPrice });
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), {
      checkGasPrice: true
    });

    assert.isFalse(pending);
  });
});

describe('Pending Unit Tests', () => {
  it('Detects valid Pending claim requests', async () => {
    const expected = [true, true];
    const results: any = [];
    const gasPrice = 1 * 1e12;
    const options = { gasPrice, input: FnSignatures.claim };
    const config = await mockConfig();
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(config, {
        gasPrice,
        noPool: false
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
        conf.txPool.pool.pool = new PendingTxPool(options).getPool(PENDINGS);
        const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice }), {
          checkGasPrice: true,
          type: 'claim'
        });
        results.push(pending);
      })
    );
    expect(results).to.deep.equal(expected);
  });

  it('Detects absence of valid Pending claim request', async () => {
    const expected = [false, false];
    const results: any = [];
    const gasPrice = 1 * 1e12;
    const options = { gasPrice, input: FnSignatures.execute };
    const config = await mockConfig();
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(config, {
        gasPrice,
        noPool: false
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
        conf.txPool.pool.pool = new PendingTxPool(options).getPool(PENDINGS);
        const pending = await hasPending(conf, mockTx({ address: startAddr + '001', gasPrice }), {
          checkGasPrice: true,
          type: 'claim'
        });
        results.push(pending);
      })
    );
    expect(results).to.deep.equal(expected);
  });

  it('Ignore Pending claim request with low gasprice', async () => {
    const expected = [false, false];
    const results: any = [];
    const gasPrice = 1 * 1e12;
    const options = { gasPrice, input: FnSignatures.claim };
    const config = await mockConfig();
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(config, {
        gasPrice,
        noPool: false,
        netGasPrice: (gasPrice / 0.2999999).toFixed()
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
        conf.txPool.pool.pool = new PendingTxPool(options).getPool(PENDINGS);
        const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice }), {
          checkGasPrice: true,
          type: 'claim'
        });
        results.push(pending);
      })
    );
    expect(results).to.deep.equal(expected);
  });

  it('Detects valid Pending execute request', async () => {
    const expected = [true, true];
    const results: any = [];
    const gasPrice = 1 * 1e12;
    const options = { gasPrice, input: FnSignatures.execute };
    const config = await mockConfig();
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(config, {
        gasPrice,
        noPool: false
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
        conf.txPool.pool.pool = new PendingTxPool(options).getPool(PENDINGS);
        const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice }), {
          checkGasPrice: true,
          type: 'execute'
        });
        results.push(pending);
      })
    );
    expect(results).to.deep.equal(expected);
  });

  it('Detects  absence of valid Pending execute request', async () => {
    const expected = [false, false];
    const results: any = [];
    const gasPrice = 1 * 1e12;
    const options = { gasPrice, input: FnSignatures.claim };
    const config = await mockConfig();
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(config, {
        gasPrice,
        noPool: false
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
        conf.txPool.pool.pool = new PendingTxPool(options).getPool(PENDINGS);
        const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice }), {
          checkGasPrice: true,
          type: 'execute'
        });
        results.push(pending);
      })
    );
    expect(results).to.deep.equal(expected);
  });

  it('Detects Invalid Pending execute request', async () => {
    const expected = [false, false];
    const results: any = [];
    const gasPrice = 1 * 1e12;
    const minPrice = new BigNumber(0.9 * 1e12);
    const options = { gasPrice: minPrice.times(0.9), input: FnSignatures.claim };
    const config = await mockConfig();
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(config, {
        gasPrice,
        noPool: false
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
        conf.txPool.pool.pool = new PendingTxPool(options).getPool(PENDINGS);
        const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice: minPrice }), {
          checkGasPrice: true,
          type: 'execute',
          minPrice
        });
        results.push(pending);
      })
    );
    expect(results).to.deep.equal(expected);
  });
});
