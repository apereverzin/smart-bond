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

  describe('SmartBond with two investors', function () {
    const contractId = '1278';
    it('should pass happy path scenario with several repayments after re-selling debt tokens', async function () {
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

      // transfer 100% of loan from the first investor
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
      let investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // first coupon payment
      let investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.minus(investor1BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(50000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer 75% of debt tokens to the second investor
      await this.smartBond.transfer(accounts[2],
                                    totalNumberOfDebtTokens.div(4).mul(3),
                                    { from: accounts[1] });
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(4));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(4).mul(3));

      // second coupon payment
      investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.minus(investor1BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(50000000000000000 / 4);
      let investor2BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterLoanRepaymentRes.minus(investor2BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(50000000000000000 / 4 * 3);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(4));
      investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens.div(4).mul(3));

      // third coupon payment and body repayment
      investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor2BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1050000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.minus(investor1BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(1050000000000000000 / 4);
      investor2BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterLoanRepaymentRes.minus(investor2BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(1050000000000000000 / 4 * 3);

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
    it('should pass happy path scenario with several repayments after debt tokens fully resold', async function () {
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

      // transfer 100% of loan from the first investor
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
      let investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // first coupon payment
      let investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.minus(investor1BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(50000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer 100% of debt tokens to the second investor
      await this.smartBond.transfer(accounts[2],
                                    totalNumberOfDebtTokens,
                                    { from: accounts[1] });
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      let investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // second coupon payment
      investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      let investor2BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.should.be.bignumber.equal(investor1BalanceBeforeLoanRepaymentRes);
      let investor2BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterLoanRepaymentRes.minus(investor2BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(50000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor1BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investor1BalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      investor2BalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[2]);
      investor2BalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // third coupon payment and body repayment
      investor1BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor2BalanceBeforeLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1050000000000000000,
                                 gas: 5000000 });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(0));

      investor1BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[1]);
      investor1BalanceAfterLoanRepaymentRes.should.be.bignumber.equal(investor1BalanceBeforeLoanRepaymentRes);
      investor2BalanceAfterLoanRepaymentRes = await web3.eth.getBalance(accounts[2]);
      investor2BalanceAfterLoanRepaymentRes.minus(investor2BalanceBeforeLoanRepaymentRes).should.be.bignumber.equal(1050000000000000000);

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
    it('should allow to transfer only right number of tokens', async function () {
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

      // transfer 50% of loan from the second investor
      web3.eth.sendTransaction({ from: accounts[2],
                                 to: this.smartBond.address,
                                 value: 500000000000000000,
                                 gas: 5000000 });

      // transfer too many tokens
      await expectThrow(
        this.smartBond.transfer(accounts[3],
                                totalNumberOfDebtTokens.div(2).add(1),
                                { from: accounts[1] })
      );

      // transfer too few tokens
      await expectThrow(
        this.smartBond.transfer(accounts[3],
                                1000,
                                { from: accounts[1] })
      );

      // transfer zero tokens
      await expectThrow(
        this.smartBond.transfer(accounts[3],
                                0,
                                { from: accounts[1] })
      );

      // transfer tokens to 0 address
      await expectThrow(
        this.smartBond.transfer(0x0,
                                100,
                                { from: accounts[1] })
      );

      // transfer tokens to Smart Bond address
      await expectThrow(
        this.smartBond.transfer(this.smartBond.address,
                                100,
                                { from: accounts[1] })
      );

      // transfer all tokens
      await this.smartBond.transfer(accounts[2],
                                    totalNumberOfDebtTokens.div(2),
                                    { from: accounts[1] });
      await expectThrow(
        this.smartBond.transfer(accounts[3],
                                1,
                                { from: accounts[1] })
      );
    });
  });
});
