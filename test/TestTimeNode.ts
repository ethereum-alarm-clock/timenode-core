import { assert, expect } from 'chai';
import { TimeNode } from '../src/index';
import { mockConfig } from './helpers/mockConfig';
import { scheduleTestTx } from './TestScheduleTx';

const TIMENODE_ADDRESS = '0x487a54e1d033db51c8ee8c03edac2a0f8a6892c6';

describe('TimeNode', () => {
  const config = mockConfig();

  let timenode : TimeNode;

  it('starts a basic timenode', () => {
    timenode = new TimeNode(config);
    expect(timenode).to.exist;
  }).timeout(200000);

  it('starts scanning', async () => {
    await timenode.startScanning();
    expect(timenode.scanner.scanning).to.be.true;
  });

  /**
   * HOW TO RELIABLY RUN THIS TEST:
   *
   * CHANGE EAC.JS-LIB ENTRY TO ../eac.js-lib
   *
   * START GANACHE-CLI WITH NEW BLOCK TIME 1 SECOND
   *
   * IN eac.js-lib add line to deploy.sh
   * cp lib/assets/development.json lib/assets/tester.json
   * before done
   *
   * IN EAC.JS COMPILE AND RUN: `sh deploy.sh`
   *
   * NOW THIS TEST SHOULD PASS
   *
   * IF THIS WON'T PASS TRY TO RESTART TEST - SOMETIMES TIMENODE MIGHT NOT FIND SCHEDULED TX
   * PROBABLY THIS IS BECAUSE OF BUCKET ISSUES
   */
  it('claims transaction', async () => {
    const TEST_TX_ADDRESS = await scheduleTestTx();

    console.log('SCHEDULED TX ADDRESS TO CLAIM', TEST_TX_ADDRESS);

    const originalLoggerInfoMethod = timenode.config.logger.info;
    let claimedLogged = false;

    const { eac } = timenode.config;

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

          const TEST_TX_REQUEST = await eac.transactionRequest(TEST_TX_ADDRESS);

          await TEST_TX_REQUEST.fillData();

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

    console.log('SCHEDULED TX ADDRESS TO EXECUTE', TEST_TX_ADDRESS);

    const originalLoggerInfoMethod = timenode.config.logger.info;
    let executionLogged = false;

    const { eac } = timenode.config;

    timenode.config.logger.info = (msg: any) => {
      if (msg === `${TEST_TX_ADDRESS} executed`) {
        executionLogged = true;
      }
      originalLoggerInfoMethod(msg);
    }

    await new Promise(resolve => {
      const claimedLoggedInterval = setInterval(async () => {
        if (executionLogged) {
          timenode.stopScanning();

          clearInterval(claimedLoggedInterval);

          const TEST_TX_REQUEST = await eac.transactionRequest(TEST_TX_ADDRESS);

          await TEST_TX_REQUEST.fillData();

          await TEST_TX_REQUEST.refreshData();

          assert.ok(TEST_TX_REQUEST.wasCalled, `${TEST_TX_ADDRESS} hasn't been called!`);
          assert.ok(TEST_TX_REQUEST.wasSuccessful, `${TEST_TX_ADDRESS} isn't successful!`);

          resolve();
        }
      }, 1000);
    });

    assert.ok(executionLogged, `Execution of ${TEST_TX_ADDRESS} hasn't been logged.`);
  }).timeout(400000);

  // it('stops scanning', async () => {
  //   await this.timenode.stopScanning();
  //   expect(this.timenode.scanner.scanning).to.be.false;
  // })
})
