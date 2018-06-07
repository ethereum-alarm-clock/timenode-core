"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DefaultLogger = /** @class */ (function () {
    function DefaultLogger() {
    }
    DefaultLogger.prototype.cache = function (msg) {
        this.formatPrint(msg, 'CACHE');
    };
    DefaultLogger.prototype.debug = function (msg) {
        this.formatPrint(msg, 'DEBUG');
    };
    DefaultLogger.prototype.error = function (msg) {
        this.formatPrint(msg, 'ERROR');
    };
    DefaultLogger.prototype.info = function (msg) {
        this.formatPrint(msg, 'INFO');
    };
    DefaultLogger.prototype.formatPrint = function (msg, kind) {
        console.log(kind, this.timestamp(), msg);
    };
    DefaultLogger.prototype.timestamp = function () {
        return Math.floor(Date.now() / 1000);
    };
    return DefaultLogger;
}());
exports.DefaultLogger = DefaultLogger;
