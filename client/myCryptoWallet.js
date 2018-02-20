const ethereumjsWallet = require('ethereumjs-wallet')
const ethTx = require('ethereumjs-tx')

class MyCryptoWallet {
    constructor(web3, json, password) {
        this.web3 = web3 
        this.wallet = ethereumJsWallet.fromV3(json, password, true)
        this.address = this.wallet.getAddresString()
        this.nonce = 0
    }

    async sendFromNext(recipient, value, gasLimit, gasPrice, data) {
        const next = this.nonce++ % this.getAccounts().length
        return this.sendFromIndex(next, recipient, value, gasLimit, gasPrice, data)
    }

    async sendFromIndex(idx, recipient, value, gasLimit, gasPrice, data) {
        if (idx > this.getAccounts().length) {
            console.log("Index is outside of range of addresses in this wallet!")
            return
        }

        const sendRawTransaction = Promise.promisify(this.web3.eth.sendRawTransaction)
        const from = this.getAccounts()[idx]
        const txCount = this.webb3.eth.getTransactionCount(from)

        const txParams = {
            nonce: txCount,
            from,
            to: recipient,
            gasPrice: this.web3.toHex(gasPrice),
            gasLimit: this.web3.toHex(gasLimit),
            value: this.web3.toHex(value),
            data
        }

        const tx = new ethTx(txParams)
        const privateKey = this.wallet.getPrivateKeyString()

        tx.sign(new Buffer(privateKey, 'hex'))
        return sendRawTransaction('0x'.concat(tx.serialize().toString('hex')))
    }


    getAccounts() {
        return [this.address]
    }

}