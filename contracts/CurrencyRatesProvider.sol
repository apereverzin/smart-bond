pragma solidity ^0.4.18;


contract CurrencyRatesProvider {
    function getCurrencyRate(string currency) public view returns (uint256);
    function convertToWei(string currency, uint256 currencyAmount) public view returns (uint256);

    event StoreCurrencyRate(string currency, uint256 value);
}
