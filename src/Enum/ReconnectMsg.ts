export enum ReconnectMsg {
  NULL = '',
  ALREADY_RECONNECTED = 'Recent reconnection. Not attempting for a few seconds.',
  RECONNECTED = 'Reconnected!',
  MAX_ATTEMPTS = 'Max attempts reached. Stopped TimeNode.',
  RECONNECTING = 'Reconnecting in progress.',
  FAIL = 'Reconnection failed! Trying again...'
}
