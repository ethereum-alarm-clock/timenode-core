import { assert } from 'chai';
import {
  isExecuted,
  EXECUTED_EVENT,
  isTransactionStatusSuccessful,
  ABORTED_EVENT,
  isAborted,
  getAbortedExecuteStatus
} from '../../src/Actions/Helpers';
import { ExecuteStatus } from '../../src/Enum';

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

  describe('isAborted()', () => {
    it('returns true when executed event was aborted', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT]
          }
        ]
      };
      assert.isTrue(isAborted(receipt));
    });
  });

  describe('getAbortedExecuteStatus()', () => {
    it('returns ExecuteStatus.ABORTED_WAS_CANCELLED when AbortReason.WasCancelled', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000000'
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_WAS_CANCELLED, executeStatus);
    });

    it('returns ExecuteStatus.ABORTED_ALREADY_CALLED when AbortReason.AlreadyCalled', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000001'
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_ALREADY_CALLED, executeStatus);
    });

    it('returns ExecuteStatus.ABORTED_BEFORE_CALL_WINDOW when AbortReason.BeforeCallWindow', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000002'
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_BEFORE_CALL_WINDOW, executeStatus);
    });

    it('returns ExecuteStatus.ABORTED_AFTER_CALL_WINDOW when AbortReason.AfterCallWindow', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000003'
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_AFTER_CALL_WINDOW, executeStatus);
    });

    it('returns ExecuteStatus.ABORTED_RESERVED_FOR_CLAIMER when AbortReason.ReservedForClaimer', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000004'
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_RESERVED_FOR_CLAIMER, executeStatus);
    });

    it('returns ExecuteStatus.ABORTED_INSUFFICIENT_GAS when AbortReason.InsufficientGas', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000005'
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_INSUFFICIENT_GAS, executeStatus);
    });

    it('returns ExecuteStatus.ABORTED_TOO_LOW_GAS_PRICE when AbortReason.TooLowGasPrice', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000006'
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_TOO_LOW_GAS_PRICE, executeStatus);
    });

    it('returns ExecuteStatus.ABORTED_UNKNOWN when unknown reason appeared', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: '0x0000000000000000000000000000000000000000000000000000000000000008'
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_UNKNOWN, executeStatus);
    });

    // tslint:disable-next-line:no-identical-functions
    it('returns ExecuteStatus.ABORTED_UNKNOWN when no data found', () => {
      const receipt = {
        logs: [
          {
            topics: [ABORTED_EVENT],
            data: ''
          }
        ]
      };

      const executeStatus = getAbortedExecuteStatus(receipt);

      assert.equal(ExecuteStatus.ABORTED_UNKNOWN, executeStatus);
    });
  });
});
