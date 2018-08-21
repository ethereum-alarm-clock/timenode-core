import * as Web3 from 'web3';
import * as Web3WsProvider from 'web3-providers-ws';

const getWeb3FromProviderUrl = (providerUrl: string) => {
  let provider: any;

  if (providerUrl.includes('http://') || providerUrl.includes('https://')) {
    provider = new Web3.providers.HttpProvider(providerUrl);
  } else if (providerUrl.includes('ws://') || providerUrl.includes('wss://')) {
    provider = new Web3WsProvider(providerUrl);
    provider.__proto__.sendAsync = provider.__proto__.sendAsync || provider.__proto__.send;
  }

  return new Web3(provider);
};

export { getWeb3FromProviderUrl };
