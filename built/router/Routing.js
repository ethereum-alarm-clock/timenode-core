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
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var BigNumber = require("bignumber.js");
var hasPending = require("../pending.js");
var Util = require('eac.js-lib')().Util;
var STATE = {
    PRE_CLAIMING: 0,
    CLAIMING: 1,
    PRE_EXECUTION: 2,
    EXECUTION: 3,
    DONE: 4,
};
var stateName = {};
stateName[STATE.DONE] = 'DONE';
stateName[STATE.PRE_CLAIMING] = 'PRE-CLAIMING';
stateName[STATE.CLAIMING] = 'CLAIMING';
stateName[STATE.PRE_EXECUTION] = 'PRE-EXECUTION';
stateName[STATE.EXECUTION] = 'EXECUTION';
// const isClaimedByUs = (conf, txRequest) => {
//   const ourClaim = conf.wallet
//     ? conf.wallet.isKnownAddress(txRequest.claimedBy)
//     : txRequest.isClaimedBy(conf.web3.eth.defaultAccount);
//   if (!ourClaim)
//     conf.logger.debug(
//       `[${txRequest.address}] In reserve window and not claimed by our account.`
//     );
//   return ourClaim;
// };
// const getSender = (conf) =>
//   conf.wallet ? conf.wallet.getAddresses()[0] : conf.web3.eth.defaultAccount;
var isProfitableToClaim = function (conf, txRequest, gasToClaim) { return __awaiter(_this, void 0, void 0, function () {
    var web3, claimPaymentModifier, paymentWhenClaimed, currentGasPrice, _a, gasCostToClaim;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                web3 = conf.web3;
                return [4 /*yield*/, txRequest.claimPaymentModifier()];
            case 1:
                claimPaymentModifier = _b.sent();
                paymentWhenClaimed = txRequest.bounty
                    .times(claimPaymentModifier)
                    .dividedToIntegerBy(100);
                _a = BigNumber.bind;
                return [4 /*yield*/, Util.getGasPrice(web3)];
            case 2:
                currentGasPrice = new (_a.apply(BigNumber, [void 0, _b.sent()]))();
                gasCostToClaim = currentGasPrice.times(gasToClaim);
                if (gasCostToClaim.greaterThan(paymentWhenClaimed)) {
                    conf.logger.debug("[" + txRequest.address + "] Not profitable to claim. gasCostToClaim: " + gasCostToClaim + " | paymentWhenClaimed: " + paymentWhenClaimed);
                    return [2 /*return*/, { profitable: false, paymentWhenClaimed: 0 }];
                }
                return [2 /*return*/, { profitable: true, paymentWhenClaimed: paymentWhenClaimed }];
        }
    });
}); };
var sendTransaction = function (conf, txRequest, fn, options) { return __awaiter(_this, void 0, void 0, function () {
    var log, web3, ops, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                log = conf.logger;
                web3 = conf.web3;
                return [4 /*yield*/, hasPending(conf, txRequest)];
            case 1:
                if (_b.sent()) {
                    log.info("[" + txRequest.address + "] Ignoring txRequest with pending transaction in the transaction pool.");
                    return [2 /*return*/, { ignore: true }];
                }
                if (conf.wallet) {
                    return [2 /*return*/, conf.wallet.sendFromNext(options)];
                }
                ops = Object.assign(options, { from: web3.eth.defaultAccount });
                _a = {};
                return [4 /*yield*/, fn(ops)];
            case 2: return [2 /*return*/, (_a.receipt = _b.sent(),
                    _a.from = web3.eth.defaultAccount,
                    _a)];
        }
    });
}); };
var claim = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    var log, web3, ignore, value, data, sender, gasToClaim, _a, profitable, paymentWhenClaimed, diceRoll, _b, gas, gasPrice, options;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                log = conf.logger;
                web3 = conf.web3;
                ignore = { ignore: true };
                value = txRequest.requiredDeposit;
                data = txRequest.claimData;
                sender = getSender(conf);
                return [4 /*yield*/, Util.estimateGas(web3, {
                        from: sender,
                        to: txRequest.address,
                        value: value.toString(),
                        data: data,
                    })];
            case 1:
                gasToClaim = _c.sent();
                return [4 /*yield*/, isProfitableToClaim(conf, txRequest, gasToClaim)];
            case 2:
                _a = _c.sent(), profitable = _a.profitable, paymentWhenClaimed = _a.paymentWhenClaimed;
                if (!profitable)
                    return [2 /*return*/, ignore];
                diceRoll = Math.floor(Math.random() * 100);
                _b = diceRoll;
                return [4 /*yield*/, txRequest.claimPaymentModifier()];
            case 3:
                if (_b >= (_c.sent())) {
                    log.debug("Fate insists you wait until later.");
                    return [2 /*return*/, ignore];
                }
                log.info("[" + txRequest.address + "] Attempting the claim | Payment: " + paymentWhenClaimed);
                gas = gasToClaim + 21000;
                return [4 /*yield*/, Util.getGasPrice(web3)];
            case 4:
                gasPrice = _c.sent();
                options = {
                    to: txRequest.address,
                    value: value,
                    gas: gas,
                    gasPrice: gasPrice,
                    data: data,
                };
                return [2 /*return*/, sendTransaction(conf, txRequest, function (opt) { return txRequest.claim(opt); }, options)];
        }
    });
}); };
var execute = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    var log, web3, getBlock, executeGas, gasLimit, _a, gasPrice, executeData, walletClaimIndex, options;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                log = conf.logger;
                web3 = conf.web3;
                getBlock = function () {
                    return new Promise(function (resolve) {
                        web3.eth.getBlock('latest', function (err, res) {
                            if (!err)
                                resolve(res);
                        });
                    });
                };
                executeGas = txRequest.callGas
                    .add(180000)
                    .div(64)
                    .times(65)
                    .round();
                _a = BigNumber.bind;
                return [4 /*yield*/, getBlock()];
            case 1:
                gasLimit = new (_a.apply(BigNumber, [void 0, (_b.sent()).gasLimit]))();
                gasPrice = txRequest.gasPrice;
                if (executeGas.greaterThan(gasLimit)) {
                    return [2 /*return*/, new Error("[" + txRequest.address + "] Execution gas exceeds the network gas limit.")];
                }
                log.info("[" + txRequest.address + "] Attempting the execution.");
                executeData = txRequest.executeData;
                walletClaimIndex = conf.wallet
                    ? conf.wallet.getAddresses().indexOf(txRequest.claimedBy)
                    : -1;
                options = {
                    to: txRequest.address,
                    gas: executeGas,
                    gasPrice: gasPrice,
                    data: executeData,
                    value: 0,
                };
                if (walletClaimIndex !== -1) {
                    return [2 /*return*/, conf.wallet.sendFromIndex(walletClaimIndex, options)];
                }
                return [2 /*return*/, sendTransaction(conf, txRequest, function (opt) { return txRequest.execute(opt); }, options)];
        }
    });
}); };
var cleanup = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    var web3, txRequestBalance, sender, gasToCancel, currentGasPrice, _a, gasCostToCancel, opts, _b, ownerIndex, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                web3 = conf.web3;
                return [4 /*yield*/, txRequest.getBalance()];
            case 1:
                txRequestBalance = _j.sent();
                // If a transaction request has been executed it will route into this option.
                if (txRequestBalance.equals(0)) {
                    conf.cache.set(txRequest.address, 0);
                    return [2 /*return*/];
                }
                if (!!txRequest.isCancelled) return [3 /*break*/, 15];
                sender = getSender(conf);
                return [4 /*yield*/, Util.estimateGas(web3, {
                        from: sender,
                        to: txRequest.address,
                        value: '0',
                        data: txRequest.cancelData,
                    })];
            case 2:
                gasToCancel = _j.sent();
                _a = BigNumber.bind;
                return [4 /*yield*/, Util.getGasPrice(web3)];
            case 3:
                currentGasPrice = new (_a.apply(BigNumber, [void 0, _j.sent()]))();
                gasCostToCancel = currentGasPrice.times(gasToCancel);
                _b = {
                    to: txRequest.address,
                    value: 0,
                    gas: gasToCancel + 21000
                };
                return [4 /*yield*/, web3.eth.getGasPrice()];
            case 4:
                opts = (_b.gasPrice = _j.sent(),
                    _b.data = txRequest.cancelData,
                    _b);
                if (!conf.wallet) return [3 /*break*/, 9];
                ownerIndex = conf.wallet.getAddresses().indexOf(txRequest.owner);
                if (!(ownerIndex !== -1)) return [3 /*break*/, 6];
                return [4 /*yield*/, conf.wallet.sendFromIndex(ownerIndex, opts)];
            case 5:
                _j.sent();
                return [3 /*break*/, 8];
            case 6:
                // The more likely scenario is that one of our accounts is not the
                // owner of the expired transaction in which case, we check to see
                // if we will not lost money for sending this transaction then send
                // it from any account.
                if (gasCostToCancel.greaterThan(txRequestBalance)) {
                    // The transaction request does not have enough money to compensate.
                    return [2 /*return*/];
                }
                return [4 /*yield*/, conf.wallet.sendFromNext(opts)];
            case 7:
                _j.sent();
                _j.label = 8;
            case 8: return [3 /*break*/, 15];
            case 9:
                if (!txRequest.isClaimedBy(web3.eth.defaultAccount)) return [3 /*break*/, 12];
                _d = (_c = txRequest).cancel;
                _e = {
                    from: web3.eth.defaultAccount,
                    value: 0,
                    gas: gasToCancel + 21000
                };
                return [4 /*yield*/, Util.getGasPrice(web3)];
            case 10: return [4 /*yield*/, _d.apply(_c, [(_e.gasPrice = _j.sent(),
                        _e)])];
            case 11:
                _j.sent();
                return [3 /*break*/, 15];
            case 12:
                if (gasCostToCancel.greaterThan(txRequestBalance)) {
                    return [2 /*return*/];
                }
                _g = (_f = txRequest).cancel;
                _h = {
                    from: web3.eth.defaultAccount,
                    value: 0,
                    gas: gasToCancel + 21000
                };
                return [4 /*yield*/, Util.getGasPrice(web3)];
            case 13: return [4 /*yield*/, _g.apply(_f, [(_h.gasPrice = _j.sent(),
                        _h)])];
            case 14:
                _j.sent();
                _j.label = 15;
            case 15:
                // Set all requests that make it here ready for deletion.
                conf.cache.del(txRequest.address);
                return [2 /*return*/];
        }
    });
}); };
var isExecuted = function (receipt) {
    if (receipt) {
        var executedEvent = '0x3e504bb8b225ad41f613b0c3c4205cdd752d1615b4d77cd1773417282fcfb5d9';
        return receipt.logs[0].topics.indexOf(executedEvent) > -1;
    }
    return false;
};
var preClaimingState = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    var log, self, next;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                log = conf.logger;
                self = STATE.PRE_CLAIMING;
                next = STATE.CLAIMING;
                // Return early if the transaction request has been cancelled
                if (txRequest.isCancelled) {
                    log.debug("[" + txRequest.address + "] Ignorning already cancelled txRequest.");
                    return [2 /*return*/, STATE.DONE];
                }
                return [4 /*yield*/, txRequest.beforeClaimWindow()];
            case 1:
                // Return early if the transaction request is before claim window,
                // and therefore not actionable upon
                if (_a.sent()) {
                    log.debug("[" + txRequest.address + "] Ignoring txRequest not in claim window.");
                    return [2 /*return*/, self];
                }
                return [2 /*return*/, next];
        }
    });
}); };
var doneState = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        cleanup(conf, txRequest);
        return [2 /*return*/, STATE.DONE];
    });
}); };
var claimingState = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    var log, next, _a, receipt, from, ignore, gas, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                log = conf.logger;
                next = STATE.PRE_EXECUTION;
                if (txRequest.isClaimed) {
                    log.debug("[" + txRequest.address + "] TxRequest in claimWindow but is already claimed.");
                    return [2 /*return*/, next];
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, claim(conf, txRequest)];
            case 2:
                _a = _b.sent(), receipt = _a.receipt, from = _a.from, ignore = _a.ignore;
                if (receipt && receipt.status == 1) {
                    gas = receipt.gasUsed * txRequest.data.txData.gasPrice;
                    log.info("[" + txRequest.address + "] Claimed!");
                    conf.statsdb.updateClaimed(from, gas);
                }
                else if (!receipt && !ignore) {
                    log.error("[" + txRequest.address + "] Claiming failed.");
                }
                return [3 /*break*/, 4];
            case 3:
                err_1 = _b.sent();
                log.error(err_1);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/, next];
        }
    });
}); };
var preExecutionState = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    var log, self, next, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                log = conf.logger;
                self = STATE.PRE_EXECUTION;
                next = STATE.EXECUTION;
                return [4 /*yield*/, txRequest.inFreezePeriod()];
            case 1:
                if (!_d.sent()) return [3 /*break*/, 3];
                _b = (_a = log).debug;
                _c = "[" + txRequest.address + "] Ignoring frozen txRequest. Now ";
                return [4 /*yield*/, txRequest.now()];
            case 2:
                _b.apply(_a, [_c + (_d.sent()) + " | Window start: " + txRequest.windowStart]);
                return [2 /*return*/, self];
            case 3: return [4 /*yield*/, txRequest.inExecutionWindow()];
            case 4:
                if (!(_d.sent())) {
                    return [2 /*return*/, self];
                }
                return [2 /*return*/, next];
        }
    });
}); };
var executionState = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    var log, web3, self, next, _a, receipt, from, ignore, data, timeBounty, txCost, err_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                log = conf.logger;
                web3 = conf.web3;
                self = STATE.EXECUTION;
                next = STATE.DONE;
                if (txRequest.wasCalled) {
                    log.debug("[" + txRequest.address + "] Already called.");
                    return [2 /*return*/, next];
                }
                return [4 /*yield*/, txRequest.inReservedWindow()];
            case 1:
                if ((_b.sent()) && !isClaimedByUs(conf, txRequest)) {
                    return [2 /*return*/, self];
                }
                _b.label = 2;
            case 2:
                _b.trys.push([2, 4, , 5]);
                return [4 /*yield*/, execute(conf, txRequest)];
            case 3:
                _a = _b.sent(), receipt = _a.receipt, from = _a.from, ignore = _a.ignore;
                if (ignore)
                    return [2 /*return*/, self];
                if (receipt && receipt.status == 1) {
                    if (isExecuted(receipt)) {
                        data = receipt.logs[0].data;
                        timeBounty = web3.toDecimal(data.slice(0, 66));
                        log.info("[" + txRequest.address + "] Executed.");
                        conf.statsdb.updateExecuted(from, timeBounty, 0);
                        return [2 /*return*/, next];
                    }
                    else {
                        log.info("[" + txRequest.address + "] Execution failed. Transaction already executed.");
                    }
                }
                else {
                    log.error("[" + txRequest.address + "] Execution failed.");
                }
                txCost = receipt.gasUsed * txRequest.data.txData.gasPrice;
                conf.statsdb.updateExecuted(from, 0, txCost);
                return [3 /*break*/, 5];
            case 4:
                err_2 = _b.sent();
                log.error(err_2);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/, next];
        }
    });
}); };
var state = {};
state[STATE.DONE] = doneState;
state[STATE.PRE_CLAIMING] = preClaimingState;
state[STATE.CLAIMING] = claimingState;
state[STATE.PRE_EXECUTION] = preExecutionState;
state[STATE.EXECUTION] = executionState;
var txRequestState = {};
/**
 * Takes in a txRequest object and routes it to the thread that will act on it,
 * or returns if no action can be taken.
 * @param {Config} conf
 * @param {TxRequest} txRequest
 * @returns {STATE} nextState
 */
var routeTxRequest = function (conf, txRequest) { return __awaiter(_this, void 0, void 0, function () {
    var log, currentState, transition, nextState;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                log = conf.logger;
                currentState = txRequestState[txRequest.address] || STATE.PRE_CLAIMING;
                transition = true;
                _a.label = 1;
            case 1:
                if (!transition) return [3 /*break*/, 3];
                return [4 /*yield*/, state[currentState](conf, txRequest)];
            case 2:
                nextState = _a.sent();
                transition = nextState !== currentState;
                log.debug("[" + txRequest.address + "] State transition " + stateName[currentState] + " -> " + stateName[nextState]);
                currentState = nextState;
                return [3 /*break*/, 1];
            case 3:
                txRequestState[txRequest.address] = nextState;
                return [2 /*return*/, nextState];
        }
    });
}); };
module.exports = { routeTxRequest: routeTxRequest, STATE: STATE };
