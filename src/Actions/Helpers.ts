const EXECUTED_EVENT = '0x3e504bb8b225ad41f613b0c3c4205cdd752d1615b4d77cd1773417282fcfb5d9';

const isExecuted = (receipt: any) => {
  if (receipt) {
    return receipt.logs[0].topics.indexOf(EXECUTED_EVENT) > -1;
  }

  return false;
};

const isTransactionStatusSuccessful = (status: string | number) => {
  if (status) {
    return [1, '0x1', '0x01'].indexOf(status) !== -1;
  }
  return false;
};

export { isExecuted, isTransactionStatusSuccessful, EXECUTED_EVENT };
