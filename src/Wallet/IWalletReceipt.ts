import { TxSendErrors } from '../Enum/TxSendErrors';
import { ITransactionReceipt } from '../Types/ITransactionReceipt';

export interface IWalletReceipt {
  receipt?: ITransactionReceipt;
  from: string;
  status: TxSendErrors;
}
