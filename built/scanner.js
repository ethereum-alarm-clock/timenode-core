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
var routing_js_1 = require("./routing.js");
var clientVersion = require('../package.json').version;
var SCAN_DELAY = 1;
var Scanner = /** @class */ (function () {
    /**
     * Creates a new Scanner instance. The scanner serves as the top level
     * entry point for the EAC-JS TimeNode.
     * @param {Number} ms Milliseconds of the scan interval.
     * @param {Config} config The TimeNode Config object.
     */
    function Scanner(ms, config) {
        this.ms = ms;
        this.config = config;
        this.logNetwork();
        // TODO: extract this out to function `this.startupMessage()`
        config.logger.info("eac.js-client : version " + clientVersion);
        config.logger.info("Validating results with factory at " + this.config.factory.address);
        config.logger.info("Scanning every " + (this.ms * SCAN_DELAY) / 1000 + " seconds.");
        this.running = false;
    }
    Scanner.prototype.logNetwork = function () {
        var _this = this;
        var Networks = {
            0: 'Private',
            1: 'Mainnet',
            2: 'Mordern',
            3: 'Ropsten',
            4: 'Rinkeby',
            42: 'Kovan',
        };
        this.config.web3.version.getNetwork(function (err, res) {
            if (err) {
                _this.config.logger.error("Unable to connect to a Network");
            }
            _this.config.logger.info("Network : " + Networks[res || 0] + " Network");
        });
        var provider = this.config.web3.currentProvider;
        var providerUrl;
        if (provider) {
            providerUrl = provider.host ? provider.host : provider.connection.url;
        }
        else {
            providerUrl = 'Unknown';
        }
        this.config.logger.info("Web3 provider : " + providerUrl);
    };
    Scanner.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var watchingEnabled;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Reset the intervals if already started.
                        if (this.running)
                            this.stop();
                        // Set interval for scanning for actionable transaction requests in the cache.
                        this.cacheScanner = setInterval(function () {
                            _this.scanCache().catch(function (err) { return _this.config.logger.error(err); });
                        }, this.ms);
                        return [4 /*yield*/, new Promise(function (resolve) {
                                _this.config.web3.currentProvider.sendAsync({
                                    jsonrpc: '2.0',
                                    id: 1,
                                    method: 'eth_getFilterLogs',
                                    params: [],
                                }, function (e) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        if (e !== null) {
                                            this.config.logger.info('Watching DISABLED');
                                            resolve(false);
                                        }
                                        this.config.logger.info('Watching ENABLED');
                                        resolve(true);
                                        return [2 /*return*/];
                                    });
                                }); });
                            })];
                    case 1:
                        watchingEnabled = _a.sent();
                        if (watchingEnabled) {
                            this.chainScanner = this.watchBlockchain();
                        }
                        else {
                            this.config.logger.info('-Initiating Backup Scanner-');
                            // backup scan
                            this.chainScanner = this.backupScanBlockchain();
                        }
                        this.scanCache().catch(function (err) { return _this.config.logger.error(err); });
                        // Mark that we've started.
                        this.running = true;
                        this.config.logger.info('Scanner STARTED');
                        return [2 /*return*/];
                }
            });
        });
    };
    Scanner.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Clear scanning intervasls.
                clearInterval(this.cacheScanner);
                clearInterval(this.chainScanner);
                // if (this.requestWatcher) {
                //   await this.requestFactory.stopWatch(this.requestWatcher);
                //   this.log.info('Watching STOPPED');
                // }
                // Mark that we've stopped.
                this.running = false;
                this.config.logger.info('Scanner STOPPED');
                return [2 /*return*/];
            });
        });
    };
    // isValidBlock(block) {
    //   if (!block) {
    //     return false;
    //   }
    //   return true;
    // }
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
    Scanner.prototype.getWindowForBlock = function (latest) {
        var leftBlock = this.getLeftBlock(latest);
        var rightBlock = leftBlock + this.config.scanSpread * 2;
        return { leftBlock: leftBlock, rightBlock: rightBlock };
    };
    Scanner.prototype.getLeftBlock = function (latest) {
        var leftBlock = latest - this.config.scanSpread;
        return leftBlock < 0 ? 0 : leftBlock;
    };
    Scanner.prototype.getRightTimestamp = function (leftTimestamp, latestTimestamp) {
        return 2 * latestTimestamp - leftTimestamp;
    };
    // @param request {Object} of form {address: 0xAF...34, uintArgs: uint[12]}
    // async handleRequests (request) {
    //   if (!this.isCorrect(request.address)) return;
    //   this.log.debug(`[${request.address}] Discovered.`)
    //   if (!this.cache.has(request.address)) {
    //     // If it's not already in cache, find windowStart.
    //     this.store(request)
    //   }
    // }
    Scanner.prototype.backupScanBlockchain = function () {
        return __awaiter(this, void 0, void 0, function () {
            var reqFactory, latestBlock, blockBucket, tsBucket, next, handleRequests;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.config.eac.requestFactory()];
                    case 1:
                        reqFactory = _a.sent();
                        return [4 /*yield*/, this.getBlock('latest')];
                    case 2:
                        latestBlock = _a.sent();
                        blockBucket = reqFactory.calcBucket(latestBlock.number, 1);
                        tsBucket = reqFactory.calcBucket(latestBlock.timestamp, 2);
                        return [4 /*yield*/, this.getNextBuckets(latestBlock)];
                    case 3:
                        next = _a.sent();
                        handleRequests = function (request) {
                            if (!_this.isCorrect(request.address))
                                return;
                            _this.config.logger.debug("[" + request.address + "] Discovered.");
                            if (!_this.config.cache.has(request.address)) {
                                // If it's not already in cache, find windowStart.
                                _this.store(request);
                            }
                        };
                        return [4 /*yield*/, reqFactory.getRequestsByBucket(blockBucket)];
                    case 4:
                        // TODO: extract this out
                        (_a.sent()).map(handleRequests);
                        return [4 /*yield*/, reqFactory.getRequestsByBucket(tsBucket)];
                    case 5:
                        (_a.sent()).map(handleRequests);
                        return [4 /*yield*/, reqFactory.getRequestsByBucket(next.blockBucket)];
                    case 6:
                        (_a.sent()).map(handleRequests);
                        return [4 /*yield*/, reqFactory.getRequestsByBucket(next.tsBucket)];
                    case 7:
                        (_a.sent()).map(handleRequests);
                        return [2 /*return*/, setInterval(function () {
                                _this.backupScanBlockchain().catch(function (err) { return _this.config.logger.error(err); });
                            }, this.ms)];
                }
            });
        });
    };
    Scanner.prototype.getNextBuckets = function (block) {
        return __awaiter(this, void 0, void 0, function () {
            var reqFactory, blockBucketSize, tsBucketSize, nextBlockInterval, nextTsInterval, blockBucket, tsBucket;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.config.eac.requestFactory()];
                    case 1:
                        reqFactory = _a.sent();
                        blockBucketSize = 240;
                        tsBucketSize = 3600;
                        nextBlockInterval = block.number + blockBucketSize;
                        nextTsInterval = block.timestamp + tsBucketSize;
                        blockBucket = reqFactory.calcBucket(nextBlockInterval, 1);
                        tsBucket = reqFactory.calcBucket(nextTsInterval, 2);
                        return [2 /*return*/, {
                                blockBucket: blockBucket,
                                tsBucket: tsBucket,
                            }];
                }
            });
        });
    };
    Scanner.prototype.watchBlockchain = function () {
        return __awaiter(this, void 0, void 0, function () {
            var reqFactory, latestBlock, blockBucket, tsBucket, handleRequests;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.config.eac.requestFactory()];
                    case 1:
                        reqFactory = _a.sent();
                        return [4 /*yield*/, this.getBlock('latest')];
                    case 2:
                        latestBlock = _a.sent();
                        blockBucket = reqFactory.calcBucket(latestBlock.number, 1);
                        tsBucket = reqFactory.calcBucket(latestBlock.timestamp, 2);
                        handleRequests = function (request) {
                            if (!_this.isCorrect(request.address))
                                return;
                            _this.config.logger.debug("[" + request.address + "] Discovered.");
                            if (!_this.config.cache.has(request.address)) {
                                // If it's not already in cache, find windowStart.
                                _this.store(request);
                            }
                        };
                        // Start watching the current buckets right away.
                        reqFactory.watchRequestsByBucket(blockBucket, handleRequests);
                        reqFactory.watchRequestsByBucket(tsBucket, handleRequests);
                        // Also start watching the next one now.
                        this.watchNextBuckets(latestBlock);
                        this.config.logger.info("Watching STARTED");
                        this.config.logger.debug("Watching for new Requests from current bucket ");
                        // Set an timeout for every hour
                        return [2 /*return*/, setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                                var curBlock;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.getBlock('latest')];
                                        case 1:
                                            curBlock = _a.sent();
                                            this.watchNextBuckets(curBlock);
                                            return [2 /*return*/];
                                    }
                                });
                            }); }, 60 * 60 * 1000)];
                }
            });
        });
    };
    Scanner.prototype.watchNextBuckets = function (block) {
        return __awaiter(this, void 0, void 0, function () {
            var reqFactory, next, handleRequests;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.config.eac.requestFactory()];
                    case 1:
                        reqFactory = _a.sent();
                        return [4 /*yield*/, this.getNextBuckets(block)];
                    case 2:
                        next = _a.sent();
                        handleRequests = function (request) {
                            if (!_this.isCorrect(request.address))
                                return;
                            _this.config.logger.debug("[" + request.address + "] Discovered.");
                            if (!_this.config.cache.has(request.address)) {
                                // If it's not already in cache, find windowStart.
                                _this.store(request);
                            }
                        };
                        reqFactory.watchRequestsByBucket(next.blockBucket, handleRequests);
                        reqFactory.watchRequestsByBucket(next.tsBucket, handleRequests);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verifies that a transaction request is valid.
     * @param {String} requestAddress Address of the transaction request.
     */
    Scanner.prototype.isCorrect = function (requestAddress) {
        // We hit the NULL_ADDRESS so there are no more transaction requests in the tracker.
        if (requestAddress === this.config.eac.Constants.NULL_ADDRESS) {
            // TODO: change this error message, it's old
            this.config.logger.debug('No new request discovered.');
            return false;
        }
        else if (!this.config.eac.Util.checkValidAddress(requestAddress)) {
            // This should, conceivably, never happen unless there is a bug in eac.js-lib.
            throw new Error("[" + requestAddress + "] Received invalid response from Request Tracker");
        }
        return true;
    };
    // @param request {Object} of form {address: 0xAF...34, uintArgs: uint[12]}
    Scanner.prototype.fill = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var txRequest;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.config.eac.transactionRequest(request.address)];
                    case 1:
                        txRequest = _a.sent();
                        txRequest.fillWithParams(request.uintArgs);
                        // await txRequest.fillData()
                        return [2 /*return*/, txRequest];
                }
            });
        });
    };
    /**
     * Scan is the main driver function of the Scanner class.
     * @param {Number} left The left bound to scan.
     * @param {Number} right The right bound to scan.
     * @param {String} firstRequest Address of a transaction request to start scanning from.
     * @param {Function} shouldStore A function taking windowStart and returning True is the transaction request should be stored.
     * @param {Function} atBound A function taking windowStart and returning True if scanning should continue and False if at bounds.
     * @param {Function} getNext A function taking the currentRequestAddress and returning the next request address.
     * @returns {void}
     */
    Scanner.prototype.scan = function (left, right, firstRequest, shouldStore, atBound, getNext) {
        return __awaiter(this, void 0, void 0, function () {
            var currentRequestAddress, windowStart, txRequest;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentRequestAddress = firstRequest;
                        // Return if NULL_ADDRESS and no new transaction requests found.
                        if (!this.isCorrect(currentRequestAddress))
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        if (!(currentRequestAddress !== this.config.eac.Constants.NULL_ADDRESS)) return [3 /*break*/, 5];
                        this.config.logger.debug("[" + currentRequestAddress + "] Discovered.");
                        windowStart = parseInt(this.config.cache.get(currentRequestAddress, -1));
                        if (!(windowStart === -1)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.fill(currentRequestAddress)];
                    case 2:
                        txRequest = _a.sent();
                        windowStart = txRequest.windowStart;
                        if (txRequest &&
                            shouldStore(windowStart) &&
                            this.isUpcoming(txRequest)) {
                            // If the windowStart returns True to `shouldStore(...)`, store it.
                            this.store(txRequest);
                        }
                        _a.label = 3;
                    case 3:
                        // always check if we already hit bounds
                        // TODO remove bounds -- no longer needed with the buckets
                        if (atBound(windowStart)) {
                            // Stop looping if we hit the bounds.
                            return [3 /*break*/, 5];
                        }
                        return [4 /*yield*/, getNext(currentRequestAddress)];
                    case 4:
                        // Get the next transaction request.
                        currentRequestAddress = _a.sent();
                        // Hearbeat
                        if (currentRequestAddress === this.config.eac.Constants.NULL_ADDRESS) {
                            this.config.logger.debug('No new requests discovered.');
                            return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    Scanner.prototype.scanCache = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allTxRequests;
            var _this = this;
            return __generator(this, function (_a) {
                if (this.config.cache.len() === 0)
                    return [2 /*return*/]; // nothing stored in cache
                allTxRequests = this.config.cache
                    .stored()
                    .filter(function (address) { return _this.config.cache.get(address) > 0; })
                    .map(function (address) { return _this.config.eac.transactionRequest(address); });
                // Get fresh data on our transaction requests and route them into appropiate action.
                Promise.all(allTxRequests).then(function (txRequests) {
                    txRequests.forEach(function (txRequest) {
                        txRequest
                            .refreshData()
                            .then(function () { return routing_js_1.routeTxRequest(_this.config, txRequest); });
                    });
                });
                return [2 /*return*/];
            });
        });
    };
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
        this.config.logger.info("[" + request.address + "] Storing.");
        this.config.cache.set(request.address, request.params[7]);
    };
    return Scanner;
}());
exports.default = Scanner;
