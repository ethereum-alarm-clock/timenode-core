export enum ClaimStatus {
  NOT_ENABLED = 'Claiming: Skipped - Claiming disabled',
  PENDING = 'Claiming: Skipped - Other claiming found',
  ACCOUNT_BUSY = 'Claiming: Skipped - Account is busy',
  FAILED = 'Claiming: Transaction already claimed',
  IN_PROGRESS = 'Claiming: Skipped - In progress',
  SUCCESS = 'Claiming: Success',
  MINED_IN_UNCLE = 'Claiming: Transaction mined in uncle block'
}
