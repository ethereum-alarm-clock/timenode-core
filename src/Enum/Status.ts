export enum Status {
  NOT_ENOUGH_FUNDS = "Account doesn't have enough funds to send transaction.",
  WALLET_BUSY = 'Sending transaction is already in progress. Please wait for account to complete tx.',
  IN_PROGRESS = 'Transaction in progress',
  UNKNOWN_ERROR = 'An error happened',
  OK = 'OK',
  CLAIM_FAILED = 'Claiming: Transaction already claimed',
  EXECUTE_FAILED = 'Execution: Unable to send the execute action',
  TX_FAILED = 'FAILED',
  CLAIM_PENDING = 'Claiming: Skipped - Other claiming found',
  EXECUTE_PENDING = 'Execution: Skipped - Other execution found',
  NOT_ENABLED = 'Claiming: Skipped - Claiming disabled',
  ACCOUNT_BUSY = 'Claiming: Skipped - Account is busy',
  SUCCESS = 'Success'
}
