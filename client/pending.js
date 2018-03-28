/**
 * Uses the Parity specific RPC request `parity_pendingTransactions` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionRequest} txRequest
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const hasPendingParity = async (conf, txRequest) => {
  const provider = conf.web3.currentProvider

  return new Promise((resolve, reject) => {
    provider.sendAsync(
      {
        jsonrpc: '2.0',
        method: 'parity_pendingTransactions',
        params: [],
        id: 0o7,
      },
      (err, res) => {
        if (err) reject(err)

        const hasTx = res && res.result && !!res.result.filter(tx => tx.to === txRequest.address).length
        resolve(hasTx)
      }
    )
  })
}

/**
 * Uses the Geth specific RPC request `txpool_content` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionRequest} txRequest
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const hasPendingGeth = (conf, txRequest) => {
  const provider = conf.web3.currentProvider

  return new Promise((resolve, reject) => {
    provider.send(
      {
        jsonrpc: '2.0',
        method: 'txpool_content',
        params: [],
        id: 0o7,
      },
      (err, res) => {
        if (err) reject(err)
        for (const account in res.result.pending) {
          for (const nonce in res.result.pending[account]) {
            if (res.result.pending[account][nonce].to === txRequest.address) {
              resolve(true)
            }
          }
        }
        resolve(false)
      }
    )
  })
}

/**
 * Depening on the client, routes the correct RPC request to return whether
 * a TransactionRequest has a pending transaction in the transaction pool.
 * @param {Config} conf Config object.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 */
const hasPending = (conf, txRequest) => {
  if (conf.client == 'parity') {
    return hasPendingParity(conf, txRequest)
  } else if (conf.client == 'geth') {
    return hasPendingGeth(conf, txRequest)
  }
}

module.exports = hasPending
