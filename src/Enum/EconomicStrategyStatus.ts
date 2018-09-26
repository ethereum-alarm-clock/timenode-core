export enum EconomicStrategyStatus {
  NOT_PROFITABLE = 'Transaction not profitable.',
  INSUFFICIENT_BALANCE = 'Not enough balance to claim.',
  CLAIM = 'Transaction can be claimed.',
  DEPOSIT_TOO_HIGH = 'The transaction deposit is too high.',
  WINDOW_TOO_SHORT = 'Execution window is too short'
}
