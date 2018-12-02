const BigNumber = web3.BigNumber;

const SmartBondRegister = artifacts.require('SmartBondRegister');
const SettableCurrencyRates = artifacts.require('SettableCurrencyRates');
const SmartBondByInvestor = artifacts.require('SmartBondByInvestor');

contract('SmartBondByInvestor', function (accounts) {
  const bondIssuerAddress = accounts[0];
  const minInvestorShare = 50;
  const collateralTransferTimeoutInSeconds = 60;
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

  describe('SmartBond by investor with one investor', function () {
    const contractId = '1278';
    it('should pass happy path scenario', async function () {
      this.smartBond = await SmartBondByInvestor.new(
            minInvestorShare,
            collateralTransferTimeoutInSeconds,
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
            { from: accounts[1] });

      await this.settableCurrencyRates.setCurrencyRate('GBP', 1000000000000000);

      let marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      let minAmountOfCollateralWeiRes = await this.smartBond.getMinAmountOfCollateralWei();
      minAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let defaultAmountOfCollateralWeiRes = await this.smartBond.getDefaultStateAmountOfCollateralWei();
      defaultAmountOfCollateralWeiRes.should.be.bignumber.equal(new BigNumber(1050000000000000000));

      let contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);

      // transfer loan
      web3.eth.sendTransaction({ from: accounts[1],
                                 to: this.smartBond.address,
                                 value: 1000000000000000000,
                                 gas: 5000000 });
      let smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1000000000000000000));

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      let investorBalanceOfDebtTokensRes = await this.smartBond.balanceOf(accounts[1]);
      investorBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));

      // transfer collateral
      let bondIssuerBalanceBeforeCollateralRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 1250000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1250000000000000000));

      let bondIssuerBalanceAfterCollateralRes = await web3.eth.getBalance(bondIssuerAddress);
      bondIssuerBalanceAfterCollateralRes.minus(bondIssuerBalanceBeforeCollateralRes).should.be.bignumber.lessThan(-250000000000000000);

      contractBalanceOfDebtTokensRes = await this.smartBond.balanceOf(this.smartBond.address);
      contractBalanceOfDebtTokensRes.should.be.bignumber.equal(new BigNumber(0));
      let totalAmountInvestedInCurrencyRes = await this.smartBond.totalAmountInvestedInCurrency();
      totalAmountInvestedInCurrencyRes.should.be.bignumber.equal(bondFaceValueInCurrency);

      let bondFaceValueInCurrencyRes = await this.smartBond.bondFaceValueInCurrency();
      bondFaceValueInCurrencyRes.should.be.bignumber.equal(new BigNumber(bondFaceValueInCurrency));

      marginCallRes = await this.smartBond.isMarginCall();
      marginCallRes.should.equal(false);

      // top-up collateral
      bondIssuerBalanceBeforeCollateralRes = await web3.eth.getBalance(bondIssuerAddress);

      web3.eth.sendTransaction({ from: bondIssuerAddress,
                                 to: this.smartBond.address,
                                 value: 50000000000000000,
                                 gas: 5000000,
                                 data: '0x01' });
      smartBondBalanceRes = await web3.eth.getBalance(this.smartBond.address);
      smartBondBalanceRes.should.be.bignumber.equal(new BigNumber(1300000000000000000));

      bondIssuerBalanceAfterCollateralRes = await web3.eth.getBalance(bondIssuerAddress);
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
});
