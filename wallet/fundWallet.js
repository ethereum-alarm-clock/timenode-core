const LightWallet = require('../client/lightWallet.js')
const { Util } = require('eac.js-lib')()

// TODO before mainnet - change the default gas / gasPrice
// to dynamically calculated values
const fund = (web3, recip, value) => {
    return new Promise((resolve, reject) => {
        web3.eth.sendTransaction({
            from: web3.eth.defaultAccount,
            to: recip,
            value: value,
            gas: 3000000,
            gasPrice: web3.toWei('100', 'gwei')
        },
        (err, txHash) => {
            if (err) reject(err)
            else {
                Util.waitForTransactionToBeMined(web3, txHash)
                .then(receipt => resolve(receipt))
                .catch(reject)
            }
        })
    })
}

const fundAccounts = async (web3, etherAmount, file, password) => {
    const wallet = new LightWallet(web3)
    await wallet.decryptAndLoad(file, password)

    const amt = web3.toWei(etherAmount, 'ether')

    return Promise.all(wallet.getAccounts().map(account => {
        return fund(web3, account, amt)
    }))
}

module.exports = fundAccounts