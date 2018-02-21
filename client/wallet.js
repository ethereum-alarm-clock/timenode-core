const ethTx = require('ethereumjs-tx')
const ethWallet = require('ethereumjs-wallet')

class Wallet {
    constructor(web3) {
        this.web3 = web3
        this.length = 0
        this.nonce = 0
        this.password = null
    }

    _findSafeIndex(pointer) {
        pointer = pointer || 0
        if(this.hasOwnProperty(pointer)) {
            return this._findSafeIndex(pointer + 1)
        } else {
            return pointer
        }
    }

    _currentIndexes() {
        const keys = Object.keys(this)
        const indexes = keys.map(parseInt).filter(n => n < 9e20)
        return indexes
    }

    create(numAccounts) {
        for (let i = 0; i < numAccounts; i++) {
            const wallet = ethWallet.generate()
            this.add(wallet)
        }
        return this
    }

    add(wallet) {
        if (!this[wallet.getAddressString()]) {
            const idx = this._findSafeIndex()
            wallet.index = idx

            this[idx] = wallet
            this[walletv3.getAddressString()] = wallet
            this[walletv3.getAddressString().toLowerCase()] = wallet
            this.length++
            return wallet
        } else {
            return this[wallet.getAddressString()]
        }
    }

    rm(addressOrIndex) {
        const wallet = this[addressOrIndex]

        if (wallet && wallet.getAddressString()) {
            delete this[wallet.getAddressString()]
            delete this[wallet.getAddressString().toLowerCase()]
            delete this[wallet.index]
            this.length--
            return true
        } else {
            return false
        }
    }

    clear() {
        const _this = this
        const indexes = this._currentIndexes()

        indexes.forEach((idx) => {
            _this.rm(idx)
        })
        
        return this
    }

    encrypt(password, opts) {
        const _this = this 
        const indexes = this._currentIndexes()

        const wallets = indexes.map((idx) => {
            return _this[idx].toV3(password, opts)
        })

        return wallets
    }

    decrypt(encryptedKeystores, password) {
        const _this = this

        encryptedKeystores.forEach((keystore) => {
            const wallet = ethWallet.fromV3(keystore, password)

            if (wallet) {
                _this.add(wallet)
            } else {
                throw new Error('Couldn\'t decrypt keystore. Wrong password?')
            }
        })
    }

    /**
     * sendFromNext will send a transaction from the account in this wallet that is next according to this.nonce
     * @param {TransactionParams} opts {to, value, gas, gasPrice, data}
     * @returns {Promise<string>} A promise which will resolve to the transaction hash
     */
    sendFromNext(opts) {
        const next = this.nonce++ % this.length
        return this.sendFromIndex(next, opts)
    }

    /**
     * sendFromIndex will send a transaction from the account index specified
     * @param {number} idx The index of the account to send a transaction from.
     * @param {TransactionParams} opts {to, value, gas, gasPrice, data}
     * @returns {Promise<string>} A promise which will resolve to the transaction hash
     */
    sendFromIndex(idx, opts) {
        const _this = this

        if (idx > this.length) {
            throw new Error('Index is outside range of addresses.')
        }

        const from = this.getAccounts()[idx]
        const getNonce = (account) => new Promise(resolve => {
            this.web3.eth.getTransactionCount(account, (err,res) => {
                resolve(res)
            })
        })
        return new Promise((resolve, reject) => {
            getNonce(from).then((txCount) => {
                const txParams = {
                    nonce: txCount,
                    from,
                    to: opts.to,
                    gas: this.web3.toHex(opts.gas),
                    gasPrice: this.web3.toHex(opts.gasPrice),
                    value: this.web3.toHex(opts.value),
                    data: opts.data
                }

                const tx = new ethTx(txParams)
                const privKey = _this[from].privKey
                tx.sign(new Buffer(privKey, 'hex'))
                this.web3.eth.sendRawTransaction('0x'.concat(tx.serialize().toString('hex')), (err,res) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(res)
                    }
                })
            })
        })
    }

    getAccounts() {
        return this._currentIndexes().map(idx => this[idx])
    }
}