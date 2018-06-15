
  if (conf.client === 'geth') {
    return hasPendingGeth(conf, txRequest, opts);
  }
};

export default hasPending;

const hasPendingParity = async (
  conf: any,
  txRequest: any,
  opts: { type?: string; checkGasPrice?: boolean; exactPrice?: any }
) => {
  opts.checkGasPrice =
    opts.checkGasPrice === undefined ? true : opts.checkGasPrice;
  const provider = conf.web3.currentProvider;
        for (const count of Object.keys(res.result)) {
          if (res.result[count].to === txRequest.address) {
            const withValidGasPrice =
              res.result[count] &&
              (!opts.checkGasPrice ||
                (await hasValidGasPrice(
                  conf.web3,
                  res.result[count],
                  opts.exactPrice
                )));
            if (
              res.result[count] &&
              isOfType(res.result[count], opts.type) &&
              withValidGasPrice
            ) {
              resolve(true);
const hasPendingGeth = (
  conf: any,
  txRequest: any,
  opts: { type?: string; checkGasPrice?: boolean; exactPrice?: any }
) => {
  opts.checkGasPrice =
    opts.checkGasPrice === undefined ? true : opts.checkGasPrice;
  const provider = conf.web3.currentProvider;
const _hasPendingGeth = (conf: any, txRequest: any, opts: { type: any, checkGasPrice?: boolean }) => {
  opts.checkGasPrice = opts.checkGasPrice === undefined ? true : opts.checkGasPrice;
  const provider = conf.web3.currentProvider
      async (err: Error, res: any) => {
        if (err) {
          reject(err);
        }

        for (const account of Object.keys(res.result.pending)) {
              const withValidGasPrice =
                res.result.pending[account][nonce] &&
                (!opts.checkGasPrice ||
                  (await hasValidGasPrice(
                    conf.web3,
                    res.result.pending[account][nonce],
                    opts.exactPrice
                  )));
              if (
                res.result.pending[account][nonce] &&
                isOfType(res.result.pending[account][nonce], opts.type) &&
                withValidGasPrice
              ) {
                resolve(true);
              }
const hasValidGasPrice = async (
  web3: any,
  transaction: any,
  exactPrice?: any
) => {
  if (exactPrice) {
    return exactPrice.valueOf() === transaction.gasPrice.valueOf();
  }
  const spread = 0.3;
  let currentGasPrice: number;
  await new Promise((resolve, reject) => {
    web3.eth.getGasPrice((err: Error, res: any) => {
      if (err) {
        reject(err);
      }
  if (conf.client === 'geth') {
    return hasPendingGeth(conf, txRequest, opts);
  }
};

export default hasPending;
