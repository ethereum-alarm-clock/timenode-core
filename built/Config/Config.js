"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Cache_1 = require("../Cache");
var Wallet_1 = require("../Wallet");
var Logger_1 = require("../Logger");
var Config = /** @class */ (function () {
    function Config(params) {
        this.autostart = params.autostart || true;
        this.scanSpread = params.scanSpread || 50;
        this.logger = params.logger || new Logger_1.DefaultLogger();
        this.cache = new Cache_1.default(this.logger);
        if (params.eac && params.factory && params.provider && params.web3) {
            this.eac = params.eac;
            this.factory = params.factory;
            this.provider = params.provider;
            this.web3 = params.web3;
        }
        else {
            throw new Error('Passed in Config params are incomplete! Unable to start TimeNode. Quitting..');
        }
        if (params.walletStores &&
            params.walletStores.length &&
            params.walletStores.length > 0) {
            params.walletStores = params.walletStores.map(function (store, idx) {
                if (typeof store === 'object') {
                    return JSON.stringify(store);
                }
            });
            this.wallet = new Wallet_1.default(this.web3);
            this.wallet.decrypt(params.walletStores, params.password);
        }
        else {
            this.wallet = false;
        }
    }
    return Config;
}());
exports.default = Config;
