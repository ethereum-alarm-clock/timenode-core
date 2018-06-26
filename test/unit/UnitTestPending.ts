import { expect, assert } from 'chai';

import Config from '../../src/Config';
import { mockConfig } from '../helpers';
import { FnSignatures } from '../../src/Enum';
import hasPending from '../../src/Actions/Pending';

class provider {
  public result: any;

  constructor (opts?: any) {
    let found: any = {};
    opts && opts.gas ? found.gas = opts.gas : undefined;
    opts && opts.input ? found.input = opts.input : undefined;
    opts && opts.value ? found.value = opts.value : undefined;
    opts && opts.gasPrice ? found.gasPrice = opts.gasPrice : undefined;

    this.result = {
      result: PENDINGS.map( pending => Object.assign( {}, pending, found ))
    }
  }
  public send = (request?: any, callback?: any) => {
    return new Promise((reject: any, resolve: any) => {
      if (request.method == 'parity_pendingTransactions') {
        resolve(callback(null, pendingTx(Object.assign( {}, this.result, { client: 'parity' }) )));
      } else if (request.method == 'txpool_content') {
        resolve(callback(null, pendingTx(Object.assign( {}, this.result, { client: 'geth' }) )));
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

const preConfig = (opt?: any) =>
  Object.assign(
    {},
    {
      provider: opt.provider ? opt.provider : new provider(),
      web3: {
        currentProvider: opt.provider ? opt.provider : new provider(),
        eth: {
          getGasPrice: async (callback?: any) => {
            const gasPrice = opt.netGasPrice ? opt.netGasPrice : opt.gasPrice;
            if (callback) {
              callback( null, gasPrice);
            }
            return gasPrice;
          }
        }
      },
      eac: {}
    },
    opt
  );

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

const randomClient = () => CLIENTS[Math.floor(Math.random() * CLIENTS.length)];

describe('Pending Unit Tests', () => {

  it('Detects valid Pending requests (parity)', async () => {
    const gasPrice = 1 * 1e12;
    const config = mockConfig(preConfig({ client: 'parity', gasPrice }));
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), {});
    expect(pending).to.be.true;
  });

  it('Detects valid Pending requests (geth)', async () => {
    const gasPrice = 1 * 1e12;
    const config = mockConfig(preConfig({ client: 'geth', gasPrice }));
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), {});
    expect(pending).to.be.true;
  });

  it('Detects valid Pending claim requests', async () => {
      const expected = [true, true];
      const results: any = [];
      const gasPrice = 1 * 1e12;
      const testConfigs: Config[] = CLIENTS.map( client => mockConfig(preConfig(
        { 
            client,
            gasPrice,
            provider: new provider({ input: FnSignatures.claim})
        })));
      await Promise.all(testConfigs.map( async (conf) => {
          const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice, }), { type: 'claim' })
          results.push(pending);
      }))
      expect(results).to.deep.equal(expected);
  })

  it('Detects absence of valid Pending claim request', async () => {
      const expected = [false, false];
      const results: any = [];
      const gasPrice = 1 * 1e12;
      const testConfigs: Config[] = CLIENTS.map( client => mockConfig(preConfig(
        { 
            client,
            gasPrice,
            provider: new provider({ input: FnSignatures.execute})
        })));
      await Promise.all(testConfigs.map( async (conf) => {
          const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice, }), { type: 'claim' })
          results.push(pending);
      }))
      expect(results).to.deep.equal(expected);
  })

  it('Ignore Pending claim request with low gasprice', async () => {
      const expected = [false, false];
      const results: any = [];
      const gasPrice = 1 * 1e12;
      const testConfigs: Config[] = CLIENTS.map( client => mockConfig(preConfig(
        { 
            client,
            gasPrice,
            netGasPrice: 15* 1e13,
            provider: new provider({ input: FnSignatures.claim})
        })));
      await Promise.all(testConfigs.map( async (conf) => {
          const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice, }), { type: 'claim' })
          results.push(pending);
      }))
      expect(results).to.deep.equal(expected);
  })

  it('Detects valid Pending execute request', async () => {
      const expected = [true, true];
      const results: any = [];
      const gasPrice = 1 * 1e12;
      const testConfigs: Config[] = CLIENTS.map( client => mockConfig(preConfig(
        { 
            client,
            gasPrice,
            provider: new provider({ input: FnSignatures.execute})
        })));
      await Promise.all(testConfigs.map( async (conf) => {
          const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice, }), { type: 'execute' })
          results.push(pending);
      }))
      expect(results).to.deep.equal(expected);
  })

  it('Detects  absence of valid Pending execute request', async () => {
      const expected = [false, false];
      const results: any = [];
      const gasPrice = 1 * 1e12;
      const testConfigs: Config[] = CLIENTS.map( client => mockConfig(preConfig(
        { 
            client,
            gasPrice,
            provider: new provider({ input: FnSignatures.claim})
        })));
      await Promise.all(testConfigs.map( async (conf) => {
          const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice, }), { type: 'execute' })
          results.push(pending);
      }))
      expect(results).to.deep.equal(expected);
  })

  it('Detects Invalid Pending execute request', async () => {
      const expected = [false, false];
      const results: any = [];
      const gasPrice = 1 * 1e12;
      const exactPrice = 0.9 * 1e12;
      const testConfigs: Config[] = CLIENTS.map( client => mockConfig(preConfig(
        { 
            client,
            gasPrice,
            provider: new provider({ input: FnSignatures.execute})
        })));
      await Promise.all(testConfigs.map( async (conf) => {
          const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice:exactPrice , }), { type: 'execute', exactPrice })
          results.push(pending);
      }))
      expect(results).to.deep.equal(expected);
  })
});
