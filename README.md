[<img src="https://s3.amazonaws.com/chronologic.network/ChronoLogic_logo.svg" width="128px">](https://github.com/chronologic)

[![npm version](https://badge.fury.io/js/timenode-core.svg)](https://badge.fury.io/js/timenode-core)

[![Greenkeeper badge](https://badges.greenkeeper.io/ethereum-alarm-clock/timenode-core.svg)](https://greenkeeper.io/)

# timenode-core

This package contains all of the key logic necessary for the operation of an [Ethereum Alarm Clock](https://github.com/ethereum-alarm-clock/ethereum-alarm-clock) TimeNode. 

## Contribute

If you would like to hack on `timenode-core` or notice a bug, please open an issue or come find us on the Ethereum Alarm Clock Gitter channel and tell us. If you're feeling more ambitious and would like to contribute directly via a pull request, that's cool too. We will review all pull requests and issues opened on this repository. Even if you think something isn't working right or that it should work another way, we would really appreciate if you helped us by opening an issue!

## How to Build

If you decide to contribute then you will be working on the TypeScript files in the `src/` directory. However, we don't export these files to the world, but we transpile them down to ES5 first. We do this by initiating the TypeScript compiler.

But, you can use the scripts provided in the `package.json` file to help you build the files.

```
npm run build
```

It will produce an `index.js` file which can be imported into any project and used.

## Test
```
npm run test
```

## How to Lint

You can use one of the helper scripts to use [Prettier]() to lint for you. It will create backups of all the files that it changes before changing them, and knows how to handle both JavaScript and TypeScript sources.

``` 
npm run fmt
```

You can clean the backups files that are created like so:

```
npm run clean-backups
```

## Want more?

This package is a part of EAC.JS family ~
* [EAC.JS-LIB](https://github.com/ethereum-alarm-clock/eac.js-lib)
* [timenode-core](https://github.com/ethereum-alarm-clock/timenode-core)
* [cli](https://github.com/ethereum-alarm-clock/cli)
