export enum ExecuteStatus {
  PENDING = 'Execution: Skipped - Other execution found',
  WALLET_BUSY = 'Execution: Skipped - Wallet is busy',
  IN_PROGRESS = 'Execution: Skipped - In progress',
  FAILED = 'Execution: Unable to send the execute action',
  SUCCESS = 'Execution: Success'
}
