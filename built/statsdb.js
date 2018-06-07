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
var BigNumber = require('bignumber.js');
// / Wrapper over a lokijs persistent storage to keep track of the stats of executing accounts.
var StatsDB = /** @class */ (function () {
    /**
     * Creates an instance of StatsDB.
     * @param {any} web3
     * @param {any} db Any storage solution that exposes find, update, insert
     * @memberof StatsDB
     */
    function StatsDB(web3, db) {
        this.db = db;
        this.web3 = web3;
        this.eac = require('eac.js-lib')(web3);
        var fetchedStats = this.db.getCollection('stats');
        this.stats =
            fetchedStats !== null ? fetchedStats : this.db.addCollection('stats');
    }
    // / Takes an array of addresses and stores them as new stats objects.
    StatsDB.prototype.initialize = function (accounts) {
        var _this = this;
        accounts.forEach(function (account) { return __awaiter(_this, void 0, void 0, function () {
            var found, bounties, costs;
            return __generator(this, function (_a) {
                found = this.stats.find({ account: account })[0];
                if (found) {
                    bounties = found.bounties || 0;
                    costs = found.costs || 0;
                    found.bounties = new BigNumber(bounties);
                    found.costs = new BigNumber(costs);
                }
                else {
                    this.stats.insert({
                        account: account,
                        claimed: 0,
                        executed: 0,
                        bounties: new BigNumber(0),
                        costs: new BigNumber(0),
                        executedTransactions: [],
                    });
                }
                return [2 /*return*/];
            });
        }); });
    };
    // / Takes the account which has claimed a transaction.
    StatsDB.prototype.updateClaimed = function (account, cost) {
        return __awaiter(this, void 0, void 0, function () {
            var found;
            return __generator(this, function (_a) {
                found = this.stats.find({ account: account })[0];
                found.claimed += 1;
                found.costs = found.costs.plus(cost);
                this.stats.update(found);
                return [2 /*return*/];
            });
        });
    };
    // / Takes the account which has executed a transaction.
    StatsDB.prototype.updateExecuted = function (account, bounty, cost) {
        return __awaiter(this, void 0, void 0, function () {
            var found;
            return __generator(this, function (_a) {
                found = this.stats.find({ account: account })[0];
                found.executed += 1;
                found.executedTransactions.push({ timestamp: Date.now() });
                found.bounties = found.bounties.plus(bounty);
                found.costs = found.costs.plus(cost);
                this.stats.update(found);
                return [2 /*return*/];
            });
        });
    };
    // / Gets the stats
    // @returns an array of the DB objs
    StatsDB.prototype.getStats = function () {
        return this.stats.data;
    };
    return StatsDB;
}());
module.exports = StatsDB;
