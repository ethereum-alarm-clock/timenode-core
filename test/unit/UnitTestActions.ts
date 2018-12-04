import { assert } from 'chai';
import {
  isExecuted,
  EXECUTED_EVENT,
  isTransactionStatusSuccessful,
  ABORTED_EVENT,
  isAborted,
  getAbortedExecuteStatus
} from '../../src/Actions/Helpers';
import { TxSendStatus } from '../../src/Enum';
import { TransactionReceipt } from 'web3/types';

describe('Actions Helpers Unit Tests', () => {
  describe('isExecuted()', () => {
    it('returns true when executed event present in receipt', () => {
      const receipt = {
        logs: [
          {
            topics: [EXECUTED_EVENT]
          }
        ]
      } as TransactionReceipt;
      assert.isTrue(isExecuted(receipt));
    });

    it('returns false when receipt executed event address mismatches', () => {
      const receipt = {
        logs: [{ topics: ['0x0'] }]
      } as TransactionReceipt;
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

  describe('isAborted()', () => {
    it('returns true when executed event was aborted', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT]
          }
        ]
      } as TransactionReceipt;
      assert.isTrue(isAborted(receipt));
    });
  });

  describe('getAbortedExecuteStatus()', () => {
    it('returns TxSendStatus.ABORTED_WAS_CANCELLED when AbortReason.WasCancelled', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000000'
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_WAS_CANCELLED, executeStatus);
    });

    it('returns TxSendStatus.ABORTED_ALREADY_CALLED when AbortReason.AlreadyCalled', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000001'
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_ALREADY_CALLED, executeStatus);
    });

    it('returns TxSendStatus.ABORTED_BEFORE_CALL_WINDOW when AbortReason.BeforeCallWindow', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000002'
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_BEFORE_CALL_WINDOW, executeStatus);
    });

    it('returns TxSendStatus.ABORTED_AFTER_CALL_WINDOW when AbortReason.AfterCallWindow', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000003'
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_AFTER_CALL_WINDOW, executeStatus);
    });

    it('returns TxSendStatus.ABORTED_RESERVED_FOR_CLAIMER when AbortReason.ReservedForClaimer', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000004'
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_RESERVED_FOR_CLAIMER, executeStatus);
    });

    it('returns TxSendStatus.ABORTED_INSUFFICIENT_GAS when AbortReason.InsufficientGas', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000005'
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_INSUFFICIENT_GAS, executeStatus);
    });

    it('returns TxSendStatus.ABORTED_TOO_LOW_GAS_PRICE when AbortReason.TooLowGasPrice', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000006'
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_TOO_LOW_GAS_PRICE, executeStatus);
    });

    it('returns TxSendStatus.ABORTED_UNKNOWN when unknown reason appeared', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000008'
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_UNKNOWN, executeStatus);
    });

    // tslint:disable-next-line:no-identical-functions
    it('returns TxSendStatus.ABORTED_UNKNOWN when no data found', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: ''
          }
        ]
      } as TransactionReceipt;

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(TxSendStatus.ABORTED_UNKNOWN, executeStatus);
    });
  });
});
