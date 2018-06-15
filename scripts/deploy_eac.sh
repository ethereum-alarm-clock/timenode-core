#!/bin/sh
cd node_modules/eac.js-lib/
git submodule init ethereum-alarm-clock
git submodule update
./deploy.sh
cd ../../