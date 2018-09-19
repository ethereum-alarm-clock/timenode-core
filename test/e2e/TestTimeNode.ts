import { assert, expect } from 'chai';
import { TimeNode, Config } from '../../src/index';
import { mockConfig } from '../helpers';
import { scheduleTestTx } from './TestScheduleTx';
import { getHelperMethods } from '../helpers/Helpers';

const TIMENODE_ADDRESS = '0x487a54e1d033db51c8ee8c03edac2a0f8a6892c6';

describe('TimeNode', () => {
  let config: Config;
  let myAccount: string;
  let eac: any;
  let web3: any;
  let waitUntilBlock: any;
  let withSnapshotRevert: any;
  let timeNode: TimeNode;

  before(async () => {
    config = await mockConfig();
    myAccount = config.wallet.getAddresses()[0];
    eac = config.eac;
    web3 = config.web3;

    const helpers = getHelperMethods(web3);
    waitUntilBlock = helpers.waitUntilBlock;
    withSnapshotRevert = helpers.withSnapshotRevert;

    timeNode = new TimeNode(config);
  });

  it('starts a basic timenode', () => {
    expect(timeNode.scanner.scanning).to.equal(false);
  }).timeout(200000);

  it('starts scanning', async () => {
    await timeNode.startScanning();
    expect(timeNode.scanner.scanning).to.equal(true);
    timeNode.stopScanning();
  });

  if (process.env.RUN_ONLY_OPTIONAL_TESTS === 'true') {
    it('executes 20 transactions', async () => {
      const TRANSACTIONS_TO_SCHEDULE = 30;
      const scheduledTransactionsMap = {};

      for (let i = 0; i < TRANSACTIONS_TO_SCHEDULE; i++) {
        const transactionAddress: string = await scheduleTestTx();

        scheduledTransactionsMap[transactionAddress] = {
          executionLogged: false
        };
      }

      const firstScheduledTransactionAddress = Object.keys(scheduledTransactionsMap)[0];
      const firstScheduledTransaction = await eac.transactionRequest(
        firstScheduledTransactionAddress
      );

      await firstScheduledTransaction.fillData();

      const firstExecutionBlock =
        firstScheduledTransaction.windowStart.toNumber() +
        firstScheduledTransaction.freezePeriod.toNumber() +
        100;

      await waitUntilBlock(0, firstExecutionBlock);

      console.log('SCHEDULED TX ADDRESSES TO EXECUTE', scheduledTransactionsMap);

      timeNode.startScanning();

      timeNode.config.logger.info = (msg: any, txRequest: string) => {
        if (msg.includes && msg.includes('EXECUTED')) {
          if (scheduledTransactionsMap[txRequest]) {
            scheduledTransactionsMap[txRequest].executionLogged = true;
          }
        }
        console.log(txRequest, msg);
      };

      let allExecutionsLogged = false;

      await new Promise(resolve => {
        const allExecutionsLoggedCheckInterval = setInterval(async () => {
          for (const txAddress in scheduledTransactionsMap) {
            if (!scheduledTransactionsMap.hasOwnProperty(txAddress)) {
              continue;
            }

            allExecutionsLogged =
              scheduledTransactionsMap[txAddress] &&
              scheduledTransactionsMap[txAddress].executionLogged;
          }

          if (allExecutionsLogged) {
            timeNode.stopScanning();

            for (const transactionAddress in scheduledTransactionsMap) {
              if (!scheduledTransactionsMap.hasOwnProperty(transactionAddress)) {
                continue;
              }

              const transactionRequest = await eac.transactionRequest(transactionAddress);

              await transactionRequest.fillData();

              assert.ok(transactionRequest.wasCalled, `${transactionAddress} hasn't been called!`);
              assert.ok(
                transactionRequest.wasSuccessful,
                `${transactionAddress} isn't successful!`
              );
            }

            clearInterval(allExecutionsLoggedCheckInterval);

            resolve();
          }
        }, 1000);
      });

      assert.ok(
        allExecutionsLogged,
        `All transactions' executions should be logged, but they weren't.`
      );

      console.log('FINAL STATUS OF MASS TX EXECUTION:', scheduledTransactionsMap);
    }).timeout(400000);
  } else {
    it('claims and executes transaction', async () => {
      await withSnapshotRevert(async () => {
        await timeNode.startScanning();

        const TEST_TX_ADDRESS = await scheduleTestTx();
        const TEST_TX_REQUEST = await eac.transactionRequest(TEST_TX_ADDRESS);

        await TEST_TX_REQUEST.fillData();

        console.log('SCHEDULED TX ADDRESS TO CLAIM', TEST_TX_ADDRESS);

        const originalLoggerInfoMethod = timeNode.config.logger.info;
        let claimedLogged = false;
        let executionLogged = false;

        timeNode.config.logger.info = (msg: any, txRequest: string) => {
          if (msg === 'CLAIMED.' && txRequest === TEST_TX_ADDRESS) {
            claimedLogged = true;
          }
          if (msg === 'EXECUTED.' && txRequest === TEST_TX_ADDRESS) {
            executionLogged = true;
          }
          console.log(txRequest, msg);
        };

        await new Promise(resolve => {
          const logInterval = setInterval(async () => {
            if (claimedLogged) {
              claimedLogged = false;

              await TEST_TX_REQUEST.refreshData();

              assert.ok(TEST_TX_REQUEST.isClaimed, `${TEST_TX_ADDRESS} hasn't been claimed!`);
              expect(TEST_TX_REQUEST.address).to.equal(TEST_TX_ADDRESS);
              expect(TEST_TX_REQUEST.claimData).to.equal('0x4e71d92d');
              expect(TEST_TX_REQUEST.claimedBy).to.equal(TIMENODE_ADDRESS);
              expect(timeNode.getClaimedNotExecutedTransactions()[myAccount]).to.include(
                TEST_TX_ADDRESS
              );
            }
            if (executionLogged) {
              timeNode.stopScanning();

              clearInterval(logInterval);

              await TEST_TX_REQUEST.refreshData();

              assert.ok(TEST_TX_REQUEST.wasCalled, `${TEST_TX_ADDRESS} hasn't been called!`);
              assert.ok(TEST_TX_REQUEST.wasSuccessful, `${TEST_TX_ADDRESS} isn't successful!`);

              expect(timeNode.getClaimedNotExecutedTransactions()[myAccount]).to.not.include(
                TEST_TX_ADDRESS
              );

              timeNode.config.logger.info = originalLoggerInfoMethod;

              resolve();
            }
          }, 1000);
        });

        assert.ok(claimedLogged, `Claiming of ${TEST_TX_ADDRESS} hasn't been logged.`);
      });
    }).timeout(400000);
  }
});
