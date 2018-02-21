const { Wallet } = require('../index')
const { expect } = require('chai')
const Ganache = require('ganache-core')
const Web3 = require('web3')
const provider = Ganache.provider({
    "gasLimit": 7000000,
    "locked": false,
})
const web3 = new Web3(provider)
const Promise = require('bluebird')

describe('Wallet', () => {
    it('creates a wallet with the correct number of accounts', () => {
        const w = new Wallet(web3)
        w.create(5)
        expect(w.length).to.equal(5)
    })

    it('returns the expected indexes from _currentIndexes', () => {
        const w = new Wallet(web3)
        w.create(5)

        const res = w._currentIndexes()
        expect(res).to.eql([
            0,
            1,
            2,
            3,
            4,
        ])

        // Test taking one away
        w.rm(2)
        const res2 = w._currentIndexes()
        expect(res2).to.eql([
            0,
            1,
            3,
            4,
        ])
    })

    it('can send a transaction using sendFromNext', async () => {
        const w = new Wallet(web3)
        w.create(5)

        // First fund the account we want to send a transaction from
        const getAccounts = Promise.promisify(web3.eth.getAccounts)
        const [main] =  await getAccounts()
        const [walletIndexZero, walletIndexOne] = w.getAccounts()

        const sendTx = Promise.promisify(web3.eth.sendTransaction)
        await sendTx({
            to: walletIndexZero.getAddressString(),
            from: main,
            value: web3.toWei('2', 'ether')
        })

        const to = "0x14609A0e29b474BE534B5bcb06eAFcdC85864C8f"
        const txHash = await w.sendFromNext({
            to,
            value: web3.toWei('50', 'gwei'),
            gas: '3000000',
            gasPrice: web3.toWei('2', 'gwei'),
            data: new Buffer('0x006006006', 'hex')
        })
        expect(txHash).to.exist

        const getBalance = Promise.promisify(web3.eth.getBalance)
        const bal = await getBalance(to)
        expect(bal.toString()).that.equal(web3.toWei('50', 'gwei'))

        // For good measure, let's see if it can do that from account two
        await sendTx({
            to: walletIndexOne.getAddressString(),
            from: main,
            value: web3.toWei('2', 'ether')
        })

        const txHash2 = await w.sendFromNext({
            to,
            value: web3.toWei('50', 'gwei'),
            gas: '3000000',
            gasPrice: web3.toWei('2', 'gwei'),
            data: new Buffer('0x006006006', 'hex')
        })
        expect(txHash2).to.exist

        const bal2 = await getBalance(walletIndexOne.getAddressString())
        expect(bal2.toNumber()).to.be.below(parseInt(web3.toWei('2', 'ether'), 10))

        const bal3 = await getBalance(to)
        expect(bal3.toString()).to.equal(web3.toWei('100', 'gwei'))
    })

    it('can send a transaction using sendFromIndex', async () => {
        const w = new Wallet(web3)
        w.create(5)

        // First fund the account we want to send a transaction from
        const getAccounts = Promise.promisify(web3.eth.getAccounts)
        const [main] =  await getAccounts()
        const walletIndexFour = w.getAccounts()[4]

        const sendTx = Promise.promisify(web3.eth.sendTransaction)
        await sendTx({
            to: walletIndexFour.getAddressString(),
            from: main,
            value: web3.toWei('2', 'ether')
        })

        const to = "0x25609A0e29b474BE534B5bcb06eAFcdC85864C8f"
        const txHash = await w.sendFromIndex(4, {
            to,
            value: web3.toWei('50', 'gwei'),
            gas: '3000000',
            gasPrice: web3.toWei('2', 'gwei'),
            data: new Buffer('0x006006006', 'hex')
        })
        expect(txHash).to.exist

        const getBalance = Promise.promisify(web3.eth.getBalance)
        const bal = await getBalance(to)
        expect(bal.toString()).that.equal(web3.toWei('50', 'gwei'))

        const bal2 = await getBalance(walletIndexFour.getAddressString())
        expect(bal2.toNumber()).to.be.above(0)
        expect(bal2.toNumber()).to.be.below(parseInt(web3.toWei('2', 'ether'), 10))
    })
})