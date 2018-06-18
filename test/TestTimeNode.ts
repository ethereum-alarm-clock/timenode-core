import { assert, expect } from 'chai';
import { TimeNode } from '../src/index';
import { mockConfig } from './helpers/mockConfig';
import { scheduleTestTx, getHelperMethods } from './TestScheduleTx';

describe('TimeNode', () => {
  const config = mockConfig();

  const { web3 } = config;

  const { waitUntilBlock } = getHelperMethods(web3);

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
   * IN EAC.JS COMPILE AND RUN: `sh deploy.sh`
   *
   * NOW THIS TEST SHOULD PASS
   *
   * IF THIS WON'T PASS TRY TO RESTART TEST - SOMETIMES TIMENODE MIGHT NOT FIND SCHEDULED TX
   * PROBABLY THIS IS BECAUSE OF BUCKET ISSUES
   */
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

          resolve();
        }
      }, 1000);
    });

    assert.ok(claimedLogged, `Claiming of ${TEST_TX_ADDRESS} hasn't been logged.`);
  }).timeout(40000);

  // it('stops scanning', async () => {
  //   await this.timenode.stopScanning();
  //   expect(this.timenode.scanner.scanning).to.be.false;
  // })
})
