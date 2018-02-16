const BigNumber = require('bignumber.js')
const LightWallet = require('../client/lightWallet.js')
const { Util } = require('eac.js-lib')()

// @returns Promise<[txObjs]>
const drainWallet = async (web3, gasPrice, target, file, password) => {
    const wallet = new LightWallet(web3)
    await wallet.decryptAndLoad(file, password)

    const gas = '21000'
    const gasCost = new BigNumber(gas).times(gasPrice)

    return Promise.all(
        wallet.getAccounts().map(account => {
            return new Promise((resolve, reject) => {
                Util.getBalance(web3, account)
                .then(bal => {
                    bal = new BigNumber(bal)
                    const amt = bal.minus(gasCost)
                    wallet.sendFromIndex(
                        wallet.getAccounts().indexOf(account),
                        target,
                        amt.toString(),
                        gas,
                        gasPrice,
                        ""
                    )
                    .then(txHash => {
                        Util.waitForTransactionToBeMined(web3, txHash)
                        .then(resolve) // with the receipt
                        .catch(reject)
                    })
                    .catch(reject)
                })
            })
        })
    )
}

module.exports = drainWallet