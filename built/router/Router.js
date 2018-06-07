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
var Enum_1 = require("../Enum");
var Router = /** @class */ (function () {
    function Router(config, actions) {
        this.actions = actions;
        this.config = config;
        this.transitions[Enum_1.TxStatus.BeforeClaimWindow] = this.beforeClaimWindow;
        this.transitions[Enum_1.TxStatus.ClaimWindow] = this.claimWindow;
        this.transitions[Enum_1.TxStatus.FreezePeriod] = this.freezePeriod;
        this.transitions[Enum_1.TxStatus.ExecutionWindow] = this.executionWindow;
        this.transitions[Enum_1.TxStatus.Executed] = this.executed;
    }
    Router.prototype.beforeClaimWindow = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (txRequest.isCancelled) {
                            // TODO Status.CleanUp?
                            return [2 /*return*/, Enum_1.TxStatus.Executed];
                        }
                        return [4 /*yield*/, txRequest.beforeClaimWindow()];
                    case 1:
                        if (_a.sent()) {
                            return [2 /*return*/, Enum_1.TxStatus.BeforeClaimWindow];
                        }
                        return [2 /*return*/, Enum_1.TxStatus.ClaimWindow];
                }
            });
        });
    };
    Router.prototype.claimWindow = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        //TODO check inClaimWindow
                        if (txRequest.isClaimed) {
                            return [2 /*return*/, Enum_1.TxStatus.FreezePeriod];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // check profitability FIRST
                        // ... here
                        //TODO do we care about return value?
                        return [4 /*yield*/, this.actions.claim(txRequest)];
                    case 2:
                        // check profitability FIRST
                        // ... here
                        //TODO do we care about return value?
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _a.sent();
                        // TODO handle gracefully?
                        throw new Error(e_1);
                    case 4: return [2 /*return*/, Enum_1.TxStatus.FreezePeriod];
                }
            });
        });
    };
    Router.prototype.freezePeriod = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, txRequest.inFreezePeriod()];
                    case 1:
                        if (_a.sent()) {
                            return [2 /*return*/, Enum_1.TxStatus.FreezePeriod];
                        }
                        return [4 /*yield*/, txRequest.inExecutionWindow()];
                    case 2:
                        if (_a.sent()) {
                            return [2 /*return*/, Enum_1.TxStatus.ExecutionWindow];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    Router.prototype.executionWindow = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var reserved, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (txRequest.wasCalled) {
                            return [2 /*return*/, Enum_1.TxStatus.Executed];
                        }
                        return [4 /*yield*/, txRequest.inReservedWindow()];
                    case 1:
                        reserved = _a.sent();
                        if (reserved && !this.isLocalClaim(txRequest)) {
                            return [2 /*return*/, Enum_1.TxStatus.ExecutionWindow];
                        }
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.actions.execute(txRequest)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        e_2 = _a.sent();
                        //TODO handle gracefully?
                        throw new Error(e_2);
                    case 5: return [2 /*return*/, Enum_1.TxStatus.Executed];
                }
            });
        });
    };
    Router.prototype.executed = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.actions.cleanup(txRequest)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, Enum_1.TxStatus.Done];
                }
            });
        });
    };
    Router.prototype.isLocalClaim = function (txRequest) {
        var localClaim;
        // TODO add function on config `hasWallet(): boolean`
        if (this.config.wallet) {
            localClaim = this.config.wallet.isKnownAddress(txRequest.claimedBy);
        }
        else {
            localClaim = txRequest.isClaimedBy(this.config.web3.defaultAccount);
        }
        if (!localClaim) {
            this.config.logger.debug("[" + txRequest.address + "] In reserve window and not claimed by this TimeNode.");
        }
        return localClaim;
    };
    Router.prototype.isProfitableClaim = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var claimPaymentModifier, paymentWhenClaimed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, txRequest.claimPaymentModifier()];
                    case 1:
                        claimPaymentModifier = _a.sent();
                        paymentWhenClaimed = txRequest.bounty.times(claimPaymentModifier).dividedToIntegerBy(100);
                        return [2 /*return*/];
                }
            });
        });
    };
    // TODO do not return void
    Router.prototype.route = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var status, nextStatus;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        status = this.txRequestStates[txRequest.address] || Enum_1.TxStatus.BeforeClaimWindow;
                        return [4 /*yield*/, this.transitions[status](txRequest)];
                    case 1:
                        nextStatus = _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!(nextStatus !== status)) return [3 /*break*/, 4];
                        status = nextStatus;
                        return [4 /*yield*/, this.transitions[status](txRequest)];
                    case 3:
                        nextStatus = _a.sent();
                        return [3 /*break*/, 2];
                    case 4:
                        this.txRequestStates[txRequest.address] = nextStatus;
                        return [2 /*return*/];
                }
            });
        });
    };
    return Router;
}());
exports.default = Router;
