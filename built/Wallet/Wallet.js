"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var ethereumjs_tx_1 = require("ethereumjs-tx");
var ethereumjs_wallet_1 = require("ethereumjs-wallet");
var Wallet = /** @class */ (function () {
    function Wallet(web3) {
        this.length = 0;
        this.nonce = 0;
        this.web3 = web3;
    }
    Wallet.prototype._findSafeIndex = function (pointer) {
        if (pointer === void 0) { pointer = 0; }
        pointer = pointer;
        if (this.hasOwnProperty(pointer)) {
            return this._findSafeIndex(pointer + 1);
        }
        else {
            return pointer;
        }
    };
    Wallet.prototype._currentIndexes = function () {
        var keys = Object.keys(this);
        var indexes = keys
            .map(function (key) { return parseInt(key, 10); })
            .filter(function (n) { return n < 9e20; })
            .slice(0, this.length);
        return indexes;
    };
    Wallet.prototype.create = function (numAccounts) {
        for (var i = 0; i < numAccounts; i++) {
            var wallet = ethereumjs_wallet_1.default.generate();
            this.add(wallet);
        }
        return this;
    };
    Wallet.prototype.add = function (wallet) {
        if (!this[wallet.getAddressString()]) {
            var idx = this._findSafeIndex();
            wallet.index = idx;
            this[idx] = wallet;
            this[wallet.getAddressString()] = wallet;
            this[wallet.getAddressString().toLowerCase()] = wallet;
            this.length++;
            return wallet;
        }
        else {
            return this[wallet.getAddressString()];
        }
    };
    Wallet.prototype.rm = function (addressOrIndex) {
        var wallet = this[addressOrIndex];
        if (wallet && wallet.getAddressString()) {
            delete this[wallet.getAddressString()];
            delete this[wallet.getAddressString().toLowerCase()];
            delete this[wallet.index];
            this.length--;
            return true;
        }
        else {
            return false;
        }
    };
    Wallet.prototype.clear = function () {
        var _this = this;
        var indexes = this._currentIndexes();
        indexes.forEach(function (idx) {
            _this.rm(idx);
        });
        return this;
    };
    Wallet.prototype.encrypt = function (password, opts) {
        var _this = this;
        var indexes = this._currentIndexes();
        var wallets = indexes.map(function (idx) {
            return _this[idx].toV3(password, opts);
        });
        return wallets;
    };
    Wallet.prototype.decrypt = function (encryptedKeystores, password) {
        var _this = this;
        encryptedKeystores.forEach(function (keystore) {
            var wallet = ethereumjs_wallet_1.default.fromV3(keystore, password, true);
            if (wallet) {
                _this.add(wallet);
            }
            else {
                throw new Error("Couldn't decrypt keystore. Wrong password?");
            }
        });
    };
    /**
     * sendFromNext will send a transaction from the account in this wallet that is next according to this.nonce
     * @param {TransactionParams} opts {to, value, gas, gasPrice, data}
     * @returns {Promise<string>} A promise which will resolve to the transaction hash
     */
    Wallet.prototype.sendFromNext = function (opts) {
        var next = this.nonce++ % this.length;
        return this.sendFromIndex(next, opts);
    };
    Wallet.prototype.getNonce = function (account) {
        var _this_1 = this;
        return new Promise(function (resolve) {
            _this_1.web3.eth.getTransactionCount(account, function (err, res) {
                resolve(res);
            });
        });
    };
    Wallet.prototype.sendRawTransaction = function (tx) {
        var _this_1 = this;
        return new Promise(function (resolve, reject) {
            _this_1.web3.eth.sendRawTransaction('0x'.concat(tx.serialize().toString('hex')), function (err, res) {
                if (err)
                    reject(err);
                resolve(res);
            });
        });
    };
    Wallet.prototype.getTransactionReceipt = function (hash, from) {
        return __awaiter(this, void 0, void 0, function () {
            var transactionReceiptAsync, _this;
            var _this_1 = this;
            return __generator(this, function (_a) {
                _this = this;
                transactionReceiptAsync = function (hash, resolve, reject) {
                    return __awaiter(this, void 0, void 0, function () {
                        var getTransactionReceipt, receipt, e_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    getTransactionReceipt = function (hash) {
                                        return new Promise(function (resolve) {
                                            _this.web3.eth.getTransactionReceipt(hash, function (err, res) {
                                                if (!err)
                                                    resolve(res);
                                            });
                                        });
                                    };
                                    return [4 /*yield*/, getTransactionReceipt(hash)];
                                case 1:
                                    receipt = _a.sent();
                                    if (receipt == null) {
                                        setTimeout(function () {
                                            transactionReceiptAsync(hash, resolve, reject);
                                        }, 500);
                                    }
                                    else {
                                        resolve({ receipt: receipt, from: from });
                                    }
                                    return [3 /*break*/, 3];
                                case 2:
                                    e_1 = _a.sent();
                                    reject(e_1);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    });
                };
                return [2 /*return*/, new Promise(function (resolve, reject) { return __awaiter(_this_1, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, transactionReceiptAsync(hash, resolve, reject)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    Wallet.prototype.signTransaction = function (from, nonce, opts) {
        var _this_1 = this;
        return new Promise(function (resolve) {
            var params = {
                nonce: nonce,
                from: from,
                to: opts.to,
                gas: _this_1.web3.toHex(opts.gas),
                gasPrice: _this_1.web3.toHex(opts.gasPrice),
                value: _this_1.web3.toHex(opts.value),
                data: opts.data,
            };
            var tx = new ethereumjs_tx_1.default(params);
            var privKey = _this_1[from].privKey;
            tx.sign(new Buffer(privKey, 'hex'));
            resolve(tx);
        });
    };
    /**
     * sendFromIndex will send a transaction from the account index specified
     * @param {number} idx The index of the account to send a transaction from.
     * @param {TransactionParams} opts {to, value, gas, gasPrice, data}
     * @returns {Promise<string>} A promise which will resolve to the transaction hash
     */
    Wallet.prototype.sendFromIndex = function (idx, opts) {
        var _this_1 = this;
        if (idx > this.length) {
            throw new Error('Index is outside range of addresses.');
        }
        var from = this.getAccounts()[idx].getAddressString();
        return this.getNonce(from)
            .then(function (nonce) { return _this_1.signTransaction(from, nonce, opts); })
            .then(function (tx) { return _this_1.sendRawTransaction(tx); })
            .then(function (hash) { return _this_1.getTransactionReceipt(hash, from); });
    };
    Wallet.prototype.getAccounts = function () {
        var _this_1 = this;
        return this._currentIndexes().map(function (idx) { return _this_1[idx]; });
    };
    Wallet.prototype.getAddresses = function () {
        return this.getAccounts().map(function (account) { return account.getAddressString(); });
    };
    Wallet.prototype.isKnownAddress = function (address) {
        return this.getAccounts().some(function (account) { return account.getAddressString() === address; });
    };
    return Wallet;
}());
exports.default = Wallet;
