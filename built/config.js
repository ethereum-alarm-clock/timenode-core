"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cache_1 = require("./cache");
var wallet_1 = require("./wallet");
var DummyLogger = {
    debug: function (msg) { return console.log(msg); },
    cache: function (msg) { return console.log(msg); },
    info: function (msg) { return console.log(msg); },
    error: function (msg) { return console.log(msg); },
};
var Config = /** @class */ (function () {
    function Config(params) {
        this.scanSpread = params.scanSpread || 50;
        this.logger = params.logger || DummyLogger;
        this.cache = new cache_1.default(this.logger);
        if (params.eac && params.factory && params.provider && params.web3) {
            this.eac = params.eac;
            this.factory = params.factory;
            this.provider = params.provider;
            this.web3 = params.web3;
        }
        else {
            throw new Error('Passed in Config params are incomplete! Unable to start TimeNode. Quitting..');
        }
        this.scanning = params.autostart || false;
        if (params.walletStores &&
            params.walletStores.length &&
            params.walletStores.length > 0) {
            params.walletStores = params.walletStores.map(function (store, idx) {
                if (typeof store === 'object') {
                    return JSON.stringify(store);
                }
            });
            this.wallet = new wallet_1.default(this.web3);
            this.wallet.decrypt(params.walletStores, params.password);
        }
        else {
            this.wallet = false;
        }
    }
    return Config;
}());
exports.default = Config;
// const c = new Config({
//   autostart: false,
//   eac: 'as',
// })
// console.log(c)
