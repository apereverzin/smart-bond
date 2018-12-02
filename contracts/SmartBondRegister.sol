pragma solidity ^0.4.24;


contract SmartBondRegister {

    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function kill() public {
        if (msg.sender == owner)
        selfdestruct(owner);
    }

    uint256 public cnt = 0;

    mapping (string => address) smartBondContracts;

    mapping (address => uint) public registeredAddresses;

    mapping (uint256 => address) public indexedAddresses;

    constructor() public {
        owner = msg.sender;
    }

    function getSmartBond(string contractId) public view returns (address) {
        return smartBondContracts[contractId];
    }

    function registerSmartBond(string contractId, address smartBond) public returns (bool) {
        // Smart Bond must NOT be registered
        require(smartBondContracts[contractId] == 0);

        smartBondContracts[contractId] = smartBond;

        indexedAddresses[cnt] = smartBond;
        cnt = cnt + 1;
        registeredAddresses[smartBond] = 1;

        emit SetSmartBond(contractId, smartBond);

        return true;
    }

    event SetSmartBond(string contractId, address smartBond);
}
