import { TxSendStatus } from '../Enum/TxSendStatus';
import { TransactionReceipt } from 'web3/types';

export interface IWalletReceipt {
  receipt?: TransactionReceipt;
  from: string;
  status: TxSendStatus;
}
