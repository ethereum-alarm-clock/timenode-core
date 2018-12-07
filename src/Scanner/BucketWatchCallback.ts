import { ITransactionRequestRaw } from '@ethereum-alarm-clock/lib';

export type BucketWatchCallback = (request: ITransactionRequestRaw) => void;
