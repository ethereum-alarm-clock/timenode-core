const fs = require("fs")
const { keystore, signing } = require('eth-lightwallet')
const Transaction = require("ethereumjs-tx")
const Promise = require('bluebird')

// Wrapper class over the essiential functionality of the light wallet
// provided in web3 library. Uses its own instance of web3 to stay
// sanitary.
class LightWallet {
  constructor(web3) {
    this.web3 = web3
    this.wallet = null
    this.nonce = 0
    this.password = null
  }

  async create(password, nAccounts) {
    const seedPhrase = keystore.generateRandomSeed()
    const hdPathString = "m/0'/0'/0'"

    await this.createVault(password, seedPhrase, hdPathString, nAccounts)
  }

  async createVault(password, seedPhrase, hdPathString, nAccounts, salt = null) {
    const wallet = await Promise.promisify(keystore.createVault)({
      password,
      seedPhrase,
      hdPathString,
      salt
    })

    const keyFromPassword = Promise.promisify(wallet.keyFromPassword, { context: wallet })
    const key = await keyFromPassword(password)
    wallet.generateNewAddress(key, nAccounts)

    this.wallet = wallet
    this.password = password
  }

  async encryptAndStore(file) {
    if (!this.wallet) {
      return
    }

    fs.open(file, "wx", async (err, fd) => {
      if (err) {
        if (err.code === "EEXIST") {
          console.error(`${file} already exists, will not overwrite`)
          return
        }
        throw err
      }

      fs.writeFileSync(file, JSON.stringify(this.wallet))
    })
  }

  async getPrivateDerivedKey(password, salt) {
    const deriveKeyFromPasswordAndSalt = Promise.promisify(keystore.deriveKeyFromPasswordAndSalt)
    return deriveKeyFromPasswordAndSalt(password, salt)
  }

  async decryptAndLoad(file, password) {
    if (this.wallet) {
      console.log("Wallet is already loaded! Returning without loading new wallet...")
      return
    }

    const encryptedWalletFile = fs.readFileSync(file, 'utf-8')
    const encryptedWallet = JSON.parse(encryptedWalletFile)

    const key = await this.getPrivateDerivedKey(password, encryptedWallet.salt)
    const paddedSeed = keystore._decryptString(encryptedWallet.encSeed, key)
    const seed = paddedSeed.trim()
    
    await this.createVault(password, seed, encryptedWallet.hdPathString, encryptedWallet.hdIndex, encryptedWallet.salt)
  }    

  // Cycles through accounts and sends the transaction from next up.
  async sendFromNext(recip, val, gasLimit, gasPrice, data) {
    const next = this.nonce++ % this.getAccounts().length
    return this.sendFromIndex(next, recip, val, gasLimit, gasPrice, data)
  }

  // Return a txHash
  async sendFromIndex(index, to, value, gasLimit, gasPrice, data) {
    if (index > this.wallet.length) {
      console.log("Index is outside of range of addresses in this wallet!")
      return
    }

    const sendRawTransaction = Promise.promisify(this.web3.eth.sendRawTransaction)
    const from = this.getAccounts()[index]
    const txCount = this.web3.eth.getTransactionCount(from)

    const txParameters = {
      nonce: txCount,
      from,
      to,
      gasPrice: this.web3.toHex(gasPrice),
      gasLimit: this.web3.toHex(gasLimit),
      value: this.web3.toHex(value),
      data
    }

    const tx = new Transaction(txParameters)
    const privateDerivedKey = await this.getPrivateDerivedKey(this.password, this.wallet.salt)
    const privateKey = this.wallet.exportPrivateKey(from, privateDerivedKey)
   
    tx.sign(new Buffer(privateKey, 'hex'))

    return sendRawTransaction('0x' + tx.serialize().toString('hex'))
  }

  getAccounts() {
    return this.wallet.getAddresses()
  }
}

module.exports = LightWallet
