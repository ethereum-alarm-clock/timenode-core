export enum TxSendStatus {
  NOT_ENOUGH_FUNDS = "Account doesn't have enough funds to send transaction.",
  UNKNOWN_ERROR = 'An error happened',
  OK = 'OK',
  claim = 'Claiming',
  execute = 'Execution',
  default = 'Default',
  SUCCESS = 'SUCCESS',

  BUSY = 'Sending transaction is already in progress. Please wait for account to complete tx.',
  PROGRESS = 'Transaction in progress',
  MINED_IN_UNCLE = 'Transaction mined in uncle block',
  FAIL = 'FAILED',
  PENDING = 'PENDING',

  TYPE_VARIABLE = 'Unknown message or context',
  NOT_ENABLED = 'Claiming: Skipped - Claiming disabled',
  ABORTED_WAS_CANCELLED = 'Execution: Aborted with reason WasCancelled',
  ABORTED_ALREADY_CALLED = 'Execution: Aborted with reason AlreadyCalled',
  ABORTED_BEFORE_CALL_WINDOW = 'Execution: Aborted with reason BeforeCallWindow',
  ABORTED_AFTER_CALL_WINDOW = 'Execution: Aborted with reason AfterCallWindow',
  ABORTED_RESERVED_FOR_CLAIMER = 'Execution: Aborted with reason ReservedForClaimer',
  ABORTED_INSUFFICIENT_GAS = 'Execution: Aborted with reason InsufficientGas',
  ABORTED_TOO_LOW_GAS_PRICE = 'Execution: Aborted with reason TooLowGasPrice',
  ABORTED_UNKNOWN = 'Execution: Aborted with reason UNKNOWN'
}

// tslint:disable-next-line:no-namespace
export namespace TxSendStatus {
  export function STATUS(msg: TxSendStatus, context: TxSendStatus.claim | TxSendStatus.execute) {
    switch (msg) {
      case TxSendStatus.SUCCESS:
        this.TYPE_VARIABLE = `${context}: Success`;
        break;
      case TxSendStatus.BUSY:
        this.TYPE_VARIABLE = `${context}: Skipped - Account is busy`;
        break;
      case TxSendStatus.PROGRESS:
        this.TYPE_VARIABLE = `${context}: Skipped - In progress`;
        break;
      case TxSendStatus.PENDING:
        this.TYPE_VARIABLE = TxSendStatus.claim
          ? 'Claiming: Skipped - Other claiming found'
          : 'Execution: Skipped - Other execution found';
        break;
      case TxSendStatus.FAIL:
        this.TYPE_VARIABLE = TxSendStatus.claim
          ? 'Claiming: Transaction already claimed'
          : 'Execution: Unable to send the execute action';
        break;
      case TxSendStatus.MINED_IN_UNCLE:
        this.TYPE_VARIABLE = `${context}: Transaction mined in uncle block`;
        break;
    }

    return this.TYPE_VARIABLE;
  }
}
