import ethTx = require('ethereumjs-tx');
import ethWallet = require('ethereumjs-wallet');

declare const Buffer;
declare const setTimeout;

export default class Wallet {
  length: number;
  nonce: number;
  web3: any;

  constructor(web3: any) {
    this.length = 0;
    this.nonce = 0;
    this.web3 = web3;
  }

  _findSafeIndex(pointer = 0) {
    pointer = pointer;
    if (this.hasOwnProperty(pointer)) {
      return this._findSafeIndex(pointer + 1);
    } else {
      return pointer;
    }
  }

  _currentIndexes() {
    const keys = Object.keys(this);
    const indexes = keys
      .map((key) => parseInt(key, 10))
      .filter((n) => n < 9e20)
      .slice(0, this.length);
    return indexes;
  }

  create(numAccounts) {
    for (let i = 0; i < numAccounts; i++) {
      const wallet = ethWallet.generate();
      this.add(wallet);
    }
    return this;
  }

  add(wallet) {
    if (!this[wallet.getAddressString()]) {
      const idx = this._findSafeIndex();
      wallet.index = idx;

      this[idx] = wallet;
      this[wallet.getAddressString()] = wallet;
      this[wallet.getAddressString().toLowerCase()] = wallet;
      this.length++;
      return wallet;
    } else {
      return this[wallet.getAddressString()];
    }
  }

  rm(addressOrIndex) {
    const wallet = this[addressOrIndex];

    if (wallet && wallet.getAddressString()) {
      delete this[wallet.getAddressString()];
      delete this[wallet.getAddressString().toLowerCase()];
      delete this[wallet.index];
      this.length--;
      return true;
    } else {
      return false;
    }
  }

  clear() {
    const _this = this;
    const indexes = this._currentIndexes();

    indexes.forEach((idx) => {
      _this.rm(idx);
    });

    return this;
  }

  encrypt(password, opts) {
    const _this = this;
    const indexes = this._currentIndexes();

    const wallets = indexes.map((idx) => {
      return _this[idx].toV3(password, opts);
    });

    return wallets;
  }

  decrypt(encryptedKeystores, password) {
    const _this = this;

    encryptedKeystores.forEach((keystore) => {
      keystore = Buffer.from(keystore, 'hex');
      const wallet = ethWallet.fromPrivateKey(keystore, password, true);

      if (wallet) {
        _this.add(wallet);
      } else {
        throw new Error("Couldn't decrypt keystore. Wrong password?");
      }
    });
  }

  /**
   * sendFromNext will send a transaction from the account in this wallet that is next according to this.nonce
   * @param {TransactionParams} opts {to, value, gas, gasPrice, data}
   * @returns {Promise<string>} A promise which will resolve to the transaction hash
   */
  sendFromNext(opts) {
    console.log('sendFromNext', opts);
    const next = ++this.nonce % this.length;
    return this.sendFromIndex(next, opts);
  }

  getNonce(account) {
    return new Promise<string>((resolve) => {
      this.web3.eth.getTransactionCount(account, (err, res) => {
        resolve(res);
      });
    });
  }

  sendRawTransaction(tx) {
    return new Promise((resolve, reject) => {
      this.web3.eth.sendRawTransaction(
        '0x'.concat(tx.serialize().toString('hex')),
        (err, res) => {
          if (err) reject(err);
          resolve(res);
        }
      );
    });
  }

  async getTransactionReceipt(hash, from) {
    var transactionReceiptAsync;
    const _this = this;
    transactionReceiptAsync = async function(hash, resolve, reject) {
      try {
        const getTransactionReceipt = (hash) => {
          return new Promise((resolve) => {
            _this.web3.eth.getTransactionReceipt(hash, (err, res) => {
              if (!err) resolve(res);
            });
          });
        };
        var receipt = await getTransactionReceipt(hash);
        if (receipt == null) {
          setTimeout(function() {
            transactionReceiptAsync(hash, resolve, reject);
          }, 500);
        } else {
          resolve({ receipt, from });
        }
      } catch (e) {
        reject(e);
      }
    };
    return new Promise(async (resolve, reject) => {
      await transactionReceiptAsync(hash, resolve, reject);
    });
  }

  signTransaction(from, nonce, opts) {
    return new Promise((resolve) => {
      const params = {
        nonce,
        from,
        to: opts.to,
        gas: this.web3.toHex(opts.gas),
        gasPrice: this.web3.toHex(opts.gasPrice),
        value: this.web3.toHex(opts.value),
        data: opts.data,
      };

      const tx = new ethTx(params);
      const privKey = this[from].privKey;
      tx.sign(Buffer.from(privKey, 'hex'));

      resolve(tx);
    });
  }

  /**
   * sendFromIndex will send a transaction from the account index specified
   * @param {number} idx The index of the account to send a transaction from.
   * @param {TransactionParams} opts {to, value, gas, gasPrice, data}
   * @returns {Promise<string>} A promise which will resolve to the transaction hash
   */
  async sendFromIndex(idx, opts) {
    console.log('sendFromIndex', idx, opts);
    if (idx >= this.length) {
      throw new Error('Index is outside range of addresses.');
    }


    const from = this.getAccounts()[idx].getAddressString();

    const nonce = await this.getNonce(from);

    // console.log('sfi nonce', {
    //   nonce
    // });

    const signedTx = await this.signTransaction(from, nonce, opts);
    const hash = await this.sendRawTransaction(signedTx);

    const receipt = await this.getTransactionReceipt(hash, from);

    console.log('TX?RECEIPT', receipt);

    return receipt;
  }

  getAccounts() {
    return this._currentIndexes().map((idx) => this[idx]);
  }

  getAddresses() {
    return this.getAccounts().map((account) => account.getAddressString());
  }

  isKnownAddress(address) {
    return this.getAccounts().some(
      (account) => account.getAddressString() === address
    );
  }
}
