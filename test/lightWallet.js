const { LightWallet } = require("../index")
const Promise = require('bluebird')
const expect = require("chai").expect
const Ganache = require('ganache-core')
const Web3 = require("web3")
const provider = Ganache.provider({
    "gasLimit": 7000000,
    "locked": false,
})
const web3 = new Web3(provider)
const eth = Promise.promisifyAll(web3.eth)

describe("Light Wallet", () => {

	it("Ensures that can create a wallet with 5 accounts", async () => {
    const lightWallet = new LightWallet(web3)
    await lightWallet.create("test", 5)

    expect(lightWallet.getAccounts().length).to.be.equal(5)
  })

  it("Ensures that can send transction from 1st account", async () => {
    const lightWallet = new LightWallet(web3)
    await lightWallet.create("test", 5)

    const to = lightWallet.getAccounts()[0]
    const getAccounts = Promise.promisify(web3.eth.getAccounts)
    const from = (await getAccounts())[0]

    const sendTransaction = Promise.promisify(web3.eth.sendTransaction)
    await sendTransaction({
      to,
      from,
      value: web3.toWei(1, 'ether')
    })

    const getBalance = Promise.promisify(web3.eth.getBalance)
    const senderBalanceBefore = await getBalance(from)
    const sendBackAmount = web3.toWei(0.5, 'ether')

    await lightWallet.sendFromIndex(0, from, sendBackAmount, 21000, web3.toWei(100, 'gwei'), '')
    
    const senderBalanceAfter = await getBalance(from)
    const expectedBalanceAfter = senderBalanceBefore.add(sendBackAmount)
    
    expect(senderBalanceAfter.equals(expectedBalanceAfter)).to.be.true
  })

  it("Ensures that cannot send transction from not funded account", async () => {
    const lightWallet = new LightWallet(web3)
    await lightWallet.create("test", 5)

    const to = lightWallet.getAccounts()[0]
    const getAccounts = Promise.promisify(web3.eth.getAccounts)
    const from = (await getAccounts())[0]
    
    it('should throw an error', async () => {
      await expect(lightWallet.sendFromIndex(0, from, 1, 21000, web3.toWei(100, 'gwei'), '')).to.be.rejected
    })
  })
})