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

  describe('SmartBond created', function () {
    const contractId = '1277';
    it('attributes should be set', async function () {
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
      let bondIssuerAddressRes = await this.smartBond.bondIssuerAddress();
      let balRes = await web3.eth.getBalance(accounts[0]).toNumber();
      let nameRes = await this.smartBond.name();
      let symbolRes = await this.smartBond.symbol();
      let totalSupplyRes = await this.smartBond.totalSupply();
      let totalAmountInCurrencyToRepayRes = await this.smartBond.totalAmountInCurrencyToRepay();
      let totalAmountOfCouponsInCurrencyToRepayRes = await this.smartBond.totalAmountOfCouponsInCurrencyToRepay();
      let minInvestmentInCurrencyRes = await this.smartBond.minInvestmentInCurrency();
      let debtTokenBalanceRes = await this.smartBond.balanceOf(this.smartBond.address);
      let balanceRes = await web3.eth.getBalance(this.smartBond.address);
      let marginCallRes = await this.smartBond.isMarginCall();

      bondIssuerAddressRes.should.be.equal(bondIssuerAddress);
      nameRes.should.be.equal(name);
      symbolRes.should.be.equal(symbol);
      totalSupplyRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      totalAmountInCurrencyToRepayRes.should.be.bignumber.equal(bondFaceValueInCurrency + numberOfCouponPayments * couponPaymentInCurrency);
      totalAmountOfCouponsInCurrencyToRepayRes.should.be.bignumber.equal(numberOfCouponPayments * couponPaymentInCurrency);
      minInvestmentInCurrencyRes.should.be.bignumber.equal(bondFaceValueInCurrency / minInvestorShare);
      debtTokenBalanceRes.should.be.bignumber.equal(totalNumberOfDebtTokens);
      balanceRes.should.be.bignumber.equal(0);
      marginCallRes.should.equal(false);
    });
  });
});
