/* tslint:disable:no-unused-expression */
import { expect } from 'chai';

import Config from '../../src/Config';
import { mockConfig } from '../helpers';
import hasPending from '../../src/Actions/Pending';

const provider = () => {
  send: (request: any) => {
    if (request.method == 'parity_pendingTransactions') {
      return pendingTx({ client: 'parity', result: request.expected });
    } else if (request.method == 'txpool_content') {
      return pendingTx({ client: 'geth', result: request.expected });
    }
  };
};

const pendingTx = (opts?: any) => {
  let result: object;
  const defaultPending = {
    blocknumber: 0,
    gas: 21000,
    gasPrice: 10 * 1e12,
    input: '0x',
    value: 0
  };
  result =
    opts.client == 'geth'
      ? opts.result.map((res: any) => Object.assign(defaultPending, res))
      : opts.result.map((res: any) => {
          if (!result[res.from]) {
            result[res.from] = [];
          }
          result[res.from].push(Object.assign(defaultPending, res));
        });
  return { result, client: opts.clent };
};

const preConfig = (opt?: any) => {
  Object.assign(
    {
      provider,
      web3: {},
      eac: {}
    },
    opt
  );
};

const mockTx = (opts: any) => {
  opts.address;
};

const clients = ['geth', 'parity'];

const randomClient = () => clients[Math.floor(Math.random() * clients.length)];

describe('Pending Unit Tests', async () => {
  const config: Config = mockConfig(preConfig());

  it('Checks that the right clent is triggerered', () => {
    const testConfig: Config = mockConfig(preConfig({ client: randomClient() }));
  });

  // it('initializes the Actions with a Config', () => {
  //     actions = new Actions(config);
  //     expect(actions).to.exist;
  // });

  // it('claim action', () => {
  //     const claimingResult = actions.claim(tx);
  //     expect(claimingResult).to.be.true;
  // });
});
