#!/bin/sh
cd node_modules/eac.js-lib/
git submodule init ethereum-alarm-clock
git submodule update
cd ethereum-alarm-clock && git checkout tags/1.0.0-beta.2 && cd ..
./deploy.sh
cd ../../