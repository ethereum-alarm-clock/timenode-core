export enum Status {
  NOT_ENOUGH_FUNDS = "Account doesn't have enough funds to send transaction.",
  WALLET_BUSY = 'Sending transaction is already in progress. Please wait for account to complete tx.',
  IN_PROGRESS = 'Transaction in progress',
  UNKNOWN_ERROR = 'An error happened',
  OK = 'OK',
  FAILED = 'Failed',
  PENDING = 'Pending',
  NOT_ENABLED = 'Claiming disabled',
  ACCOUNT_BUSY = 'Account is busy',
  SUCCESS = 'Success'
}
