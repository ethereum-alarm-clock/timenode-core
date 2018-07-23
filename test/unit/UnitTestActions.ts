import { expect, assert } from 'chai';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import Actions from '../../src/Actions';
import {
  isExecuted,
  EXECUTED_EVENT,
  isTransactionStatusSuccessful
} from '../../src/Actions/Helpers';

describe('Actions Unit Tests', async () => {
  const config: Config = mockConfig();
  const tx: any = await MockTxRequest(config.web3);
  let actions: Actions;

  it('initializes the Actions with a Config', () => {
    actions = new Actions(config);
    expect(actions).to.exist;
  });

  // it('claim action', () => {
  //   const claimingResult = actions.claim(tx);
  //   expect(claimingResult).to.be.true;
  // });
});

describe('Actions Helpers Unit Tests', async () => {
  describe('isExecuted()', () => {
    it('returns true when executed event present in receipt', () => {
      const receipt = {
        logs: [
          {
            topics: [EXECUTED_EVENT]
          }
        ]
      };
      assert.isTrue(isExecuted(receipt));
    });

    it('returns false when receipt executed event address mismatches', () => {
      const receipt = {
        logs: [{ topics: ['0x0'] }]
      };
      assert.isFalse(isExecuted(receipt));
    });

    it('returns false when no receipt', () => {
      const receipt: any = null;
      assert.isFalse(isExecuted(receipt));
    });
  });

  describe('isTransactionStatusSuccessful()', () => {
    it('returns true when status code is 1', () => {
      assert.isTrue(isTransactionStatusSuccessful(1));
      assert.isTrue(isTransactionStatusSuccessful('0x1'));
      assert.isTrue(isTransactionStatusSuccessful('0x01'));
    });

    it('returns false status other than 1', () => {
      assert.isFalse(isTransactionStatusSuccessful(null));
      assert.isFalse(isTransactionStatusSuccessful(undefined));

      assert.isFalse(isTransactionStatusSuccessful(2));
      assert.isFalse(isTransactionStatusSuccessful('2'));
      assert.isFalse(isTransactionStatusSuccessful('0x02'));
    });
  });
});
