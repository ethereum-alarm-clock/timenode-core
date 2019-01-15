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
  export function STATUS(msg: TxSendStatus, context: TxSendStatus) {
    switch (msg) {
      case TxSendStatus.SUCCESS:
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Success';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Success';
            break;
        }
        break;
      case TxSendStatus.BUSY:
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Skipped - Account is busy';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Skipped - Wallet is busy';
            break;
        }
        break;
      case TxSendStatus.PROGRESS:
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Skipped - In progress';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Skipped - In progress';
            break;
        }
        break;
      case TxSendStatus.PENDING:
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Skipped - Other claiming found';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Skipped - Other execution found';
            break;
        }
        break;
      case TxSendStatus.FAIL:
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Transaction already claimed';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Unable to send the execute action';
            break;
        }
        break;
      case TxSendStatus.MINED_IN_UNCLE:
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Transaction mined in uncle block';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Transaction mined in uncle block';
            break;
        }
    }

    return this.TYPE_VARIABLE;
  }
}
