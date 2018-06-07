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
var bignumber_js_1 = require("bignumber.js");
var hasPending = require("../pending.js");
var Actions = /** @class */ (function () {
    function Actions(config) {
        this.config = config;
    }
    Actions.prototype.claim = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var requiredDeposit, claimData, opts, txHash;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requiredDeposit = txRequest.requiredDeposit;
                        claimData = txRequest.claimData;
                        opts = {
                            to: txRequest.address,
                            value: requiredDeposit,
                            //TODO estimate gas above
                            gas: 3000000,
                            //TODO estimate gas above
                            gasPrice: 12,
                            data: claimData,
                        };
                        return [4 /*yield*/, hasPending(this.config, txRequest)];
                    case 1:
                        if (_a.sent()) {
                            return [2 /*return*/, {
                                    ignore: true,
                                }];
                        }
                        return [4 /*yield*/, this.config.wallet.sendFromNext(opts)];
                    case 2:
                        txHash = _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Actions.prototype.execute = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var gasToExecute, executeData, claimIndex, opts, txHash;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        gasToExecute = txRequest.callGas
                            .add(180000)
                            .div(64)
                            .times(65)
                            .round();
                        executeData = txRequest.executeData;
                        claimIndex = this.config.wallet
                            .getAddresses()
                            .indexOf(txRequest.claimedBy);
                        opts = {
                            to: txRequest.address,
                            value: 0,
                            gas: gasToExecute,
                            // TODO estimate gas above
                            gasPrice: 12,
                            data: executeData,
                        };
                        return [4 /*yield*/, hasPending(this.config, txRequest)];
                    case 1:
                        if (_a.sent()) {
                            return [2 /*return*/, {
                                    ignore: true,
                                }];
                        }
                        return [4 /*yield*/, this.config.wallet.sendFromIndex(opts)];
                    case 2:
                        txHash = _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Actions.prototype.cleanup = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var txRequestBalance, gasToCancel, currentGasPrice, gasCostToCancel, opts, transactionHash, ownerIndex;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, txRequest.getBalance()];
                    case 1:
                        txRequestBalance = _a.sent();
                        if (txRequestBalance.equals(0)) {
                            return [2 /*return*/, true];
                        }
                        if (!txRequest.isCancelled) return [3 /*break*/, 2];
                        return [2 /*return*/, true];
                    case 2:
                        gasToCancel = 12;
                        currentGasPrice = new bignumber_js_1.default(12);
                        gasCostToCancel = currentGasPrice.times(gasToCancel);
                        opts = {
                            to: txRequest.address,
                            value: 0,
                            gas: gasToCancel + 21000,
                            gasPrice: currentGasPrice,
                            data: txRequest.cancelData,
                        };
                        transactionHash = void 0;
                        ownerIndex = this.config.wallet.getAddresses().indexOf(txRequest.owner);
                        if (!(ownerIndex !== -1)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.config.wallet.sendFromIndex(ownerIndex, opts)];
                    case 3:
                        transactionHash = _a.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        if (gasCostToCancel.greaterThan(txRequestBalance)) {
                            // The txRequest doesn't have high enough balance to compensate.
                            // It's now considered dust.
                            return [2 /*return*/, true];
                        }
                        return [4 /*yield*/, this.config.wallet.sendFromNext(opts)];
                    case 5:
                        transactionHash = _a.sent();
                        _a.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return Actions;
}());
exports.default = Actions;
