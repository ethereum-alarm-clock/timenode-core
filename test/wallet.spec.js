const { Wallet } = require('../index')
const { expect } = require('chai')
const Ganache = require('ganache-core')
const Web3 = require('web3')
const provider = Ganache.provider({
    "gasLimit": 7000000,
    "locked": false,
})
const web3 = new Web3(provider)

describe('Wallet', function () {
    this.timeout(5000)

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
        const [main] =  await web3.eth.getAccounts()
        const [walletIndexZero, walletIndexOne] = w.getAccounts()

        await web3.eth.sendTransaction({
            to: walletIndexZero.getAddressString(),
            from: main,
            value: web3.utils.toWei('2', 'ether')
        })

        const to = "0x14609A0e29b474BE534B5bcb06eAFcdC85864C8f"
        const txHash = await w.sendFromNext({
            to,
            value: web3.utils.toWei('50', 'gwei'),
            gas: '3000000',
            gasPrice: web3.utils.toWei('2', 'gwei'),
            data: new Buffer('0x006006006', 'hex')
        })
        expect(txHash).to.exist

        const bal = await web3.eth.getBalance(to)
        expect(bal.toString()).that.equal(web3.utils.toWei('50', 'gwei'))

        // For good measure, let's see if it can do that from account two
        await web3.eth.sendTransaction({
            to: walletIndexOne.getAddressString(),
            from: main,
            value: web3.utils.toWei('2', 'ether')
        })

        const txHash2 = await w.sendFromNext({
            to,
            value: web3.utils.toWei('50', 'gwei'),
            gas: '3000000',
            gasPrice: web3.utils.toWei('2', 'gwei'),
            data: new Buffer('0x006006006', 'hex')
        })
        expect(txHash2).to.exist

        const bal2 = await web3.eth.getBalance(walletIndexOne.getAddressString())
        expect(parseInt(bal2)).to.be.below(parseInt(web3.utils.toWei('2', 'ether'), 10))

        const bal3 = await web3.eth.getBalance(to)
        expect(bal3.toString()).to.equal(web3.utils.toWei('100', 'gwei'))
    })

    it('can send a transaction using sendFromIndex', async () => {
        const w = new Wallet(web3)
        w.create(5)

        // First fund the account we want to send a transaction from
        const [main] =  await web3.eth.getAccounts()
        const walletIndexFour = w.getAccounts()[4]

        await web3.eth.sendTransaction({
            to: walletIndexFour.getAddressString(),
            from: main,
            value: web3.utils.toWei('2', 'ether')
        })

        const to = "0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c"
        const txHash = await w.sendFromIndex(4, {
            to,
            value: web3.utils.toWei('50', 'gwei'),
            gas: '3000000',
            gasPrice: web3.utils.toWei('2', 'gwei'),
            data: new Buffer('0x006006006', 'hex')
        })
        expect(txHash).to.exist

        const bal = await web3.eth.getBalance(to)
        expect(bal).that.equal(web3.utils.toWei('50', 'gwei'))

        const bal2 = await web3.eth.getBalance(walletIndexFour.getAddressString())
        expect(parseInt(bal2)).to.be.above(0)
        expect(parseInt(bal2)).to.be.below(parseInt(web3.utils.toWei('2', 'ether'), 10))
    })

    // You need to create a wallet and set the PASSWORD env variable to make this test run
    it('loads a wallet from a saved keystore', () => {        
        const w = new Wallet(web3)
        const fs = require('fs')
        const keystores = fs.readFileSync(__dirname + '/keyz', 'utf-8')
        const ks = JSON.parse(keystores)
        w.decrypt(ks, process.env.PASSWORD)
        expect(w.length).to.equal(3)
    })
})