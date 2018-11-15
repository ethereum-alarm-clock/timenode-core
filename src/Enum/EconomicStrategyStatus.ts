export enum EconomicStrategyStatus {
  NOT_PROFITABLE = 'Transaction not profitable.',
  INSUFFICIENT_BALANCE = 'Not enough balance to claim.',
  CLAIM = 'Transaction can be claimed.',
  DEPOSIT_TOO_HIGH = 'The transaction deposit is too high.',
  TOO_SHORT_CLAIM_WINDOW = 'Claim window is too short',
  TOO_SHORT_RESERVED = 'Reserved window is too short'
}
