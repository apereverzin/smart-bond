pragma solidity ^0.4.24;


import "./SafeMath.sol";
import "./CurrencyRatesProvider.sol";
import "./SmartBondRegister.sol";


contract SmartBondMultipleInvestors {
    using SafeMath for uint256;
    using SafeMath for uint8;

    // Crowd sale, ether collateral
    uint public smartBondType = 3;

    uint public version = 1;

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

    struct AmountTransfer {
    uint256 amountInWei;
    uint256 amountInCurrency;
    uint256 rate;
    uint256 transferTimestamp;
    }

    struct LoanTransfers {
    uint256 amountInvestedInCurrency;
    uint256 amountInvestedInWei;
    mapping (uint => AmountTransfer) loanTransfers;
    uint loanTransferCount;
    }

    // Attributes related to the loan
    address public bondIssuerAddress;

    uint8 public minInvestorShare;

    uint256 public minDebtTokensBalance;

    uint256 public minInvestmentInCurrency;

    // within this time investors should transfer loan to SME;
    // collateral should already be on the SmartBond account's balance;
    // after this time if the loan is still not fully transferred
    // SME can withdraw its collateral from SmartBond account's balance
    // and loan amounts already transferred will be transferred back to investors
    uint256 public loanTransferTimeoutInSeconds;

    uint256 public totalAmountInvestedInCurrency = 0;

    uint256 public totalAmountInvestedInWei = 0;

    uint256 public bondFaceValueInCurrency;

    string public currency;

    CurrencyRatesProvider public currencyRatesProvider;

    uint256 public couponPaymentPeriodInSeconds;

    uint8 public numberOfCouponPayments;

    uint256 public couponPaymentInCurrency;

    uint256 public totalAmountInCurrencyToRepay;

    uint256 public totalAmountOfCouponsInCurrencyToRepay;

    uint public contractStartTimeInSeconds;
    //

    // Attributes related to collateral
    uint public collateralMinExtraValueRatio;

    uint public collateralDefaultStateExtraValueRatio;

    uint256 totalCollateralTransferredInWei = 0;
    //

    // Attributes related to wei transfers between investor and bondIssuer
    uint256 public totalAmountRepaidInCurrency = 0;

    uint public collateralTransferCount = 0;

    mapping (uint => AmountTransfer) public collateralTransfers;

    uint public investorCount = 0;

    mapping (uint => address) public indexedInvestorAddresses;

    mapping (address => LoanTransfers) public loanTransfersFromInvestors;

    AmountTransfer public loanTransferToBondIssuer;

    uint public repaymentCount = 0;

    mapping (uint => AmountTransfer) public repaymentTransfers;
    //

    // Can be set to true only once
    bool public isDefaulted = false;

    bool public isFullyRepaid = false;
    //

    // 1000000000000000000 is 10 power 18 - Wei in Ether
    uint256 private WEI_IN_ETHER = 1000000000000000000;

    bytes1 constant private COLLATERAL_TRANSFER_DATA_CODE = 0x01;

    // Attributes related to ERC20 debt tokens
    string public name;

    string public symbol;

    uint256 private totalNumberOfDebtTokens;

    uint8 public constant decimals = 18;

    mapping (address => uint256) private balances;

    mapping (address => uint) public registeredDebtTokenHoldersAddresses;

    mapping (uint => address) public indexedDebtTokenHoldersAddresses;

    uint public debtTokenHoldersCount = 0;
    //

    // Attribute related to Smart Bond Register
    SmartBondRegister public smartBondRegister;

    string public contractId;
    //

    constructor(
    uint8 _minInvestorShare,
    uint256 _loanTransferTimeoutInSeconds,

    string _currency,
    uint256 _bondFaceValueInCurrency,

    uint8 _numberOfCouponPayments,
    uint256 _couponPaymentPeriodInSeconds,
    uint256 _couponPaymentInCurrency,

    SmartBondRegister _smartBondRegister,
    string _contractId,

    CurrencyRatesProvider _currencyRatesProvider,

    string _name,
    string _symbol,
    uint256 _totalSupply
    )
    public {
        owner = msg.sender;

        bondIssuerAddress = msg.sender;
        minInvestorShare = _minInvestorShare;
        loanTransferTimeoutInSeconds = _loanTransferTimeoutInSeconds;

        currency = _currency;

        bondFaceValueInCurrency = _bondFaceValueInCurrency;
        minInvestmentInCurrency = bondFaceValueInCurrency.div(minInvestorShare);
        contractStartTimeInSeconds = now;

        numberOfCouponPayments = _numberOfCouponPayments;
        couponPaymentPeriodInSeconds = _couponPaymentPeriodInSeconds;
        couponPaymentInCurrency = _couponPaymentInCurrency;

        totalAmountOfCouponsInCurrencyToRepay =
        _numberOfCouponPayments.
        mul(_couponPaymentInCurrency);

        totalAmountInCurrencyToRepay =
        totalAmountOfCouponsInCurrencyToRepay.
        add(_bondFaceValueInCurrency);

        collateralMinExtraValueRatio = 4;

        collateralDefaultStateExtraValueRatio = 20;

        smartBondRegister = _smartBondRegister;
        contractId = _contractId;
        smartBondRegister.registerSmartBond(contractId, this);

        name = _name;
        symbol = _symbol;
        totalNumberOfDebtTokens = _totalSupply;

        minDebtTokensBalance = totalNumberOfDebtTokens.div(minInvestorShare);

        balances[address(this)] = totalNumberOfDebtTokens;

        currencyRatesProvider = _currencyRatesProvider;
        emit SetCurrencyRatesProvider(currencyRatesProvider);
    }

    function() public payable {
        if (isDefaulted || isFullyRepaid) {
            revert();
        }

        if (msg.sender == bondIssuerAddress) {
            if (msg.data.length == 1 && sha3(msg.data) == sha3(COLLATERAL_TRANSFER_DATA_CODE)) {
                transferCollateralWeiFromBondIssuer(msg.value);
            }
            else {
                repayLoanToInvestors(msg.value);
            }
        }
        else if (totalAmountInvestedInCurrency < bondFaceValueInCurrency) {
            transferLoanFromInvestor(msg.value);
        }
        else {
            revert();
        }
    }

    // Functions of ERC20
    function totalSupply() public view returns (uint256) {
        return totalNumberOfDebtTokens;
    }

    function balanceOf(address _owner) constant public returns (uint256){
        return balances[_owner];
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        uint256 bal = balances[msg.sender];
        require(bal >= _value && _value > 0);

        require(_to != address(0) && _to != address(this));

        registerBalance(msg.sender, bal.sub(_value));
        registerBalance(_to, balances[_to].add(_value));

        emit Transfer(msg.sender, _to, _value);

        return true;
    }
    // End of functions of ERC20

    function getMinAmountOfCollateralWei() public view returns (uint256) {
        uint256 bondFaceValueInWei = convertLoanToAmountWei();

        return
        bondFaceValueInWei.add(bondFaceValueInWei.div(collateralMinExtraValueRatio));
    }

    function getDefaultStateAmountOfCollateralWei() public view returns (uint256) {
        uint256 bondFaceValueInWei = convertLoanToAmountWei();

        return
        bondFaceValueInWei.add(bondFaceValueInWei.div(collateralDefaultStateExtraValueRatio));
    }

    function isRepaymentDeadlineMissed() view public returns (bool) {
        return(totalAmountInvestedInCurrency == bondFaceValueInCurrency &&
        totalAmountRepaidInCurrency < getAmountToBeRepaidToTheMomentInCurrency());
    }

    function isMarginCall() view public returns (bool) {
        return(totalAmountInvestedInCurrency == bondFaceValueInCurrency &&
        address(this).balance < getDefaultStateAmountOfCollateralWei());
    }

    function getAmountToBeRepaidToTheMomentInCurrency() view public returns (uint) {
        uint termsExpired = getNumberOfExpiredCouponPayments();
        uint amountInCurrencyToBeRepaid = termsExpired.mul(couponPaymentInCurrency);

        if (termsExpired == numberOfCouponPayments) {
            amountInCurrencyToBeRepaid = amountInCurrencyToBeRepaid.add(bondFaceValueInCurrency);
        }

        return amountInCurrencyToBeRepaid;
    }

    function getNumberOfExpiredCouponPayments() view public returns (uint) {
        uint numberOfExpiredCouponPayments =
        now.sub(contractStartTimeInSeconds).
        div(couponPaymentPeriodInSeconds);

        if (numberOfExpiredCouponPayments > numberOfCouponPayments) {
            return numberOfCouponPayments;
        }

        return numberOfExpiredCouponPayments;
    }

    function withdrawFunds() external returns (bool) {
        // collateral can be withdrawn only by bond issuer or one of investors
        require(msg.sender == bondIssuerAddress ||
        loanTransfersFromInvestors[msg.sender].amountInvestedInWei > 0);

        // collateral must be transferred
        require(address(this).balance > 0);

        // loan transfer timeout expired
        require(now > contractStartTimeInSeconds.add(loanTransferTimeoutInSeconds));

        // loan has NOT yet been fully transferred
        require(totalAmountInvestedInCurrency < bondFaceValueInCurrency);

        for (uint256 i = 0; i < investorCount; i++) {
            address investorAddr = indexedInvestorAddresses[i];
            uint256 val = loanTransfersFromInvestors[investorAddr].amountInvestedInWei;
            investorAddr.transfer(val);
            emit WithdrawFundsByInvestor(investorAddr, val);
        }

        bondIssuerAddress.transfer(totalCollateralTransferredInWei);
        emit WithdrawCollateralByBondIssuer(bondIssuerAddress, totalCollateralTransferredInWei);

        balances[address(this)] = 0;
        emit Transfer(address(this), address(0), totalNumberOfDebtTokens);
    }

    function setDefaultState() external returns (bool success) {
        // default state must NOT be already set
        require(!isDefaulted);

        // default state can be set only by one of investors
        require(balanceOf(msg.sender) > 0);

        // repayment deadline must be missed or not enough collateral (< 105% of loan)
        require(isRepaymentDeadlineMissed() || isMarginCall());

        uint256 minAmountOfCollateralWei = getMinAmountOfCollateralWei();

        // transfer collateral ether to investors and bond issuer
        uint256 amountOfCollateralWeiToTransferToBondIssuer;
        uint256 amountOfCollateralWeiToTransferToInvestors;

        if (address(this).balance < minAmountOfCollateralWei) {
            amountOfCollateralWeiToTransferToBondIssuer = 0;
            amountOfCollateralWeiToTransferToInvestors = address(this).balance;
        }
        else {
            if (totalAmountRepaidInCurrency > totalAmountOfCouponsInCurrencyToRepay) {
                amountOfCollateralWeiToTransferToBondIssuer =
                address(this).balance.
                mul(totalAmountRepaidInCurrency.sub(totalAmountOfCouponsInCurrencyToRepay)).
                div(bondFaceValueInCurrency);

                amountOfCollateralWeiToTransferToInvestors =
                address(this).balance.
                sub(amountOfCollateralWeiToTransferToBondIssuer);
            }
            else {
                amountOfCollateralWeiToTransferToInvestors = minAmountOfCollateralWei;

                amountOfCollateralWeiToTransferToBondIssuer =
                address(this).balance.
                sub(amountOfCollateralWeiToTransferToInvestors);
            }
        }

        if (amountOfCollateralWeiToTransferToBondIssuer > 0) {
            bondIssuerAddress.transfer(amountOfCollateralWeiToTransferToBondIssuer);
            emit TransferCollateralToBondIssuer(msg.sender, amountOfCollateralWeiToTransferToBondIssuer);
        }

        distributeCollateral(amountOfCollateralWeiToTransferToInvestors);
        destroyDebtTokens();

        // set default state
        isDefaulted = true;
        emit SetDefaultState(msg.sender);

        return true;
    }

    function transferLoanFromInvestor(uint256 value) internal {
        require(!isMarginCall());
        require(address(this).balance >= getMinAmountOfCollateralWei());

        uint256 currentCurrencyRate = currencyRatesProvider.getCurrencyRate(currency);
        uint256 amountLeftToInvestInCurrency =
        bondFaceValueInCurrency.sub(totalAmountInvestedInCurrency);
        uint256 amountLeftToInvestInWei = amountLeftToInvestInCurrency.mul(currentCurrencyRate);

        uint256 amountBeingInvestedInWei;
        uint256 amountBeingInvestedInCurrency;
        if (amountLeftToInvestInWei >= value) {
            amountBeingInvestedInWei = value;
            amountBeingInvestedInCurrency = value.div(currentCurrencyRate);

            if (amountBeingInvestedInCurrency < minInvestmentInCurrency) {
                revert('Investment too small');
            }

            totalAmountInvestedInCurrency = totalAmountInvestedInCurrency.add(amountBeingInvestedInCurrency);

            uint256 amountWillBeLeftToInvestInCurrency = bondFaceValueInCurrency.sub(totalAmountInvestedInCurrency);
            if (amountWillBeLeftToInvestInCurrency > 0 &&
                amountWillBeLeftToInvestInCurrency < minInvestmentInCurrency) {
                revert('Investment too small');
            }
        }
        else {
            amountBeingInvestedInWei = amountLeftToInvestInWei;
            amountBeingInvestedInCurrency = amountLeftToInvestInCurrency;
            totalAmountInvestedInCurrency = bondFaceValueInCurrency;

            uint256 extraAmountInWei = value.sub(amountLeftToInvestInWei);

            if (extraAmountInWei > 0) {
                msg.sender.transfer(extraAmountInWei);
                emit TransferLoanBackToInvestor(msg.sender, extraAmountInWei);
            }
        }

        totalAmountInvestedInWei = totalAmountInvestedInWei.add(amountBeingInvestedInWei);

        emit TransferLoanFromInvestor(msg.sender, amountBeingInvestedInWei);

        uint256 investedInCurrency = loanTransfersFromInvestors[msg.sender].amountInvestedInCurrency;
        // is this a new investor?
        if (investedInCurrency == 0) {
            indexedInvestorAddresses[investorCount] = msg.sender;
            investorCount = investorCount + 1;
            loanTransfersFromInvestors[msg.sender].amountInvestedInCurrency =
            amountBeingInvestedInCurrency;
            loanTransfersFromInvestors[msg.sender].amountInvestedInWei = amountBeingInvestedInWei;
            loanTransfersFromInvestors[msg.sender].loanTransferCount = 0;
        }
        else {
            loanTransfersFromInvestors[msg.sender].amountInvestedInCurrency =
            investedInCurrency.add(amountBeingInvestedInCurrency);

            loanTransfersFromInvestors[msg.sender].amountInvestedInWei =
            loanTransfersFromInvestors[msg.sender].amountInvestedInWei.add(amountBeingInvestedInWei);
        }

        uint cnt = loanTransfersFromInvestors[msg.sender].loanTransferCount;
        loanTransfersFromInvestors[msg.sender].loanTransfers[cnt].amountInWei =
        amountBeingInvestedInWei;
        loanTransfersFromInvestors[msg.sender].loanTransfers[cnt].amountInCurrency =
        amountBeingInvestedInCurrency;
        loanTransfersFromInvestors[msg.sender].loanTransfers[cnt].rate = currentCurrencyRate;
        loanTransfersFromInvestors[msg.sender].loanTransfers[cnt].transferTimestamp = now;

        loanTransfersFromInvestors[msg.sender].loanTransferCount = cnt + 1;

        // full bond face value invested?
        if (totalAmountInvestedInCurrency == bondFaceValueInCurrency) {
            // yes - transfer loan to bond issuer and distribute debt tokens
            loanTransferToBondIssuer.amountInWei = value;
            loanTransferToBondIssuer.amountInCurrency = bondFaceValueInCurrency;
            loanTransferToBondIssuer.rate = currentCurrencyRate;
            loanTransferToBondIssuer.transferTimestamp = now;
            bondIssuerAddress.transfer(totalAmountInvestedInWei);
            emit TransferLoanToBondIssuer(bondIssuerAddress, totalAmountInvestedInWei);

            uint256 totalNumberOfDebtTokensTransferred = 0;
            for (uint256 i = 0; i < investorCount; i++) {
                uint256 numberOfDebtTokensToTransfer =
                totalNumberOfDebtTokens.
                mul(loanTransfersFromInvestors[indexedInvestorAddresses[i]].amountInvestedInCurrency).
                div(totalAmountInvestedInCurrency);

                transferDebtTokensToInvestor(indexedInvestorAddresses[i], numberOfDebtTokensToTransfer);

                totalNumberOfDebtTokensTransferred =
                totalNumberOfDebtTokensTransferred.add(numberOfDebtTokensToTransfer);
            }
            if (totalNumberOfDebtTokensTransferred < totalNumberOfDebtTokens) {
                // transfer surplus to the last address
                transferDebtTokensToInvestor(
                indexedInvestorAddresses[investorCount - 1],
                totalNumberOfDebtTokens.sub(totalNumberOfDebtTokensTransferred));
            }
            registerBalance(address(this), 0);
        }
    }

    function transferDebtTokensToInvestor(address addr, uint256 numberOfDebtTokens) internal {
        registerBalance(addr, numberOfDebtTokens);

        emit Transfer(address(this), addr, numberOfDebtTokens);
    }

    function transferCollateralWeiFromBondIssuer(uint256 value) internal {
        collateralTransfers[collateralTransferCount].amountInWei = value;
        collateralTransfers[collateralTransferCount].amountInCurrency = 0;
        collateralTransfers[collateralTransferCount].rate =
            currencyRatesProvider.getCurrencyRate(currency);
        collateralTransfers[collateralTransferCount++].transferTimestamp = now;

        totalCollateralTransferredInWei = totalCollateralTransferredInWei.add(value);

        emit TransferCollateralFromBondIssuer(msg.sender, value);
    }

    function repayLoanToInvestors(uint256 value)
    internal {
        // loan must be already transferred to bond issuer
        require(loanTransferToBondIssuer.amountInWei > 0);

        require(value > 0);

        emit RepayLoanByBondIssuer(msg.sender, value);

        uint256 currentCurrencyRate = currencyRatesProvider.getCurrencyRate(currency);
        uint256 valueInCurrency = value.div(currentCurrencyRate);

        uint256 totalAmountInCurrency = totalAmountRepaidInCurrency.add(valueInCurrency);
        uint256 valueToTransferInWei;

        if (totalAmountInCurrency > totalAmountInCurrencyToRepay) {
            uint256 extraAmountInCurrency =
            totalAmountInCurrency.
            sub(totalAmountInCurrencyToRepay);

            uint256 extraAmountInWei = extraAmountInCurrency.mul(currentCurrencyRate);
            totalAmountInCurrency = totalAmountInCurrencyToRepay;
            valueToTransferInWei = value.sub(extraAmountInWei);

            bondIssuerAddress.transfer(extraAmountInWei);
            emit TransferRepaymentBackToBondIssuer(msg.sender, extraAmountInWei);
        }
        else {
            valueToTransferInWei = value;
        }

        repaymentTransfers[repaymentCount].amountInWei = valueToTransferInWei;
        repaymentTransfers[repaymentCount].rate = currentCurrencyRate;
        repaymentTransfers[repaymentCount].transferTimestamp = now;
        repaymentCount = repaymentCount + 1;
        totalAmountRepaidInCurrency = totalAmountInCurrency;

        uint256 valueTransferredInWei = 0;
        address lastAddress;
        for (uint256 i = 0; i < debtTokenHoldersCount; i++) {
            if (balances[indexedDebtTokenHoldersAddresses[i]] > 0) {
                uint256 val =
                valueToTransferInWei.
                mul(balances[indexedDebtTokenHoldersAddresses[i]]).
                div(totalNumberOfDebtTokens);
                transferLoanToInvestor(indexedDebtTokenHoldersAddresses[i], val);
                valueTransferredInWei = valueTransferredInWei.add(val);
                lastAddress = indexedDebtTokenHoldersAddresses[i];
            }
        }
        if (valueTransferredInWei < valueToTransferInWei) {
            // transfer surplus to the last address
            transferLoanToInvestor(lastAddress, valueToTransferInWei.sub(valueTransferredInWei));
        }

        // debt fully repaid?
        if (totalAmountRepaidInCurrency == totalAmountInCurrencyToRepay) {
            // yes - transfer collateral to bond issuer
            uint256 valueToTransfer = address(this).balance;
            bondIssuerAddress.transfer(valueToTransfer);
            emit TransferCollateralToBondIssuer(msg.sender, valueToTransfer);

            destroyDebtTokens();

            isFullyRepaid = true;
        }
    }

    function transferLoanToInvestor(address addr, uint256 value) internal {
        addr.transfer(value);
        emit TransferRepaymentToInvestor(addr, value);
    }

    function convertLoanToAmountWei() internal view returns (uint256) {
        return bondFaceValueInCurrency.mul(currencyRatesProvider.getCurrencyRate(currency));
    }

    function distributeCollateral(uint256 valueToDistributeInWei) internal {
        uint256 valueTransferredInWei = 0;
        address lastAddress;
        for (uint256 i = 0; i < debtTokenHoldersCount; i++) {
            address addr = indexedDebtTokenHoldersAddresses[i];
            uint256 bal = balances[addr];
            if (bal > 0) {
                uint256 val = valueToDistributeInWei.mul(bal).div(totalNumberOfDebtTokens);
                transferCollateralToInvestor(addr, val);
                valueTransferredInWei = valueTransferredInWei.add(val);
                lastAddress = addr;
            }
        }
        if (valueTransferredInWei < valueToDistributeInWei) {
            // transfer surplus to the last address
            transferCollateralToInvestor(lastAddress,
            valueToDistributeInWei.sub(valueTransferredInWei));
        }
    }

    function transferCollateralToInvestor(address addr, uint256 value) internal {
        addr.transfer(value);
        emit TransferCollateralToInvestor(addr, value);
    }

    function destroyDebtTokens() internal {
        for (uint256 i = 0; i < debtTokenHoldersCount; i++) {
            address addr = indexedDebtTokenHoldersAddresses[i];
            uint256 bal = balances[addr];
            if (bal > 0) {
                emit Transfer(addr, address(0), bal);
                balances[addr] = 0;
            }
        }

        emit DestroyDebtTokens(totalNumberOfDebtTokens);
    }

    function registerBalance(address addr, uint256 balance) internal {
        require(balance == 0 || balance > minDebtTokensBalance);

        if (registeredDebtTokenHoldersAddresses[addr] == 0 && balance > 0) {
            indexedDebtTokenHoldersAddresses[debtTokenHoldersCount] = addr;
            debtTokenHoldersCount = debtTokenHoldersCount + 1;
            registeredDebtTokenHoldersAddresses[addr] = 1;
        }

        balances[addr] = balance;
    }

    event TransferLoanFromInvestor(address indexed _investor, uint256 _amountInWei);

    event TransferLoanBackToInvestor(address indexed _investor, uint256 _amountInWei);

    event TransferLoanToBondIssuer(address indexed _bondIssuer, uint256 _amountInWei);

    event RepayLoanByBondIssuer(address indexed _bondIssuer, uint256 _amountInWei);

    event TransferRepaymentToInvestor(address indexed _investor, uint256 _amountInWei);

    event TransferRepaymentBackToBondIssuer(address indexed _bondIssuer, uint256 _amountInWei);

    event TransferCollateralToBondIssuer(address indexed _bondIssuer, uint256 _value);

    event WithdrawCollateralByBondIssuer(address indexed _bondIssuer, uint256 _value);

    event WithdrawFundsByInvestor(address indexed _bondIssuer, uint256 _value);

    event TransferCollateralToInvestor(address indexed _investor, uint256 _value);

    event DestroyDebtTokens(uint256 _value);

    event SetDefaultState(address _caller);

    event SetCurrencyRatesProvider(address indexed provider);


    // Events of ERC20
    event Transfer(address indexed _from, address indexed _to, uint256 _value);


    // Events specific to Ether collateral
    event TransferCollateralFromBondIssuer(address indexed _bondIssuer, uint256 _value);
}
