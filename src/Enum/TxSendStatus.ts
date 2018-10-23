export enum TxSendStatus {
  NOT_ENOUGH_FUNDS = "Account doesn't have enough funds to send transaction.",
  WALLET_BUSY = 'Sending transaction is already in progress. Please wait for account to complete tx.',
  IN_PROGRESS = 'Transaction in progress',
  UNKNOWN_ERROR = 'An error happened',
  OK = 'OK',
  MINED_IN_UNCLE = 'Transaction minded in uncle block',
  claim = 'Claiming',
  execute = 'Execution',
  FAILED = 'FAILED',
  TYPE_VARIABLE = 'Unknown context',
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
  export function STATUS(context: TxSendStatus, msg: string) {
    switch (msg) {
      case 'SUCCESS':
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Success';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Success';
            break;
        }
        break;
      case 'BUSY':
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Skipped - Account is busy';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Skipped - Wallet is busy';
            break;
        }
        break;
      case 'PROGRESS':
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Skipped - In progress';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Skipped - In progress';
            break;
        }
        break;
      case 'PENDING':
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Skipped - Other claiming found';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Skipped - Other execution found';
            break;
        }
        break;
      case 'FAIL':
        switch (context) {
          case TxSendStatus.claim:
            this.TYPE_VARIABLE = 'Claiming: Transaction already claimed';
            break;
          case TxSendStatus.execute:
            this.TYPE_VARIABLE = 'Execution: Unable to send the execute action';
            break;
        }
        break;
      case 'MINED':
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
