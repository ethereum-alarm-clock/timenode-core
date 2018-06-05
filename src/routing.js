const BigNumber = require('bignumber.js');
const hasPending = require('./pending.js');
const { Util } = require('eac.js-lib')();

const STATE = {
  PRE_CLAIMING: 0,
  CLAIMING: 1,
  PRE_EXECUTION: 2,
  EXECUTION: 3,
  DONE: 4,
};

let stateName = {};
stateName[STATE.DONE] = 'DONE';
stateName[STATE.PRE_CLAIMING] = 'PRE-CLAIMING';
stateName[STATE.CLAIMING] = 'CLAIMING';
stateName[STATE.PRE_EXECUTION] = 'PRE-EXECUTION';
stateName[STATE.EXECUTION] = 'EXECUTION';

const isClaimedByUs = (conf, txRequest) => {
  const ourClaim = conf.wallet
    ? conf.wallet.isKnownAddress(txRequest.claimedBy)
    : txRequest.isClaimedBy(conf.web3.eth.defaultAccount);

  if (!ourClaim)
    conf.logger.debug(
      `[${txRequest.address}] In reserve window and not claimed by our account.`
    );

  return ourClaim;
};

const getSender = (conf) =>
  conf.wallet ? conf.wallet.getAddresses()[0] : conf.web3.eth.defaultAccount;

const isProfitableToClaim = async (conf, txRequest, gasToClaim) => {
  const { web3 } = conf;
  const claimPaymentModifier = await txRequest.claimPaymentModifier();
  const paymentWhenClaimed = txRequest.bounty
    .times(claimPaymentModifier)
    .dividedToIntegerBy(100);

  const currentGasPrice = new BigNumber(await Util.getGasPrice(web3));
  const gasCostToClaim = currentGasPrice.times(gasToClaim);

  if (gasCostToClaim.greaterThan(paymentWhenClaimed)) {
    conf.logger.debug(
      `[${
        txRequest.address
      }] Not profitable to claim. gasCostToClaim: ${gasCostToClaim} | paymentWhenClaimed: ${paymentWhenClaimed}`
    );
    return { profitable: false, paymentWhenClaimed: 0 };
  }

  return { profitable: true, paymentWhenClaimed };
};

const sendTransaction = async (conf, txRequest, fn, options) => {
  const log = conf.logger;
  const { web3 } = conf;

  if (await hasPending(conf, txRequest)) {
    log.info(
      `[${
        txRequest.address
      }] Ignoring txRequest with pending transaction in the transaction pool.`
    );
    return { ignore: true };
  }

  if (conf.wallet) {
    return conf.wallet.sendFromNext(options);
  }

  const ops = Object.assign(options, { from: web3.eth.defaultAccount });
  return {
    receipt: await fn(ops),
    from: web3.eth.defaultAccount,
  };
};

const claim = async (conf, txRequest) => {
  const log = conf.logger;
  const { web3 } = conf;
  const ignore = { ignore: true };

  // All the checks have been done in routing, now we follow through on the actions.
  const value = txRequest.requiredDeposit;
  const data = txRequest.claimData;
  const sender = getSender(conf);
  const gasToClaim = await Util.estimateGas(web3, {
    from: sender,
    to: txRequest.address,
    value: value.toString(),
    data,
  });

  const { profitable, paymentWhenClaimed } = await isProfitableToClaim(
    conf,
    txRequest,
    gasToClaim
  );
  if (!profitable) return ignore;

  // The dice roll was originally implemented in the Python client, which I followed
  // for inspiration here.
  const diceRoll = Math.floor(Math.random() * 100);

  if (diceRoll >= (await txRequest.claimPaymentModifier())) {
    log.debug(`Fate insists you wait until later.`);
    return ignore;
  }

  log.info(
    `[${
      txRequest.address
    }] Attempting the claim | Payment: ${paymentWhenClaimed}`
  );

  const gas = gasToClaim + 21000;
  const gasPrice = await Util.getGasPrice(web3);
  const options = {
    to: txRequest.address,
    value,
    gas,
    gasPrice,
    data,
  };

  return sendTransaction(
    conf,
    txRequest,
    (opt) => txRequest.claim(opt),
    options
  );
};

const execute = async (conf, txRequest) => {
  const log = conf.logger;
  const { web3 } = conf;

  const getBlock = () => {
    return new Promise((resolve) => {
      web3.eth.getBlock('latest', (err, res) => {
        if (!err) resolve(res);
      });
    });
  };

  // txRequest.callGas + 180000 is the exact amount of gas needed by the transaction
  // to execute, however delegate call only recieves 63/64 of the total gas sent
  // so we send a bit extra
  const executeGas = txRequest.callGas
    .add(180000)
    .div(64)
    .times(65)
    .round();
  const gasLimit = new BigNumber((await getBlock()).gasLimit);

  const { gasPrice } = txRequest;

  if (executeGas.greaterThan(gasLimit)) {
    return new Error(
      `[${txRequest.address}] Execution gas exceeds the network gas limit.`
    );
  }

  log.info(`[${txRequest.address}] Attempting the execution.`);

  const executeData = txRequest.executeData;
  const walletClaimIndex = conf.wallet
    ? conf.wallet.getAddresses().indexOf(txRequest.claimedBy)
    : -1;
  const options = {
    to: txRequest.address,
    gas: executeGas,
    gasPrice,
    data: executeData,
    value: 0,
  };

  if (walletClaimIndex !== -1) {
    return conf.wallet.sendFromIndex(walletClaimIndex, options);
  }

  return sendTransaction(
    conf,
    txRequest,
    (opt) => txRequest.execute(opt),
    options
  );
};

const cleanup = async (conf, txRequest) => {
  // const log = conf.logger
  const { web3 } = conf;

  const txRequestBalance = await txRequest.getBalance();

  // If a transaction request has been executed it will route into this option.
  if (txRequestBalance.equals(0)) {
    conf.cache.set(txRequest.address, 0);
    return;
  }

  if (!txRequest.isCancelled) {
    const sender = getSender(conf);
    const gasToCancel = await Util.estimateGas(web3, {
      from: sender,
      to: txRequest.address,
      value: '0',
      data: txRequest.cancelData,
    });
    const currentGasPrice = new BigNumber(await Util.getGasPrice(web3));
    const gasCostToCancel = currentGasPrice.times(gasToCancel);
    const opts = {
      to: txRequest.address,
      value: 0,
      gas: gasToCancel + 21000,
      gasPrice: await web3.eth.getGasPrice(),
      data: txRequest.cancelData,
    };

    if (conf.wallet) {
      const ownerIndex = conf.wallet.getAddresses().indexOf(txRequest.owner);
      if (ownerIndex !== -1) {
        await conf.wallet.sendFromIndex(ownerIndex, opts);
      } else {
        // The more likely scenario is that one of our accounts is not the
        // owner of the expired transaction in which case, we check to see
        // if we will not lost money for sending this transaction then send
        // it from any account.
        if (gasCostToCancel.greaterThan(txRequestBalance)) {
          // The transaction request does not have enough money to compensate.
          return;
        }
        await conf.wallet.sendFromNext(opts);
      }
    } else {
      if (txRequest.isClaimedBy(web3.eth.defaultAccount)) {
        await txRequest.cancel({
          from: web3.eth.defaultAccount,
          value: 0,
          gas: gasToCancel + 21000,
          gasPrice: await Util.getGasPrice(web3),
        });
      } else {
        if (gasCostToCancel.greaterThan(txRequestBalance)) {
          return;
        }
        await txRequest.cancel({
          from: web3.eth.defaultAccount,
          value: 0,
          gas: gasToCancel + 21000,
          gasPrice: await Util.getGasPrice(web3),
        });
      }
    }
  }
  // Set all requests that make it here ready for deletion.
  conf.cache.del(txRequest.address);
};

const isExecuted = (receipt) => {
  if (receipt) {
    const executedEvent =
      '0x3e504bb8b225ad41f613b0c3c4205cdd752d1615b4d77cd1773417282fcfb5d9';
    return receipt.logs[0].topics.indexOf(executedEvent) > -1;
  }

  return false;
};

const preClaimingState = async (conf, txRequest) => {
  const log = conf.logger;
  const self = STATE.PRE_CLAIMING;
  const next = STATE.CLAIMING;

  // Return early if the transaction request has been cancelled
  if (txRequest.isCancelled) {
    log.debug(`[${txRequest.address}] Ignorning already cancelled txRequest.`);
    return STATE.DONE;
  }

  // Return early if the transaction request is before claim window,
  // and therefore not actionable upon
  if (await txRequest.beforeClaimWindow()) {
    log.debug(`[${txRequest.address}] Ignoring txRequest not in claim window.`);
    return self;
  }

  return next;
};

const doneState = async (conf, txRequest) => {
  cleanup(conf, txRequest);
  return STATE.DONE;
};

const claimingState = async (conf, txRequest) => {
  const log = conf.logger;
  const next = STATE.PRE_EXECUTION;

  if (txRequest.isClaimed) {
    log.debug(
      `[${txRequest.address}] TxRequest in claimWindow but is already claimed.`
    );
    return next;
  }

  try {
    const { receipt, from, ignore } = await claim(conf, txRequest);

    if (receipt && receipt.status == 1) {
      const gas = receipt.gasUsed * txRequest.data.txData.gasPrice;

      log.info(`[${txRequest.address}] Claimed!`);
      conf.statsdb.updateClaimed(from, gas);
    } else if (!receipt && !ignore) {
      log.error(`[${txRequest.address}] Claiming failed.`);
    }
  } catch (err) {
    log.error(err);
  }

  return next;
};

const preExecutionState = async (conf, txRequest) => {
  const log = conf.logger;
  const self = STATE.PRE_EXECUTION;
  const next = STATE.EXECUTION;

  if (await txRequest.inFreezePeriod()) {
    log.debug(
      `[${
        txRequest.address
      }] Ignoring frozen txRequest. Now ${await txRequest.now()} | Window start: ${
        txRequest.windowStart
      }`
    );
    return self;
  }
  if (!(await txRequest.inExecutionWindow())) {
    return self;
  }

  return next;
};

const executionState = async (conf, txRequest) => {
  const log = conf.logger;
  const { web3 } = conf;
  const self = STATE.EXECUTION;
  const next = STATE.DONE;

  if (txRequest.wasCalled) {
    log.debug(`[${txRequest.address}] Already called.`);
    return next;
  }

  if ((await txRequest.inReservedWindow()) && !isClaimedByUs(conf, txRequest)) {
    return self;
  }

  try {
    const { receipt, from, ignore } = await execute(conf, txRequest);
    if (ignore) return self;

    if (receipt && receipt.status == 1) {
      if (isExecuted(receipt)) {
        const data = receipt.logs[0].data;
        const timeBounty = web3.toDecimal(data.slice(0, 66));

        log.info(`[${txRequest.address}] Executed.`);

        conf.statsdb.updateExecuted(from, timeBounty, 0);

        return next;
      } else {
        log.info(
          `[${
            txRequest.address
          }] Execution failed. Transaction already executed.`
        );
      }
    } else {
      log.error(`[${txRequest.address}] Execution failed.`);
    }

    const txCost = receipt.gasUsed * txRequest.data.txData.gasPrice;
    conf.statsdb.updateExecuted(from, 0, txCost);
  } catch (err) {
    log.error(err);
  }

  return next;
};

let state = {};
state[STATE.DONE] = doneState;
state[STATE.PRE_CLAIMING] = preClaimingState;
state[STATE.CLAIMING] = claimingState;
state[STATE.PRE_EXECUTION] = preExecutionState;
state[STATE.EXECUTION] = executionState;

const txRequestState = {};

/**
 * Takes in a txRequest object and routes it to the thread that will act on it,
 * or returns if no action can be taken.
 * @param {Config} conf
 * @param {TxRequest} txRequest
 * @returns {STATE} nextState
 */
const routeTxRequest = async (conf, txRequest) => {
  const log = conf.logger;
  let currentState = txRequestState[txRequest.address] || STATE.PRE_CLAIMING;

  let transition = true;
  let nextState;

  while (transition) {
    nextState = await state[currentState](conf, txRequest);
    transition = nextState !== currentState;

    log.debug(
      `[${txRequest.address}] State transition ${stateName[currentState]} -> ${
        stateName[nextState]
      }`
    );

    currentState = nextState;
  }

  txRequestState[txRequest.address] = nextState;
  return nextState;
};

module.exports = { routeTxRequest, STATE };
