import { TxSendStatus } from '../Enum/TxSendStatus';
import { ITransactionReceipt } from '../Types/ITransactionReceipt';

export interface IWalletReceipt {
  receipt?: ITransactionReceipt;
  from: string;
  status: TxSendStatus;
}
