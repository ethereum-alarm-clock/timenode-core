export enum ExecuteStatus {
  PENDING = 'Another execution is already pending.',
  IN_PROGRESS = 'Execution in progress',
  FAILED = 'Unable to send the execute action.',
  SUCCESS = 'Transaction executed successfully.',
  NO_ACCOUNTS = 'All accounts in use'
}
