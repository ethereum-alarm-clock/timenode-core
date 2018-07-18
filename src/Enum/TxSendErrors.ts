export enum TxSendErrors {
  NOT_ENOUGH_FUNDS = "Account doesn't have enough funds to send transaction.",
  SENDING_IN_PROGRESS = 'Sending transaction is already in progress. Please wait for account to complete tx.',
  UNKNOWN_ERROR = 'An error happened'
}
