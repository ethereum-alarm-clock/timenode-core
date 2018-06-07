"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var TxStatus;
(function (TxStatus) {
    TxStatus[TxStatus["BeforeClaimWindow"] = 0] = "BeforeClaimWindow";
    TxStatus[TxStatus["ClaimWindow"] = 1] = "ClaimWindow";
    TxStatus[TxStatus["FreezePeriod"] = 2] = "FreezePeriod";
    TxStatus[TxStatus["ExecutionWindow"] = 3] = "ExecutionWindow";
    TxStatus[TxStatus["Executed"] = 4] = "Executed";
    TxStatus[TxStatus["Done"] = 5] = "Done";
})(TxStatus = exports.TxStatus || (exports.TxStatus = {}));
;
