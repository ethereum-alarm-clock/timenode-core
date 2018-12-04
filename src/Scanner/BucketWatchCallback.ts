import { ITransactionRequestRaw } from '@ethereum-alarm-clock/lib/built/transactionRequest/ITransactionRequest';

export type BucketWatchCallback = (request: ITransactionRequestRaw) => void;
