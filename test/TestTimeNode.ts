import { assert, expect } from 'chai';
import { TimeNode } from '../src/index';
import { mockConfig } from './helpers/mockConfig';
import { scheduleTestTx, getHelperMethods } from './TestScheduleTx';

const TIMENODE_ADDRESS = '0x487a54e1d033db51c8ee8c03edac2a0f8a6892c6';

describe('TimeNode', () => {
  const config = mockConfig();

  const { eac, web3 } = config;

  const { waitUntilBlock } = getHelperMethods(web3);

  let timenode : TimeNode;

  it('starts a basic timenode', () => {
    timenode = new TimeNode(config);
    expect(timenode).to.exist;
    expect(timenode.scanner.scanning).to.be.false;
  }).timeout(200000);

  it('starts scanning', async () => {
    await timenode.startScanning();
    expect(timenode.scanner.scanning).to.be.true;
  });

  if (process.env.RUN_ONLY_OPTIONAL_TESTS === 'true') {
    it('executes 20 transactions', async () => {
      const TRANSACTIONS_TO_SCHEDULE = 30;
      const scheduledTransactionsMap = {};

      for (let i = 0; i < TRANSACTIONS_TO_SCHEDULE; i++) {
        const transactionAddress : string = await scheduleTestTx();

        scheduledTransactionsMap[transactionAddress] = {
          executionLogged: false
        };
      }

      const firstScheduledTransactionAddress = Object.keys(scheduledTransactionsMap)[0];
      const firstScheduledTransaction = await eac.transactionRequest(firstScheduledTransactionAddress);

      await firstScheduledTransaction.fillData();

      const firstExecutionBlock = firstScheduledTransaction.windowStart.toNumber() + firstScheduledTransaction.freezePeriod.toNumber() + 100;

      await waitUntilBlock(0, firstExecutionBlock);

      console.log('SCHEDULED TX ADDRESSES TO EXECUTE', scheduledTransactionsMap);

      timenode.startScanning();

      const originalLoggerInfoMethod = timenode.config.logger.info;

      timenode.config.logger.info = (msg: any) => {
        if (msg.includes && msg.includes('executed')) {
          const executedTransactionAddress = msg.split(' executed')[0];

          if (scheduledTransactionsMap[executedTransactionAddress]) {
            scheduledTransactionsMap[executedTransactionAddress].executionLogged = true;
          }
        }
        originalLoggerInfoMethod(msg);
      }

      let allExecutionsLogged = false;

      await new Promise(resolve => {
        const allExecutionsLoggedCheckInterval = setInterval(async () => {

          for (const txAddress in scheduledTransactionsMap) {
            allExecutionsLogged = scheduledTransactionsMap[txAddress] && scheduledTransactionsMap[txAddress].executionLogged;
          }

          if (allExecutionsLogged) {
            timenode.stopScanning();

            for (const transactionAddress in scheduledTransactionsMap) {
              const transactionRequest = await eac.transactionRequest(transactionAddress);

              await transactionRequest.fillData();

              assert.ok(transactionRequest.wasCalled, `${transactionAddress} hasn't been called!`);
              assert.ok(transactionRequest.wasSuccessful, `${transactionAddress} isn't successful!`);
            }

            clearInterval(allExecutionsLoggedCheckInterval);

            resolve();
          }
        }, 1000);
      });

      assert.ok(allExecutionsLogged, `All transactions' executions should be logged, but they weren't.`);

      console.log('FINAL STATUS OF MASS TX EXECUTION:', scheduledTransactionsMap);
    }).timeout(400000);
  } else {
    it('claims transaction', async () => {
      const { eac } = timenode.config;

      const TEST_TX_ADDRESS = await scheduleTestTx();
      const TEST_TX_REQUEST = await eac.transactionRequest(TEST_TX_ADDRESS);

      await TEST_TX_REQUEST.fillData();

      const firstClaimBlock = TEST_TX_REQUEST.windowStart.toNumber() - TEST_TX_REQUEST.freezePeriod.toNumber() - TEST_TX_REQUEST.claimWindowSize.toNumber();

      await waitUntilBlock(0, firstClaimBlock);

      console.log('SCHEDULED TX ADDRESS TO CLAIM', TEST_TX_ADDRESS);

      const originalLoggerInfoMethod = timenode.config.logger.info;
      let claimedLogged = false;


      timenode.config.logger.info = (msg: any) => {
        if (msg === `${TEST_TX_ADDRESS} claimed`) {
          claimedLogged = true;
        }
        originalLoggerInfoMethod(msg);
      }

      await new Promise(resolve => {
        const claimedLoggedInterval = setInterval(async () => {
          if (claimedLogged) {
            timenode.stopScanning();

            clearInterval(claimedLoggedInterval);

            await TEST_TX_REQUEST.refreshData();

            assert.ok(TEST_TX_REQUEST.isClaimed, `${TEST_TX_ADDRESS} hasn't been claimed!`);
            expect(TEST_TX_REQUEST.address).to.equal(TEST_TX_ADDRESS);
            expect(TEST_TX_REQUEST.claimData).to.equal('0x4e71d92d');
            expect(TEST_TX_REQUEST.claimedBy).to.equal(TIMENODE_ADDRESS);

            resolve();
          }
        }, 1000);
      });

      assert.ok(claimedLogged, `Claiming of ${TEST_TX_ADDRESS} hasn't been logged.`);
    }).timeout(30000);

    it('executes transaction', async () => {
      const TEST_TX_ADDRESS = await scheduleTestTx();

      timenode.startScanning();

      const TEST_TX_REQUEST = await eac.transactionRequest(TEST_TX_ADDRESS);

      await TEST_TX_REQUEST.fillData();

      const firstExecutionBlock = TEST_TX_REQUEST.windowStart.toNumber() + TEST_TX_REQUEST.freezePeriod.toNumber() + 20;

      await waitUntilBlock(0, firstExecutionBlock);

      console.log('SCHEDULED TX ADDRESS TO EXECUTE', TEST_TX_ADDRESS);

      const originalLoggerInfoMethod = timenode.config.logger.info;
      let executionLogged = false;

      timenode.config.logger.info = (msg: any) => {
        if (msg === `${TEST_TX_ADDRESS} executed`) {
          executionLogged = true;
        }
        originalLoggerInfoMethod(msg);
      }

      await new Promise(resolve => {
        const executionLoggedInterval = setInterval(async () => {
          if (executionLogged) {
            timenode.stopScanning();

            clearInterval(executionLoggedInterval);

            await TEST_TX_REQUEST.refreshData();

            assert.ok(TEST_TX_REQUEST.wasCalled, `${TEST_TX_ADDRESS} hasn't been called!`);
            assert.ok(TEST_TX_REQUEST.wasSuccessful, `${TEST_TX_ADDRESS} isn't successful!`);

            resolve();
          }
        }, 1000);
      });

      assert.ok(executionLogged, `Execution of ${TEST_TX_ADDRESS} hasn't been logged.`);
    }).timeout(400000);
  }

})
