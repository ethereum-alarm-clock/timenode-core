"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mem_cache = require("memory-cache");
var _ = require("lodash");
var Cache = /** @class */ (function () {
    function Cache(logger) {
        this.cache = new mem_cache.Cache();
        this.logger = logger;
        this.mem = [];
    }
    Cache.prototype.set = function (k, v) {
        if (_.indexOf(this.mem, k) === -1) {
            this.mem.push(k);
        }
        this.cache.put(k, v); // , timeout, this.del(k))
        this.logger.cache("stored " + k + " with value " + v);
    };
    Cache.prototype.get = function (k, d) {
        // / FIXME more elegant error handling for this...
        if (this.cache.get(k) === null) {
            if (d === undefined) {
                throw new Error('attempted to access key entry that does not exist');
            }
            else
                return d;
        }
        this.logger.cache("accessed " + k);
        return this.cache.get(k);
    };
    Cache.prototype.has = function (k) {
        if (this.cache.get(k) === null) {
            this.logger.cache("miss " + k);
            return false;
        }
        this.logger.cache("hit " + k);
        return true;
    };
    Cache.prototype.del = function (k) {
        // mutates the this.mem array to remove the value
        _.remove(this.mem, function (addr) { return addr === k; });
        this.cache.del(k);
        this.logger.cache("deleted " + k);
    };
    Cache.prototype.len = function () {
        return this.cache.size();
    };
    Cache.prototype.stored = function () {
        return this.mem;
    };
    Cache.prototype.isEmpty = function () {
        if (this.len() === 0)
            return true;
        return false;
    };
    Cache.prototype.sweepExpired = function () {
        var _this = this;
        this.mem.forEach(function (txRequestAddress) {
            if (_this.get(txRequestAddress, 0) === 99) {
                // expired
                _this.del(txRequestAddress);
            }
        });
    };
    return Cache;
}());
exports.default = Cache;
// The cache assigns each key (txRequestAddress) the original value of its WindowStart
// During certain conditions it will change the value
// 105 - Failed Execution call (Attempt again)
// 104 - UNIMPLEMENTED
// 103 - Failed Claim call (Attempt again)
// 102 - Attempted Claim call (will not attempt again until result)
// 101 - UNIMPLEMENTED
// 100 - Successful Execution call (ready to be expired)
//  99 - Expired (ready to be swept)
//  -1 - Failed Execution call (will not attempt again)
