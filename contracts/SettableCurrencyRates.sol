pragma solidity ^0.4.21;


import "./CurrencyRatesProvider.sol";
import "./Ownable.sol";
import "./SafeMath.sol";


contract SettableCurrencyRates is CurrencyRatesProvider, Ownable {
    using SafeMath for uint256;

    mapping (string => uint256) rates;

    constructor() public {

    }

    function getCurrencyRate(string currency) public view returns (uint256) {
        require(rates[currency] > 0);

        return rates[currency];
    }

    function setCurrencyRate(string currency, uint256 weiForCurrencyUnit) public returns (bool) {
        // rateInWei == 0 means disabling the currency
        require(weiForCurrencyUnit >= 0);

        rates[currency] = weiForCurrencyUnit;

        emit StoreCurrencyRate(currency, weiForCurrencyUnit);

        return true;
    }

    function convertToWei(string currency, uint256 currencyAmount) public view returns (uint256) {
        return currencyAmount.mul(rates[currency]);
    }
}
