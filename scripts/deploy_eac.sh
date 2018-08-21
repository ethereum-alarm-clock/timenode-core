#!/bin/bash
echo "Deploying contracts..."
cd node_modules/@ethereum-alarm-clock/contracts
truffle network --clean
truffle migrate --reset
cd ../../../node_modules/eac.js-lib/

echo "Moving the generated contract files..."
rm -Rfv lib/build/*
cp -Rfv ../@ethereum-alarm-clock/contracts/build/* lib/build/
cp -fv ../@ethereum-alarm-clock/contracts/package.json lib/build/ethereum-alarm-clock.json

node ./extractContractsInfo.js development
mv -fv contracts.json lib/assets/development.json || true

echo "Done."