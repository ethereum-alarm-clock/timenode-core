export enum TxSendErrors {
  NOT_ENOUGH_FUNDS = "Account doesn't have enough funds to send transaction.",
  WALLET_BUSY = 'Sending transaction is already in progress. Please wait for account to complete tx.',
  IN_PROGRESS = 'Transaction in progress',
  UNKNOWN_ERROR = 'An error happened',
  OK = 'OK',
  FAILED = 'FAILED'
}
