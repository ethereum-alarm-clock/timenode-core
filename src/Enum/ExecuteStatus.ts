export enum ExecuteStatus {
  PENDING = 'Execution: Skipped - Other execution found',
  WALLET_BUSY = 'Execution: Skipped - Wallet is busy',
  IN_PROGRESS = 'Execution: Skipped - In progress',
  FAILED = 'Execution: Unable to send the execute action',
  SUCCESS = 'Execution: Success',
  ABORTED_WAS_CANCELLED = 'Execution: Aborted with reason WasCancelled',
  ABORTED_ALREADY_CALLED = 'Execution: Aborted with reason AlreadyCalled',
  ABORTED_BEFORE_CALL_WINDOW = 'Execution: Aborted with reason BeforeCallWindow',
  ABORTED_AFTER_CALL_WINDOW = 'Execution: Aborted with reason AfterCallWindow',
  ABORTED_RESERVED_FOR_CLAIMER = 'Execution: Aborted with reason ReservedForClaimer',
  ABORTED_INSUFFICIENT_GAS = 'Execution: Aborted with reason InsufficientGas',
  ABORTED_TOO_LOW_GAS_PRICE = 'Execution: Aborted with reason TooLowGasPrice',
  ABORTED_UNKNOWN = 'Execution: Aborted with reason UNKNOWN'
}
