#!/usr/bin/env bash

function solc-err-only {
    solc "$@" 2>&1 | grep -A 2 -i "Error"
}

rm ../build/*
solc-err-only --overwrite --optimize --bin --abi ./SettableCurrencyRates.sol -o ../build/
solc-err-only --overwrite --optimize --bin --abi ./DebtTokenExchange.sol -o ../build/

solc-err-only --overwrite --optimize --bin --abi ./SmartBondMultipleInvestors.sol -o ../build/

solc-err-only --overwrite --optimize --bin --abi ./SmartBondRegister.sol -o ../build/

cd ../build

wc -c SettableCurrencyRates.bin | awk '{print "SettableCurrencyRates: " $1}'
wc -c DebtTokenExchange.bin | awk '{print "DebtTokenExchange: " $1}'

wc -c SmartBondMultipleInvestors.bin | awk '{print "SmartBondMultipleInvestors: " $1}'

wc -c SmartBondRegister.bin | awk '{print "SmartBondRegister: " $1}'
