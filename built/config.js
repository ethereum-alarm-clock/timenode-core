"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Cache = require("./cache");
var Wallet = require("./wallet");
var Config = /** @class */ (function () {
    /**
     * Creates a new Config object.
     * @param {ConfigParams} params The parameters to create a new Config object.
     */
    function Config(params) {
        this.scanSpread = params.scanSpread || 50;
        // If logfile and loglevel are provided (in a node environment)
        if (params.logger) {
            this.logger = params.logger;
        }
        else {
            // Otherwise just log everything to the console.
            this.logger = {
                debug: function (msg) { return console.log(msg); },
                cache: function (msg) { return console.log(msg); },
                info: function (msg) { return console.log(msg); },
                error: function (msg) { return console.log(msg); },
            };
        }
        this.cache = new Cache(this.logger);
        // These are all required options
        this.factory = params.factory;
        this.web3 = params.web3;
        this.eac = params.eac;
        this.provider = params.provider;
        if (!this.factory || !this.web3 || !this.eac || !this.provider) {
            throw new Error('Missing a required variable to the Config constructor. Please make sure you are passing in the correct object.');
        }
        // Set autostart
        this.scanning = params.autostart || false;
    }
    Config.create = function (params) {
        // Use the constructor to create the initial Config object.
        var conf = new Config(params);
        if (params.walletStores &&
            typeof params.walletStores.length !== 'undefined' &&
            params.walletStores.length > 0) {
            params.walletStores.forEach(function (store, index) {
                if (typeof store === 'object') {
                    params.walletStores[index] = JSON.stringify(store);
                }
            });
            conf.wallet = new Wallet(params.web3);
            conf.wallet.decrypt(params.walletStores, params.password);
        }
        else {
            conf.wallet = false;
        }
        return conf;
    };
    return Config;
}());
exports.default = Config;
