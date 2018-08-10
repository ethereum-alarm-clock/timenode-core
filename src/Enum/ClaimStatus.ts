export enum ClaimStatus {
  NOT_ENABLED = 'Claiming is not enabled.',
  PENDING = 'Another claim is already pending.',
  IN_PROGRESS = 'Claiming in progress',
  FAILED = 'Unable to send the claim.',
  SUCCESS = 'Transaction claimed successfully.'
}
