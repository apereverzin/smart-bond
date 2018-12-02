import increaseTime from './helpers/increaseTime';

const BigNumber = web3.BigNumber;

const SmartBondRegister = artifacts.require('SmartBondRegister');
const SettableCurrencyRates = artifacts.require('SettableCurrencyRates');
const SmartBondMultipleInvestors = artifacts.require('SmartBondMultipleInvestors');

contract('SmartBondMultipleInvestors', function (accounts) {
  const bondIssuerAddress = accounts[0];
  const minInvestorShare = 50;
  const loanTransferTimeoutInSeconds = 60;
  const currency = 'GBP';
  const bondFaceValueInCurrency = 1000;
  const numberOfCouponPayments = 3;
  const couponPaymentPeriodInSeconds = 60;
  const couponPaymentInCurrency = 50;
  const name = 'Smart Bond Token2';
  const symbol = 'SBT2';
  const totalNumberOfDebtTokens = new BigNumber('1e21');

  beforeEach(async function () {
    this.smartBondRegister = await SmartBondRegister.new();
    this.settableCurrencyRates = await SettableCurrencyRates.new();
  });

  describe('SmartBond with one investor', function () {
    const contractId = '1278';
    it('should pass repayment deadline missed and default scenario', async function () {
      this.smartBond = await SmartBondMultipleInvestors.new(
            minInvestorShare,
            loanTransferTimeoutInSeconds,
            currency,
            bondFaceValueInCurrency,
            numberOfCouponPayments,
            couponPaymentPeriodInSeconds,
            couponPaymentInCurrency,
            this.smartBondRegister.address,
            contractId,
            this.settableCurrencyRates.address,
            name,
            symbol,
            totalNumberOfDebtTokens,
            { from: bondIssuerAddress });

      await this.settableCurrencyRates.setCurrencyRate('GBP', 1000000000000000);

      let marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();
      minAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let defaultAmountOfCollateralWeiRes = await this.smartBond.getDefaultStateAmountOfCollateralWei();
      defaultAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1050000000000000000));

      let contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1250000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // transfer loan
      let bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 1000000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(1000000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      let investorBalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investorBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      let isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(false);
      let isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);

      // expire coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds + 1);
      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(true);
      isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);

      // set default state
      let bondIssuerBalanceBeforeDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      let investorBalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[1]);

      await this.smartBond.setDefaultState({ from: accounts[1],
                                             gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(true);

      let investorBalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      investorBalanceAfterDefaultStateRes.minus(investorBalanceBeforeDefaultStateRes).should.be.bignumber.lessThan(1250000000000000000);

      let bondIssuerBalanceAfterDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterDefaultStateRes.should.be.bignumber.equal(bondIssuerBalanceBeforeDefaultStateRes);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investorBalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investorBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should pass repayment deadline missed and default scenario', async function () {
      this.smartBond = await SmartBondMultipleInvestors.new(
            minInvestorShare,
            loanTransferTimeoutInSeconds,
            currency,
            bondFaceValueInCurrency,
            numberOfCouponPayments,
            couponPaymentPeriodInSeconds,
            couponPaymentInCurrency,
            this.smartBondRegister.address,
            contractId,
            this.settableCurrencyRates.address,
            name,
            symbol,
            totalNumberOfDebtTokens,
            { from: bondIssuerAddress });

      await this.settableCurrencyRates.setCurrencyRate('GBP', 1000000000000000);

      let marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();
      minAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let defaultAmountOfCollateralWeiRes = await this.smartBond.getDefaultStateAmountOfCollateralWei();
      defaultAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1050000000000000000));

      let contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1250000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // transfer 50% of loan from the first investor
      let bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1750000000000000000));

      let bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(0);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      let investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // transfer 50% of loan from the second investor
      bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(1000000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));

      let isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      let isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(false);
      let isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      let numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(0));

      // expire coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds + 1);
      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(true);
      numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(1));

      // set default state
      let bondIssuerBalanceBeforeDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      let investor1BalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[2]);

      await this.smartBond.setDefaultState({ from: accounts[1],
                                             gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(true);

      let investor1BalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterDefaultStateRes.minus(investor1BalanceBeforeDefaultStateRes).should.be.bignumber.lessThan(625000000000000000);
      let investor2BalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterDefaultStateRes.minus(investor2BalanceBeforeDefaultStateRes).should.be.bignumber.equal(625000000000000000);

      let bondIssuerBalanceAfterDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterDefaultStateRes.should.be.bignumber.equal(bondIssuerBalanceBeforeDefaultStateRes);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should pass repayment deadline missed and default scenario if one coupon paid', async function () {
      this.smartBond = await SmartBondMultipleInvestors.new(
            minInvestorShare,
            loanTransferTimeoutInSeconds,
            currency,
            bondFaceValueInCurrency,
            numberOfCouponPayments,
            couponPaymentPeriodInSeconds,
            couponPaymentInCurrency,
            this.smartBondRegister.address,
            contractId,
            this.settableCurrencyRates.address,
            name,
            symbol,
            totalNumberOfDebtTokens,
            { from: bondIssuerAddress });

      await this.settableCurrencyRates.setCurrencyRate('GBP', 1000000000000000);

      let marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();
      minAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let defaultAmountOfCollateralWeiRes = await this.smartBond.getDefaultStateAmountOfCollateralWei();
      defaultAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1050000000000000000));

      let contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1250000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // transfer 50% of loan from the first investor
      let bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1750000000000000000));

      let bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(0);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      let investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // transfer 50% of loan from the second investor
      bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(1000000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));

      let isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      let isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(false);
      let isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      let numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(0));

      // pay first coupon
      let investor1BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let investor1BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterCouponPaymentRes.minus(investor1BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);
      let investor2BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterCouponPaymentRes.minus(investor2BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);

      // expire second coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds * 2 + 1);
      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(true);
      numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(2));

      // set default state
      let bondIssuerBalanceBeforeDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      let investor1BalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[2]);

      await this.smartBond.setDefaultState({ from: accounts[1],
                                             gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(true);

      let investor1BalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterDefaultStateRes.minus(investor1BalanceBeforeDefaultStateRes).should.be.bignumber.lessThan(625000000000000000);
      let investor2BalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterDefaultStateRes.minus(investor2BalanceBeforeDefaultStateRes).should.be.bignumber.equal(625000000000000000);

      let bondIssuerBalanceAfterDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterDefaultStateRes.should.be.bignumber.equal(bondIssuerBalanceBeforeDefaultStateRes);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should pass repayment deadline missed and default scenario if all coupons paid', async function () {
      this.smartBond = await SmartBondMultipleInvestors.new(
            minInvestorShare,
            loanTransferTimeoutInSeconds,
            currency,
            bondFaceValueInCurrency,
            numberOfCouponPayments,
            couponPaymentPeriodInSeconds,
            couponPaymentInCurrency,
            this.smartBondRegister.address,
            contractId,
            this.settableCurrencyRates.address,
            name,
            symbol,
            totalNumberOfDebtTokens,
            { from: bondIssuerAddress });

      await this.settableCurrencyRates.setCurrencyRate('GBP', 1000000000000000);

      let marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();
      minAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let defaultAmountOfCollateralWeiRes = await this.smartBond.getDefaultStateAmountOfCollateralWei();
      defaultAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1050000000000000000));

      let contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1250000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // transfer 50% of loan from the first investor
      let bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1750000000000000000));

      let bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(0);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      let investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // transfer 50% of loan from the second investor
      bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(1000000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));

      let isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      let isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(false);
      let isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      let numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(0));

      // pay first coupon
      let investor1BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let investor1BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterCouponPaymentRes.minus(investor1BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);
      let investor2BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterCouponPaymentRes.minus(investor2BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);

      // pay second coupon
      investor1BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor2BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      investor1BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterCouponPaymentRes.minus(investor1BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);
      investor2BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterCouponPaymentRes.minus(investor2BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);

      // pay third coupon
      investor1BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor2BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      investor1BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterCouponPaymentRes.minus(investor1BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);
      investor2BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterCouponPaymentRes.minus(investor2BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);

      // expire third coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds * 3 + 1);
      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(true);
      numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(3));

      // set default state
      let bondIssuerBalanceBeforeDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      let investor1BalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[2]);

      await this.smartBond.setDefaultState({ from: accounts[1],
                                             gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(true);

      let investor1BalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterDefaultStateRes.minus(investor1BalanceBeforeDefaultStateRes).should.be.bignumber.lessThan(625000000000000000);
      let investor2BalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterDefaultStateRes.minus(investor2BalanceBeforeDefaultStateRes).should.be.bignumber.equal(625000000000000000);

      let bondIssuerBalanceAfterDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterDefaultStateRes.should.be.bignumber.equal(bondIssuerBalanceBeforeDefaultStateRes);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
    });
  });


  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should pass repayment deadline missed and default scenario if all coupons and half of principal paid', async function () {
      this.smartBond = await SmartBondMultipleInvestors.new(
            minInvestorShare,
            loanTransferTimeoutInSeconds,
            currency,
            bondFaceValueInCurrency,
            numberOfCouponPayments,
            couponPaymentPeriodInSeconds,
            couponPaymentInCurrency,
            this.smartBondRegister.address,
            contractId,
            this.settableCurrencyRates.address,
            name,
            symbol,
            totalNumberOfDebtTokens,
            { from: bondIssuerAddress });

      await this.settableCurrencyRates.setCurrencyRate('GBP', 1000000000000000);

      let marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();
      minAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let defaultAmountOfCollateralWeiRes = await this.smartBond.getDefaultStateAmountOfCollateralWei();
      defaultAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1050000000000000000));

      let contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1250000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // transfer 50% of loan from the first investor
      let bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1750000000000000000));

      let bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(0);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      let investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // transfer 50% of loan from the second investor
      bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(1000000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));

      let isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      let isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(false);
      let isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      let numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(0));

      // pay first coupon
      let investor1BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let investor1BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterCouponPaymentRes.minus(investor1BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);
      let investor2BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterCouponPaymentRes.minus(investor2BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);

      // pay second coupon
      investor1BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor2BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      investor1BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterCouponPaymentRes.minus(investor1BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);
      investor2BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterCouponPaymentRes.minus(investor2BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);

      // pay third coupon
      investor1BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor2BalanceBeforeCouponPaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      investor1BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterCouponPaymentRes.minus(investor1BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);
      investor2BalanceAfterCouponPaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterCouponPaymentRes.minus(investor2BalanceBeforeCouponPaymentRes).should.be.bignumber.equal(25000000000000000);

      // pay half of principal
      let investor1BalanceBeforeHalfPrincipalPaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeHalfPrincipalPaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let investor1BalanceAfterHalfPrincipalPaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterHalfPrincipalPaymentRes.minus(investor1BalanceBeforeHalfPrincipalPaymentRes).should.be.bignumber.equal(250000000000000000);
      let investor2BalanceAfterHalfPrincipalPaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterHalfPrincipalPaymentRes.minus(investor2BalanceBeforeHalfPrincipalPaymentRes).should.be.bignumber.equal(250000000000000000);

      // expire third coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds * 3 + 1);
      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(true);
      numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(3));

      // set default state
      let bondIssuerBalanceBeforeDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      let investor1BalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeDefaultStateRes = await web3.eth.getBalance(accounts[2]);

      await this.smartBond.setDefaultState({ from: accounts[1],
                                             gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(true);

      let investor1BalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterDefaultStateRes.minus(investor1BalanceBeforeDefaultStateRes).should.be.bignumber.lessThan(312500000000000000);
      let investor2BalanceAfterDefaultStateRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterDefaultStateRes.minus(investor2BalanceBeforeDefaultStateRes).should.be.bignumber.equal(312500000000000000);

      let bondIssuerBalanceAfterDefaultStateRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterDefaultStateRes.minus(bondIssuerBalanceBeforeDefaultStateRes).should.be.bignumber.equal(625000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should calculate coupons correctly', async function () {
      this.smartBond = await SmartBondMultipleInvestors.new(
            minInvestorShare,
            loanTransferTimeoutInSeconds,
            currency,
            bondFaceValueInCurrency,
            numberOfCouponPayments,
            couponPaymentPeriodInSeconds,
            couponPaymentInCurrency,
            this.smartBondRegister.address,
            contractId,
            this.settableCurrencyRates.address,
            name,
            symbol,
            totalNumberOfDebtTokens,
            { from: bondIssuerAddress });

      await this.settableCurrencyRates.setCurrencyRate('GBP', 1000000000000000);

      let marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();
      minAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let defaultAmountOfCollateralWeiRes = await this.smartBond.getDefaultStateAmountOfCollateralWei();
      defaultAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1050000000000000000));

      let contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1250000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // transfer 50% of loan from the first investor
      let bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1750000000000000000));

      let bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(0);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      let investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // transfer 50% of loan from the second investor
      bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(1000000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));

      let isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      let isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(false);
      let isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      let numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(0));
      let amountToBeRepaidToTheMomentInCurrencyRes = await this.smartBond.getAmountToBeRepaidToTheMomentInCurrency();
      amountToBeRepaidToTheMomentInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      // expire coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds + 1);
      isDefaultedRes = await this.smartBond.isDefaulted();
      isDefaultedRes.should.equal(false);
      isMarginCallRes = await this.smartBond.isMarginCall();
      isMarginCallRes.should.equal(false);
      isRepaymentDeadlineMissedRes = await this.smartBond.isRepaymentDeadlineMissed();
      isRepaymentDeadlineMissedRes.should.equal(true);
      numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(1));
      amountToBeRepaidToTheMomentInCurrencyRes = await this.smartBond.getAmountToBeRepaidToTheMomentInCurrency();
      amountToBeRepaidToTheMomentInCurrencyRes.should.be.bignumber.equal(new BigNumber(couponPaymentInCurrency));

      // expire one more coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds + 1);
      numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(2));
      amountToBeRepaidToTheMomentInCurrencyRes = await this.smartBond.getAmountToBeRepaidToTheMomentInCurrency();
      amountToBeRepaidToTheMomentInCurrencyRes.should.be.bignumber.equal(new BigNumber(couponPaymentInCurrency * 2));

      // expire one more coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds + 1);
      numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(3));
      amountToBeRepaidToTheMomentInCurrencyRes = await this.smartBond.getAmountToBeRepaidToTheMomentInCurrency();
      amountToBeRepaidToTheMomentInCurrencyRes.should.be.bignumber.equal(new BigNumber(couponPaymentInCurrency * 3 + bondFaceValueInCurrency));

      // expire one more coupon payment timeout
      await increaseTime(couponPaymentPeriodInSeconds + 1);
      numberOfExpiredCouponPaymentsRes = await this.smartBond.getNumberOfExpiredCouponPayments();
      numberOfExpiredCouponPaymentsRes.should.be.bignumber.equal(new BigNumber(3));
      amountToBeRepaidToTheMomentInCurrencyRes = await this.smartBond.getAmountToBeRepaidToTheMomentInCurrency();
      amountToBeRepaidToTheMomentInCurrencyRes.should.be.bignumber.equal(new BigNumber(couponPaymentInCurrency * 3 + bondFaceValueInCurrency));
    });
  });
});
