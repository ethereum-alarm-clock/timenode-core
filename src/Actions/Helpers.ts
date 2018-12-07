import { AbortReason, TxSendStatus } from '../Enum';
import { TransactionReceipt } from 'web3/types';

const EXECUTED_EVENT = '0x3e504bb8b225ad41f613b0c3c4205cdd752d1615b4d77cd1773417282fcfb5d9';
const ABORTED_EVENT = '0xc008bc849b42227c61d5063a1313ce509a6e99211bfd59e827e417be6c65c81b';
const CLAIMED_EVENT = '0xbcb472984264b16baa8cde752f2af002ea8ce06f35d81caee36625234edd2a46';

const abortReasonToExecuteStatus = new Map<AbortReason, TxSendStatus>([
  [AbortReason.WasCancelled, TxSendStatus.ABORTED_WAS_CANCELLED],
  [AbortReason.AlreadyCalled, TxSendStatus.ABORTED_ALREADY_CALLED],
  [AbortReason.BeforeCallWindow, TxSendStatus.ABORTED_BEFORE_CALL_WINDOW],
  [AbortReason.AfterCallWindow, TxSendStatus.ABORTED_AFTER_CALL_WINDOW],
  [AbortReason.ReservedForClaimer, TxSendStatus.ABORTED_RESERVED_FOR_CLAIMER],
  [AbortReason.InsufficientGas, TxSendStatus.ABORTED_INSUFFICIENT_GAS],
  [AbortReason.TooLowGasPrice, TxSendStatus.ABORTED_TOO_LOW_GAS_PRICE],
  [AbortReason.Unknown, TxSendStatus.ABORTED_UNKNOWN]
]);

function isExecuted(receipt: TransactionReceipt) : boolean {
  return Boolean(receipt) && receipt.logs[0].topics.indexOf(EXECUTED_EVENT) > -1;
}

function isAborted(receipt: TransactionReceipt) : boolean {
  return Boolean(receipt) && receipt.logs[0].topics.indexOf(ABORTED_EVENT) > -1;
}

const getAbortedExecuteStatus = (receipt: TransactionReceipt) => {
  const reason = parseInt(receipt.logs[0].data, 16);
  const abortReason = receipt && !isNaN(reason) ? (reason as AbortReason) : AbortReason.Unknown;

  return abortReasonToExecuteStatus.get(abortReason) || TxSendStatus.ABORTED_UNKNOWN;
};

const isTransactionStatusSuccessful = (status: string | number | boolean) => {
  return [true, 1, '0x1', '0x01'].indexOf(status) !== -1;
};

export {
  isExecuted,
  isAborted,
  getAbortedExecuteStatus,
  isTransactionStatusSuccessful,
  EXECUTED_EVENT,
  ABORTED_EVENT,
  CLAIMED_EVENT
};
