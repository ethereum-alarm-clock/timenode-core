/**
 * Uses the Parity specific RPC request `parity_pendingTransactions` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionRequest} txRequest
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const hasPendingParity = async (conf, txRequest) => {
  // / Only available if using parity locally.
  const pApi = require("@parity/api")
  const provider = new pApi.Provider.Http(`${conf.provider}`)
  const api = new pApi(provider)

  const transactions = await api.parity.pendingTransactions()
  const recips = transactions.map(tx => tx.to)
  if (recips.indexOf(txRequest.address) !== -1) return true
  return false
}

/**
 * Uses the Geth specific RPC request `txpool_content` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionRequest} txRequest
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const hasPendingGeth = (conf, txRequest) => {
  // / Only available if using Geth locally.
  const Web3 = require("web3")
  const provider = new Web3.providers.HttpProvider(`${conf.provider}`)

  return new Promise((resolve, reject) => {
    provider.send(
      {
        jsonrpc: "2.0",
        method: "txpool_content",
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
  if (conf.client == "parity") {
    return hasPendingParity(conf, txRequest)
  } else if (conf.client == "geth") {
    return hasPendingGeth(conf, txRequest)
  }
}

module.exports = hasPending
