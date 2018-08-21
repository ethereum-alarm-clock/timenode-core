import { expect, assert } from 'chai';

import Config from '../../src/Config';
import { mockConfig, MockTxRequest } from '../helpers';
import { FnSignatures } from '../../src/Enum';
import hasPending from '../../src/Actions/Pending';
import BigNumber from 'bignumber.js';
import TxPool, { ITxPoolTxDetails, IPool } from '../../src/TxPool';

class Provider {
  public result: any;

  constructor(opts?: any) {
    const found: any = {};
    opts && opts.gas ? (found.gas = opts.gas) : undefined;
    opts && opts.input ? (found.input = opts.input) : undefined;
    opts && opts.value ? (found.value = opts.value) : undefined;
    opts && opts.gasPrice ? (found.gasPrice = opts.gasPrice) : undefined;

    this.result = {
      result: PENDINGS.map(pending => Object.assign({}, pending, found))
    };
  }
}

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

class pendingTxPool {
  public result: any;

  constructor(opts?: any) {
    const found: any = {};
    opts && opts.gas ? (found.gas = opts.gas) : undefined;
    opts && opts.input ? (found.input = opts.input) : undefined;
    opts && opts.value ? (found.value = opts.value) : undefined;
    opts && opts.gasPrice ? (found.gasPrice = opts.gasPrice) : undefined;
  }

  public getPool = (list: any): IPool => {
    return list
    .map((item: any) => {
      return {
        to: item.to || '0x0',
        from: item.from || '0x0',
        input: item.input || '0x0',
        gasPrice: new BigNumber(item.gasPrice || 0x0),
        timestamp: item.timestamp || new Date().getTime(),
        transactionHash: item.transactionHash || '0x0'
      }
    })
  }
}


const pendingTx = (opts?: any) => {
  let result: any = [];
  const pending: any = [];
  const defaultPending = {
    gas: 21000,
    gasPrice: 10 * 1e12,
    input: '0x',
    value: 0
  };
  if (opts.client === 'parity' && opts.result) {
    result = opts.result.map((res: any) => Object.assign({}, defaultPending, res));
  }
  if (opts.client === 'geth' && opts.result) {
    opts.result.map((res: any) => {
      if (!pending[res.from]) {
        pending[res.from] = [];
      }
      pending[res.from].push(Object.assign({}, defaultPending, res));
    });
    result = { pending };
  }
  return { result, client: opts.client };
};

const preConfig = (config: Config, opt?: any) => {
  opt.noPool = opt.noPool === false ? opt.noPool : true;
  if (opt.noPool) {
    config.txPool.stop();
  }
  config.web3 = {
    currentProvider: opt.provider ? opt.provider : new Provider(opt),
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
  config.client = opt.client;

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
    const options = { client: '', gasPrice };
    const config = preConfig(mockConfig(), options);
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), { checkGasPrice: true });
    assert.isFalse(pending);
  });

  it('Pending pool defaults to false', async () => {
    const gasPrice = 1 * 1e12;
    const config = preConfig(mockConfig(), { client: '', noPool: true, gasPrice });
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), { checkGasPrice: true });
    assert.isFalse(pending);
  });
});

describe('Pending Unit Tests', () => {
  it('Detects valid Pending claim requests', async () => {
    const expected = [true, true];
    const results: any = [];
    const gasPrice = 1 * 1e12;
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(mockConfig(), {
        client,
        gasPrice,
        noPool: false,
        provider: new Provider({ input: FnSignatures.claim })
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
          conf.txPool.pool = new pendingTxPool(options).getPool()
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
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(mockConfig(), {
        client,
        gasPrice,
        noPool: false,
        provider: new Provider({ input: FnSignatures.execute })
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
        const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice }), {
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
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(mockConfig(), {
        client,
        gasPrice,
        noPool: false,
        netGasPrice: 15 * 1e13,
        provider: new Provider({ input: FnSignatures.claim })
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
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
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(mockConfig(), {
        client,
        gasPrice,
        noPool: false,
        provider: new Provider({ input: FnSignatures.execute })
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
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
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(mockConfig(), {
        client,
        gasPrice,
        noPool: false,
        provider: new Provider({ input: FnSignatures.claim })
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
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
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(mockConfig(), {
        client,
        gasPrice,
        noPool: false,
        provider: new Provider({ input: FnSignatures.execute })
      })
    );
    await Promise.all(
      testConfigs.map(async conf => {
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
