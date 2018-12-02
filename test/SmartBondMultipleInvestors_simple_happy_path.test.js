import expectRevert from './helpers/expectRevert';
import toPromise from './helpers/toPromise';

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
    it('should pass happy path scenario', async function () {
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

      // top-up collateral
      let bondIssuerBalanceBeforeCollateralRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1300000000000000000));

      let bondIssuerBalanceAfterCollateralRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterCollateralRes.minus(bondIssuerBalanceBeforeCollateralRes).should.be.bignumber.lessThan(-50000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(bondFaceValueInCurrency);

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // repay loan
      const investorBalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1150000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      let investorBalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investorBalanceAfterLoanRepaymentRes.minus(investorBalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(1150000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investorBalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investorBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should pass happy path scenario and should not allow any more payments', async function () {
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
                                 value: minAmountOfCollateralWeiRes,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(minAmountOfCollateralWeiRes));

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

      // repay loan
      let investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1150000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      let investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.minus(investor1BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(575000000000000000);
      let investor2BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterLoanRepaymentRes.minus(investor2BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(575000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // No more transfers should be possible
      // loan transfer from the third investor should fail
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: accounts[3],
          to: this.smartBond.address,
          value: 100000000000000000,
          gas: 5000000
        })
      );

      // repayment transfer from bond issuer should fail
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: bondIssuerAddress,
          to: this.smartBond.address,
          value: 100000000000000000,
          gas: 5000000
        })
      );

      // collateral transfer from bond issuer should fail
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: bondIssuerAddress,
          to: this.smartBond.address,
          value: 100000000000000000,
          gas: 5000000,
          data: '0x01'
        })
      );
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should pass happy path scenario with overpayment', async function () {
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
                                 value: minAmountOfCollateralWeiRes,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(minAmountOfCollateralWeiRes));

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

      // repay loan
      let bondIssuerBalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(bondIssuerAddress);
      let investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 2150000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      let bondIssuerBalanceAfterLoanRepaymentRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceBeforeLoanRepaymentRes.minus(bondIssuerBalanceAfterLoanRepaymentRes).should.be.bignumber.lessThan(2250000000000000000);
      let investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.minus(investor1BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(575000000000000000);
      let investor2BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterLoanRepaymentRes.minus(investor2BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(575000000000000000);

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
    it('should pass happy path scenario when one investor pays twice', async function () {
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
                                 value: minAmountOfCollateralWeiRes,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(minAmountOfCollateralWeiRes));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // transfer 25% of loan from the first investor the first time
      let bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 250000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1500000000000000000));

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
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(2000000000000000000));

      bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(0);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // transfer 25% of loan from the first investor the second time
      bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 250000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(1000000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));
      investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(2));

      // repay loan
      let investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1150000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      let investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.minus(investor1BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(575000000000000000);
      let investor2BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterLoanRepaymentRes.minus(investor2BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(575000000000000000);

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
    it('should pass happy path scenario if shares are unequal', async function () {
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
                                 value: minAmountOfCollateralWeiRes,
                                 gas: 5000000,
                                 data: '0x01' });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(minAmountOfCollateralWeiRes));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(new BigNumber(0));

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // transfer 25% of loan from the first investor
      let bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 250000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1500000000000000000));

      let bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(0);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      let investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // transfer 75% of loan from the second investor
      bondIssuerBalanceBeforeLoanRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 750000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      bondIssuerBalanceAfterLoanRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterLoanRes.minus(bondIssuerBalanceBeforeLoanRes).should.be.bignumber.equal(1000000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(4));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(4).mul(3));

      // repay loan
      let investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1150000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      let investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.minus(investor1BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(287500000000000000);
      let investor2BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterLoanRepaymentRes.minus(investor2BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(862500000000000000);

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
    it('should not allow too small loan transfer', async function () {
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

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: minAmountOfCollateralWeiRes,
                                 gas: 5000000,
                                 data: '0x01' });

      // transfer 50% of loan from the first investor
      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });

      // transfer 1% of loan from the second investor
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: accounts[2],
          to: this.smartBond.address,
          value: 10000000000000000,
          gas: 5000000
        })
      );
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should not allow too loan transfer leaving too small share', async function () {
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

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: minAmountOfCollateralWeiRes,
                                 gas: 5000000,
                                 data: '0x01' });

      // transfer 50% of loan from the first investor
      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });

      // transfer 49% of loan from the second investor
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: accounts[2],
          to: this.smartBond.address,
          value: 490000000000000000,
          gas: 5000000
        })
      );
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should not allow loan transfers after loan has been fully transferred', async function () {
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

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: minAmountOfCollateralWeiRes,
                                 gas: 5000000,
                                 data: '0x01' });

      // transfer 50% of loan from the first investor the first time
      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });

      // transfer 50% of loan from the second investor
      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });

      // transfer 10% of loan from the third investor
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: accounts[3],
          to: this.smartBond.address,
          value: 100000000000000000,
          gas: 5000000
        })
      );
    });
  });

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should not allow loan repayment with zero value', async function () {
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

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();

      // transfer collateral
      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: minAmountOfCollateralWeiRes,
                                 gas: 5000000,
                                 data: '0x01' });

      // transfer 50% of loan from the first investor the first time
      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });

      // transfer 50% of loan from the second investor
      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });

      // repay 0 value
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: bondIssuerAddress,
          to: this.smartBond.address,
          value: 0,
          gas: 5000000
        })
      );
    });
  });
});
