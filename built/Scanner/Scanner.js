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
var SCAN_DELAY = 1;
var Buckets_1 = require("../Buckets");
var Scanner = /** @class */ (function () {
    /**
     * Creates a new Scanner instance. The scanner serves as the top level
     * entry point for the EAC-JS TimeNode. You still need to call the
     * `start()` function before the TimeNode becomes active.
     * @param {number} ms Milliseconds of the scan interval.
     * @param {Config} config The TimeNode Config object.
     */
    function Scanner(config, router) {
        this.config = config;
        this.scanning = false;
        this.router = router;
    }
    Scanner.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var watchingEnabled, _a, _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        // Create the interval for processing the transaction requests in cache.
                        this.cacheScanner = setInterval(function () {
                            _this.scanCache().catch(function (err) { return _this.config.logger.error(err); });
                        }, this.config.ms);
                        return [4 /*yield*/, new Promise(function (resolve) {
                                _this.config.web3.currentProvider.sendAsync({
                                    jsonrpc: '2.0',
                                    id: 1,
                                    method: 'eth_getFilterLogs',
                                    params: [],
                                }, function (err) {
                                    if (err !== null) {
                                        resolve(false);
                                    }
                                    resolve(true);
                                });
                            })];
                    case 1:
                        watchingEnabled = _c.sent();
                        if (!watchingEnabled) return [3 /*break*/, 3];
                        // Watching is enabled! start watching the chain.
                        this.config.logger.info('Watching ENABLED');
                        _a = this;
                        return [4 /*yield*/, this.watchBlockchain()];
                    case 2:
                        _a.chainScanner = _c.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        // Watchin disabled. We use old-school methods.
                        this.config.logger.info('Watching DISABLED');
                        this.config.logger.info('-Initiating Backup Scanner-');
                        _b = this;
                        return [4 /*yield*/, this.backupScanBlockchain()];
                    case 4:
                        _b.chainScanner = _c.sent();
                        _c.label = 5;
                    case 5:
                        // TODO: Do we need to immediately scan the cache?
                        this.scanCache().catch(function (err) { return _this.config.logger.error(err); });
                        // Mark that we've started.
                        this.config.logger.info('Scanner STARTED');
                        this.scanning = true;
                        return [2 /*return*/, this.scanning];
                }
            });
        });
    };
    Scanner.prototype.stop = function () {
        if (this.scanning) {
            // Clear scanning intervals.
            clearInterval(this.cacheScanner);
            clearInterval(this.chainScanner);
            // Mark that we've stopped.
            this.config.logger.info('Scanner STOPPED');
            this.scanning = false;
        }
        return this.scanning;
    };
    /**
     * Performs four checks:
     *  - The TxRequest is before claim window.
     *  - The TxRequest is in claim window.
     *  - The TxRequest is in freeze period.
     *  - The TxRequest is in execution window.
     * These are the four conditions in which the TxRequest is upcoming,
     * and should be stored in a TimeNodes cache.
     * @param txRequest Transaction Request Object
     */
    Scanner.prototype.isUpcoming = function (txRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, txRequest.beforeClaimWindow()];
                    case 1:
                        _c = (_d.sent());
                        if (_c) return [3 /*break*/, 3];
                        return [4 /*yield*/, txRequest.inClaimWindow()];
                    case 2:
                        _c = (_d.sent());
                        _d.label = 3;
                    case 3:
                        _b = _c;
                        if (_b) return [3 /*break*/, 5];
                        return [4 /*yield*/, txRequest.inFreezePeriod()];
                    case 4:
                        _b = (_d.sent());
                        _d.label = 5;
                    case 5:
                        _a = _b;
                        if (_a) return [3 /*break*/, 7];
                        return [4 /*yield*/, txRequest.inExecutionWindow()];
                    case 6:
                        _a = (_d.sent());
                        _d.label = 7;
                    case 7: return [2 /*return*/, (_a)];
                }
            });
        });
    };
    //TODO move this to requestFactory instance
    Scanner.prototype.getCurrentBuckets = function (reqFactory, latest) {
        return {
            blockBucket: reqFactory.calcBucket(latest),
            timestampBucket: reqFactory.calcBucket(latest),
        };
    };
    Scanner.prototype.getNextBuckets = function (reqFactory, latest) {
        var nextBlockInterval = latest.number + Buckets_1.BucketSize.block;
        var nextTsInterval = latest.timestamp + Buckets_1.BucketSize.timestamp;
        return {
            blockBucket: reqFactory.calcBucket(nextBlockInterval, 1),
            timestampBucket: reqFactory.calcBucket(nextTsInterval, 2),
        };
    };
    Scanner.prototype.getBuckets = function (reqFactory) {
        return __awaiter(this, void 0, void 0, function () {
            var latest;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getBlock('latest')];
                    case 1:
                        latest = _a.sent();
                        return [2 /*return*/, {
                                currentBuckets: this.getCurrentBuckets(reqFactory, latest),
                                nextBuckets: this.getNextBuckets(reqFactory, latest),
                            }];
                }
            });
        });
    };
    // TODO shouldn't return void
    Scanner.prototype.handleRequest = function (request) {
        if (!this.isValid(request.address))
            return;
        this.config.logger.debug("[" + request.address + "] Discovered");
        if (!this.config.cache.has(request.address)) {
            this.store(request);
        }
    };
    Scanner.prototype.backupScanBlockchain = function () {
        return __awaiter(this, void 0, void 0, function () {
            var reqFactory, _a, currentBuckets, nextBuckets;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.config.eac.requestFactory()];
                    case 1:
                        reqFactory = _b.sent();
                        return [4 /*yield*/, this.getBuckets(reqFactory)];
                    case 2:
                        _a = _b.sent(), currentBuckets = _a.currentBuckets, nextBuckets = _a.nextBuckets;
                        return [4 /*yield*/, reqFactory.getRequestsByBucket(currentBuckets.blockBucket)];
                    case 3:
                        // TODO: extract this out
                        (_b.sent()).map(this.handleRequest);
                        return [4 /*yield*/, reqFactory.getRequestsByBucket(currentBuckets.timestampBucket)];
                    case 4:
                        (_b.sent()).map(this.handleRequest);
                        return [4 /*yield*/, reqFactory.getRequestsByBucket(nextBuckets.blockBucket)];
                    case 5:
                        (_b.sent()).map(this.handleRequest);
                        return [4 /*yield*/, reqFactory.getRequestsByBucket(nextBuckets.timestampBucket)];
                    case 6:
                        (_b.sent()).map(this.handleRequest);
                        //
                        // Set a recursive interval to continue this "scan" every ms/1000 seconds.
                        return [2 /*return*/, setInterval(function () {
                                _this.backupScanBlockchain().catch(function (err) { return _this.config.logger.error(err); });
                            }, this.config.ms)];
                }
            });
        });
    };
    Scanner.prototype.watchBlockchain = function () {
        return __awaiter(this, void 0, void 0, function () {
            var reqFactory, _a, currentBuckets, nextBuckets;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.config.eac.requestFactory()];
                    case 1:
                        reqFactory = _b.sent();
                        return [4 /*yield*/, this.getBuckets(reqFactory)];
                    case 2:
                        _a = _b.sent(), currentBuckets = _a.currentBuckets, nextBuckets = _a.nextBuckets;
                        // Start watching the current buckets right away.
                        reqFactory.watchRequestsByBucket(currentBuckets.blockBucket, this.handleRequest);
                        reqFactory.watchRequestsByBucket(currentBuckets.timestampBucket, this.handleRequest);
                        reqFactory.watchRequestsByBucket(nextBuckets.blockBucket, this.handleRequest);
                        reqFactory.watchRequestsByBucket(nextBuckets.timestampBucket, this.handleRequest);
                        // Needed?
                        this.config.logger.info("Watching STARTED");
                        // Set an timeout for every hour
                        return [2 /*return*/, setInterval(function () {
                                // We only really need to watch the next buckets, but this is convienence & clarity.
                                _this.watchBlockchain();
                            }, 60 * 60 * 1000)];
                }
            });
        });
    };
    Scanner.prototype.isValid = function (requestAddress) {
        if (requestAddress === this.config.eac.Constants.NULL_ADDRESS) {
            this.config.logger.debug('Warning.. Transaction Request with NULL_ADDRESS found.');
            return false;
        }
        else if (!this.config.eac.Util.checkValidAddress(requestAddress)) {
            // This should, conceivably, never happen unless there is a bug in eac.js-lib.
            throw new Error("[" + requestAddress + "] Received invalid response from Request Tracker - CRITICAL BUG");
        }
        return true;
    };
    // TODO meaningful return value
    Scanner.prototype.scanCache = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allTxRequests;
            var _this = this;
            return __generator(this, function (_a) {
                // Check if the cache is empty.
                if (this.config.cache.len() === 0)
                    return [2 /*return*/];
                allTxRequests = this.config.cache
                    .stored()
                    .filter(function (address) { return _this.config.cache.get(address) > 0; })
                    .map(function (address) { return _this.config.eac.transactionRequest(address); });
                // Get fresh data on our transaction requests and route them into appropiate action.
                Promise.all(allTxRequests).then(function (txRequests) {
                    txRequests.forEach(function (txRequest) {
                        txRequest
                            .refreshData()
                            .then(function () { return _this.router.route(_this.config, txRequest); });
                    });
                });
                return [2 /*return*/];
            });
        });
    };
    // TODO extract to a utils?
    Scanner.prototype.getBlock = function (number) {
        var _this = this;
        if (number === void 0) { number = 'latest'; }
        return new Promise(function (resolve, reject) {
            _this.config.web3.eth.getBlock(number, function (err, block) {
                if (!err)
                    if (block)
                        resolve(block);
                    else
                        reject("Returned block " + number + " is null");
                else
                    reject(err);
            });
        });
    };
    Scanner.prototype.store = function (request) {
        this.config.logger.info("[" + request.address + "] Inputting to cache");
        this.config.cache.set(request.address, request.params[7]);
    };
    return Scanner;
}());
exports.default = Scanner;
