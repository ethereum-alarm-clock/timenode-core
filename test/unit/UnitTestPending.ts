import { expect, assert } from 'chai';

import Config from '../../src/Config';
import { mockConfig } from '../helpers';
import hasPending from '../../src/Actions/Pending';

class provider {
  public send = (request?: any, callback?: any) => {
    return new Promise((reject: any, resolve: any) => {
      if (request.method == 'parity_pendingTransactions') {
        callback(null, pendingTx({ client: 'parity', result: PENDINGS }));
      } else if (request.method == 'txpool_content') {
        callback(null, pendingTx({ client: 'geth', result: PENDINGS }));
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
    input: 'claim',
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
      provider,
      web3: {
        currentProvider: new provider(),
        eth: {
          getGasPrice: async () => opt.gasPrice
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
  const gasPrice = 1 * 1e12;

  it('Detects valid Pending claim requests (parity)', async () => {
    const config = mockConfig(preConfig({ client: 'parity', gasPrice }));
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), {});
    expect(pending).to.be.true;
  });

  it('Detects valid Pending claim requests (geth)', async () => {
    const config = mockConfig(preConfig({ client: 'geth', gasPrice }));
    const pending = await hasPending(config, mockTx({ address: startAddr, gasPrice }), {});
    expect(pending).to.be.true;
  });

  // it('Detects valid Pending claim requests', (done) => {
  //     const gasPrice = 1 * 1e12;
  //     const testConfigs: Config[] = CLIENTS.map( client => mockConfig(preConfig({ client, gasPrice })));
  //     testConfigs.forEach( (conf) => {
  //         const pending = hasPending(conf, mockTx({ address: startAddr, gasPrice }), { type: 'claim' })
  //         pending.then( (res?:any) => {
  //             expect(pending).to.equal(false);
  //         },(err?:any) => {
  //         })
  //     })
  // })

  // it('Detects valid Pending claim request', async () => {
  //     const gasPrice = 1 * 1e12;
  //     const conf = mockConfig(preConfig({ client: randomClient(), gasPrice }));
  //     // async () => {
  //         const pending = hasPending(conf, mockTx({ address: startAddr, gasPrice }), { type: 'claim' });
  //         assert.isNotTrue(await pending);
  //         // expect(await pending).to.equal(false);
  //     // }
  // }).timeout(10000)

  // it('Detects absence of Pending claim request', async () => {
  //     const gasPrice = 1 * 1e12;
  //     const conf = mockConfig(preConfig({ client: randomClient(), gasPrice }));
  //     expect(await hasPending(conf, mockTx({ address: startAddr+2, gasPrice }), { type: 'claim' })).to.equal(true);
  // })

  // it('Detects valid Pending execute request', async () => {
  //     const gasPrice = 1 * 1e12;
  //     const conf = mockConfig(preConfig({ client: randomClient(), gasPrice }));
  //     const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice }), { type: 'execute' });
  //     expect(pending).to.equal(true);
  // })

  // it('Detects absence of execute execute request', async () => {
  //     const gasPrice = 1 * 1e12;
  //     const conf = mockConfig(preConfig({ client: randomClient(), gasPrice }));
  //     expect(await hasPending(conf, mockTx({ address: startAddr+2, gasPrice }), { type: 'execute' })).to.equal(true);
  // })

  // it('Detects Invalid Pending execute request', async () => {
  //     const gasPrice = 1.01 * 1e12;
  //     const conf = mockConfig(preConfig({ client: randomClient(), gasPrice }));
  //     const pending = await hasPending(conf, mockTx({ address: startAddr, gasPrice }), { type: 'execute' });
  //     expect(pending).to.equal(true);
  // })
});
