import { expect, assert } from 'chai';
import { TimeNode } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import Actions from '../../src/Actions';
import { shortenAddress } from '../../src/Actions/Actions';
import {
  isExecuted,
  EXECUTED_EVENT,
  isTransactionStatusSuccessful
} from '../../src/Actions/Helpers';
import { ClaimStatus } from '../../src/Enum';

describe('shortenAddress()', () => {
  const address = '0x487a54e1d033db51c8ee8c03edac2a0f8a6892c6';
  const expected = '0x487a...892c6';
  expect(shortenAddress(address)).to.equal(expected);
});

describe('Actions Unit Tests', async () => {
  it('sets claimingFailed to true when claim transaction reverts', async () => {
    const config = await mockConfig();
    const myAccount = config.wallet.getAddresses()[0];
    const timenode = new TimeNode(config);

    config.wallet.sendRawTransaction = async () => {
      return {};
    };

    config.wallet.getTransactionReceipt = async () => {
      return {
        from: config.wallet.getAddresses()[0],
        receipt: {
          status: '0x0',
          gasUsed: 22000
        }
      };
    };

    const actions = new Actions(config);

    const tx = await MockTxRequest(config.web3);

    assert.equal(timenode.getClaimedNotExecutedTransactions()[myAccount].length, 0);
    assert.equal(timenode.getUnsucessfullyClaimedTransactions()[myAccount].length, 0);

    const nextAccount = config.wallet.nextAccount.getAddressString();
    const claimingResult = await actions.claim(tx, nextAccount);

    assert.equal(timenode.getClaimedNotExecutedTransactions()[myAccount].length, 0);
    assert.equal(timenode.getUnsucessfullyClaimedTransactions()[myAccount].length, 1);

    assert.equal(claimingResult, ClaimStatus.FAILED);
  });
});

describe('Actions Helpers Unit Tests', () => {
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
