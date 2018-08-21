import { expect, assert } from 'chai';

import Config from '../../src/Config';
import { mockConfig, MockTxRequest } from '../helpers';
import { FnSignatures } from '../../src/Enum';
import hasPending from '../../src/Actions/Pending';
import BigNumber from 'bignumber.js';

class Provider {
  public result: any;

  constructor(opts?: any) {
    const found: any = {};
    opts && opts.gas ? (found.gas = opts.gas) : undefined; // tslint:disable-line no-unused-expression
    opts && opts.input ? (found.input = opts.input) : undefined; // tslint:disable-line no-unused-expression
    opts && opts.value ? (found.value = opts.value) : undefined; // tslint:disable-line no-unused-expression
    opts && opts.gasPrice ? (found.gasPrice = opts.gasPrice) : undefined; // tslint:disable-line no-unused-expression

    this.result = {
      result: PENDINGS.map(pending => Object.assign({}, pending, found))
    };
  }
  public send = (request?: any, callback?: any) => {
    return new Promise((resolve: any) => {
      if (request.method === 'parity_pendingTransactions') {
        resolve(callback(null, pendingTx(Object.assign({}, this.result, { client: 'parity' }))));
      } else if (request.method === 'txpool_content') {
        resolve(callback(null, pendingTx(Object.assign({}, this.result, { client: 'geth' }))));
      }
    });
  };
  public sendAsync = async (request: any, callback: any) => {
    return await this.send(request, callback);
  };
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

describe('hasPendingParity()', () => {
  it('Detects valid Pending requests (parity)', async () => {
    const gasPrice = 1 * 1e12;
    const config = preConfig(mockConfig(), { client: 'parity', noPool: true, gasPrice });
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), { checkGasPrice: true });
    assert(pending);
  });
});

describe('hasPendingGeth()', () => {
  it('Detects valid Pending requests (geth)', async () => {
    const gasPrice = 1 * 1e12;
    const config = preConfig(mockConfig(), { client: 'geth', noPool: true, gasPrice });
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), { checkGasPrice: true });
    assert(pending);
  });
});

describe('hasPending()', () => {
  it('Unknown clients defaults to false', async () => {
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

  it('Detects absence of valid Pending claim request', async () => {
    const expected = [false, false];
    const results: any = [];
    const gasPrice = 1 * 1e12;
    const testConfigs: Config[] = CLIENTS.map(client =>
      preConfig(mockConfig(), {
        client,
        gasPrice,
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
