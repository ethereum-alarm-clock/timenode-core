enum ClaimStatus {
  NOT_ENABLED = 'Claiming: Skipped - Claiming disabled',
  PENDING = 'Claiming: Skipped - Other claiming found',
  ACCOUNT_BUSY = 'Claiming: Skipped - Account is busy',
  FAILED = 'Claiming: Transaction already claimed',
  IN_PROGRESS = 'Claiming: Skipped - In progress',
  SUCCESS = 'Claiming: Success',
  MINED_IN_UNCLE = 'Claiming: Transaction mined in uncle block'
}
enum TxSendErrors {
  NOT_ENOUGH_FUNDS = "Account doesn't have enough funds to send transaction.",
  WALLET_BUSY = 'Sending transaction is already in progress. Please wait for account to complete tx.',
  IN_PROGRESS = 'Transaction in progress',
  UNKNOWN_ERROR = 'An error happened',
  OK = 'OK',
  FAILED = 'FAILED',
  MINED_IN_UNCLE = 'Transaction minded in uncle block'
}
enum ExecuteStatus {
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
  ABORTED_UNKNOWN = 'Execution: Aborted with reason UNKNOWN',
  MINED_IN_UNCLE = 'Execution: Transaction mined in uncle block'
}
export { ExecuteStatus, TxSendErrors, ClaimStatus };
