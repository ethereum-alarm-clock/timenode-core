import * as Web3 from 'web3';
import * as Web3WsProvider from 'web3-providers-ws';

const getWeb3FromProviderUrl = (providerUrl: string) => {
  const provider = (() => {
    if (new RegExp('http://').test(providerUrl) || new RegExp('https://').test(providerUrl)) {
      return new Web3.providers.HttpProvider(`${providerUrl}`);
    } else if (new RegExp('ws://').test(providerUrl) || new RegExp('wss://').test(providerUrl)) {
      const ws = new Web3WsProvider(`${providerUrl}`);
      ws.__proto__.sendAsync = ws.__proto__.send;
      return ws;
    }
  })();

  return new Web3(provider);
};

export { getWeb3FromProviderUrl };
