const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const SmartBondRegister = artifacts.require('SmartBondRegister');
const SettableCurrencyRates = artifacts.require('SettableCurrencyRates');
const SmartBondByInvestor = artifacts.require('SmartBondByInvestor');

contract('SmartBondByInvestor', function (accounts) {
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

  describe('SmartBond created', function () {
    const contractId = '1277';
    it('attributes should be set', async function () {
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
      let investorAddressRes = await this.smartBond.investorAddress();
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

      investorAddressRes.should.be.equal(accounts[1]);
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
