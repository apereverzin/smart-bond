import increaseTime from './helpers/increaseTime';
import expectThrow from './helpers/expectThrow';

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

  describe('SmartBond', function () {
    const contractId = '1278';
    it('should allow collateral withdrawal if no loan transfer', async function () {
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

      // expire loan transfer timeout
      await increaseTime(loanTransferTimeoutInSeconds + 1);

      // withdraw collateral
      let bondIssuerBalanceBeforeWithdrawalRes = await web3.eth.getBalance(bondIssuerAddress);

      await this.smartBond.withdrawFunds({ from: bondIssuerAddress,
                                           gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      let bondIssuerBalanceAfterWithdrawalRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterWithdrawalRes.minus(bondIssuerBalanceBeforeWithdrawalRes).should.be.bignumber.lessThan(1250000000000000000);
      bondIssuerBalanceAfterWithdrawalRes.minus(bondIssuerBalanceBeforeWithdrawalRes).should.be.bignumber.greaterThan(0);
    });
  });

  describe('SmartBond', function () {
    const contractId = '1278';
    it('should allow funds withdrawal by bond issuer if loan has not been fully transferred', async function () {
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

      // expire loan transfer timeout
      await increaseTime(loanTransferTimeoutInSeconds + 1);

      // withdraw funds
      let bondIssuerBalanceBeforeWithdrawalRes = await web3.eth.getBalance(bondIssuerAddress);
      let investorBalanceBeforeWithdrawalRes = await web3.eth.getBalance(accounts[1]);

      await this.smartBond.withdrawFunds({ from: bondIssuerAddress,
                                           gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      let bondIssuerBalanceAfterWithdrawalRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterWithdrawalRes.minus(bondIssuerBalanceBeforeWithdrawalRes).should.be.bignumber.lessThan(1250000000000000000);
      bondIssuerBalanceAfterWithdrawalRes.minus(bondIssuerBalanceBeforeWithdrawalRes).should.be.bignumber.greaterThan(0);

      let investorBalanceAfterWithdrawalRes = await web3.eth.getBalance(accounts[1]);
      investorBalanceAfterWithdrawalRes.minus(investorBalanceBeforeWithdrawalRes).should.be.bignumber.equal(500000000000000000);
    });
  });

  describe('SmartBond', function () {
    const contractId = '1278';
    it('should allow funds withdrawal by investor if loan has not been fully transferred', async function () {
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

      // expire loan transfer timeout
      await increaseTime(loanTransferTimeoutInSeconds + 1);

      // withdraw funds
      let bondIssuerBalanceBeforeWithdrawalRes = await web3.eth.getBalance(bondIssuerAddress);
      let investorBalanceBeforeWithdrawalRes = await web3.eth.getBalance(accounts[1]);

      await this.smartBond.withdrawFunds({ from: accounts[1],
                                           gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      let bondIssuerBalanceAfterWithdrawalRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterWithdrawalRes.minus(bondIssuerBalanceBeforeWithdrawalRes).should.be.bignumber.equal(1250000000000000000);

      let investorBalanceAfterWithdrawalRes = await web3.eth.getBalance(accounts[1]);
      investorBalanceAfterWithdrawalRes.minus(investorBalanceBeforeWithdrawalRes).should.be.bignumber.lessThan(500000000000000000);
      investorBalanceAfterWithdrawalRes.minus(investorBalanceBeforeWithdrawalRes).should.be.bignumber.greaterThan(0);
    });
  });

  describe('SmartBond', function () {
    const contractId = '1278';
    it('should allow collateral withdrawal only by bond issuer', async function () {
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

      // expire loan transfer timeout
      await increaseTime(loanTransferTimeoutInSeconds + 1);

      // withdraw collateral
      await expectThrow(
        this.smartBond.withdrawFunds({
          from: accounts[2],
          gas: 5000000
        })
      );
    });
  });

  describe('SmartBond', function () {
    const contractId = '1278';
    it('should not allow collateral withdrawal before loan transfer timeout expired', async function () {
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

      // withdraw collateral
      await expectThrow(
        this.smartBond.withdrawFunds({
          from: bondIssuerAddress,
          gas: 5000000
        })
      );
    });
  });

  describe('SmartBond', function () {
    const contractId = '1278';
    it('should allow funds withdrawal only by investor or bond issuer', async function () {
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

      // expire loan transfer timeout
      await increaseTime(loanTransferTimeoutInSeconds + 1);

      // withdraw funds
      await expectThrow(
        this.smartBond.withdrawFunds({
          from: accounts[2],
          gas: 5000000
        })
      );
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should not allow funds withdrawal after full loan transfer', async function () {
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

      // withdraw funds
      await expectThrow(
        this.smartBond.withdrawFunds({
          from: accounts[2],
          gas: 5000000
        })
      );
    });
  });

  describe('SmartBond', function () {
    const contractId = '1278';
    it('should not allow funds withdrawal before collateral has been transferred', async function () {
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

      // withdraw funds
      await expectThrow(
        this.smartBond.withdrawFunds({
          from: bondIssuerAddress,
          gas: 5000000
        })
      );
    });
  });
});
