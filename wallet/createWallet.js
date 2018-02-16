const LightWallet = require('../client/lightWallet.js')

const createWallet = async (web3, num, file, password) => {
  const wallet = new LightWallet(web3)
  await wallet.create(password, num)

  console.log(`
New wallet created!
Accounts:
${wallet.getAccounts().join('\n')}
Saving encrypted file to ${file}. Don't forget your password!`)

    wallet.encryptAndStore(file)
}

module.exports = createWallet
