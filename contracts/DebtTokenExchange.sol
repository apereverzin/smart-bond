pragma solidity ^0.4.24;


import "./SafeMath.sol";
import "./CurrencyRatesProvider.sol";
import "./ERC20Basic.sol";


contract DebtTokenExchange {
    using SafeMath for uint256;
    using SafeMath for uint8;

    struct Ask {
    address owner;
    ERC20Basic smartBond;
    uint256 numberOfTokens;
    uint256 amountInWei;
    bool bought;
    address buyer;
    }

    uint cnt = 0;

    mapping (uint => Ask) asks;

    function addAsk(ERC20Basic _smartBond,
                    uint256 _numberOfTokens,
                    uint256 _amountInWei) public returns (uint) {
        cnt = cnt + 1;
        asks[cnt].owner = msg.sender;
        asks[cnt].smartBond = _smartBond;
        asks[cnt].numberOfTokens = _numberOfTokens;
        asks[cnt].amountInWei = _amountInWei;
        asks[cnt].bought = false;

        emit AddAsk(msg.sender, _smartBond, _numberOfTokens, _amountInWei);

        return cnt;
    }

    function buyTokens(uint ind) public payable {
        require(!asks[ind].bought);
        require(asks[ind].amountInWei == msg.value);

        asks[ind].smartBond.transfer(msg.sender, asks[ind].numberOfTokens);
        asks[ind].owner.transfer(msg.value);

        asks[ind].bought = true;
        asks[ind].buyer = msg.sender;

        emit BuyTokens(asks[ind].owner, msg.sender, asks[ind].smartBond, asks[ind].numberOfTokens, asks[ind].amountInWei);
    }

    event AddAsk(address indexed owner, address indexed smartBond, uint256 tokens, uint256 amountInWei);

    event BuyTokens(address indexed owner, address indexed buyer, address indexed smartBond, uint256 numberOfTokens, uint256 amountInWei);
}
