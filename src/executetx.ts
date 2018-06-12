// const Web3 = require('web3');
// import
// const Web3WsProvider = require('web3-providers-ws');
import * as EAC from 'eac.js-lib';
import * as Bb from 'bluebird';
import { promisify } from 'util';
import { BigNumber } from 'bignumber.js';
import * as Web3 from 'web3';
import Config from '../src/Config';
import TimeNode from '../src/TimeNode';
import { ILogger } from './Logger';

// const provider = Ganache.provider({
//     "gasLimit": 7000000,
//     "locked": false,
// });

// console.log('web3', Web3);

const provider = new Web3.providers.HttpProvider('http://localhost:8545');

const web3 = new Web3(provider);

const eac = EAC(web3);

function calcEndowment(
  gasAmount = 0,
  amountToSend = 0,
  gasPrice = 0,
  fee = 0,
  payment = 0
) {
  gasAmount = gasAmount || 0;
  amountToSend = amountToSend || 0;
  gasPrice = gasPrice || 0;
  fee = fee || 0;
  payment = payment || 0;

  const {
    Util: { calcEndowment },
  } = eac;

  const endowment = calcEndowment(
    new BigNumber(gasAmount),
    new BigNumber(amountToSend),
    new BigNumber(gasPrice),
    new BigNumber(fee),
    new BigNumber(payment)
  );

  return endowment;
}

const main = async () => {
  // console.log(EACJSClient);
  const KOVAN_NETWORK_ID = 42;

  const scheduler = await eac.scheduler();

  const asyncGetBlock = promisify(web3.eth.getBlock);
  const getBlockNumber = () =>
    Bb.fromCallback((callback) => web3.eth.getBlockNumber(callback));

  // web3.eth.getBlock('latest', (err, result) => {
  //     console.log({
  //         lastBlock: result.number
  //     });
  // });

  const latestBlock = await getBlockNumber();
  console.log({
    latestBlock,
  });

  const mainAccount = web3.eth.accounts[0];

  console.log({
    mainAccount,
  });

  const toAddress = mainAccount;
  const callGas = 1000000;
  const callData = '';
  const callValue = 1;
  const windowSize = '255';
  const windowStart = latestBlock + 100;
  const gasPrice = 1;
  const fee = 0;
  const bounty = 0;
  const requiredDeposit = '0';
  const SCHEDULING_GAS_LIMIT = 4000000;

  const endowment = calcEndowment(callGas, callValue, gasPrice, fee, bounty);

  await scheduler.initSender({
    from: mainAccount,
    gas: SCHEDULING_GAS_LIMIT,
    value: endowment,
  });

  console.log('ATTEMPTING SCHEDULING');

  const scheduledTxReceipt = await scheduler.blockSchedule(
    toAddress,
    callGas,
    callData,
    callValue,
    windowSize,
    windowStart,
    gasPrice,
    fee,
    bounty,
    requiredDeposit,
    true
  );

  console.log('SCHEDULED TX', scheduledTxReceipt, scheduledTxReceipt.address);

  // const worker = new EacWorker();

  //   const timenodeKeystore = `{"version":3,"id":"cbc9f9b0-5244-4b2b-b54c-ef1f9aa2916e","address":"a724377a6cd3e0b4c6eeccd2f50647edc0bd05e1","Crypto":{"ciphertext":"07c65b649bc8ccdb97978e5a876738fb9e440b8529eee353484f0c22761db1db","cipherparams":{"iv":"1b12696db8c8b3d710788179963e8be6"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"f9b8f8524e058abf55a98e1cf9d4317220c5c541ccdf83433c106d76757b3373","n":8192,"r":8,"p":1},"mac":"b62771e9bbf7310fdb928e5829605faff72730ab412b78c92a9fbb20a7f5e626"}}`;
  //   const timenodeKeystorePassword = 'testtest1';

  const timenodePrivateKey =
    'fdf2e15fd858d9d81e31baa1fe76de9c7d49af0018a1322aa2b9e493b02afa26';
  const customProviderUrl =
    'wss://rarely-suitable-shark.quiknode.io/87817da9-942d-4275-98c0-4176eee51e1a/aB5gwSfQdN4jmkS65F1HyA==/';

  // console.log(worker.decrypt(timenodeKeystore));

  // network: KOVAN_NETWORK_ID,
  // customProviderUrl,
  // walletStores: [timenodeKeystore],
  // password: timenodeKeystorePassword,
  // logfile: 'console',
  // logLevel: 1,
  // milliseconds: 15000,
  // autostart: false,
  // scan: 950, // ~65min on kovan
  // repl: false,
  // browserDB: true

  const logger = {
    info(message) {
      console.debug('[INFO]: ' + message);
    },

    cache(message) {
      console.debug('[CACHE]: ' + message);
    },

    debug(message) {},

    error(message) {},
  };

  /*
      autostart: boolean;
  eac: any;
  economicStrategy?: IEconomicStrategy;
  factory?: any;
  logger: ILogger | null;
  ms?: any;
  password?: any;
  provider: any;
  scanSpread: number | null;
  walletStores?: any;
  web3: any;
    */
  const config = new Config({
    autostart: false,
    eac,
    // economicStategy: {},
    factory: '0x0',
    ms: 4000,
    password: 'testtest1',
    provider,
    scanSpread: 0,
    walletStores: [timenodePrivateKey],
    web3,
  });

  const alarmClient = new TimeNode(config);

  alarmClient.startScanning();
};

main();
