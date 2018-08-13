export enum ClaimStatus {
  NOT_ENABLED = 'Claiming: Skipped - Claiming disabled',
  PENDING = 'Claiming: Skipped - Other claiming found',
  WALLET_BUSY = 'Claiming: Skipped - Wallet is busy',
  FAILED = 'Claiming: Transaction already claimed',
  IN_PROGRESS = 'Claiming: Skipped - In progress',
  SUCCESS = 'Claiming: Success'
}
