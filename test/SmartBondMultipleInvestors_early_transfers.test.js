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
    it('should not accept loan transfer before collateral has been transferred', async function () {
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

      // transfer loan
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: accounts[1],
          to: this.smartBond.address,
          value: 1000000000000000000,
          gas: 5000000
        })
      );
    });
  });

  describe('SmartBond with one investor', function () {
    const contractId = '1278';
    it('should not accept repayment transfer before collateral has been transferred', async function () {
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

      // transfer loan
      await expectRevert(
        toPromise(web3.eth.sendTransaction)({
          from: bondIssuerAddress,
          to: this.smartBond.address,
          value: minAmountOfCollateralWeiRes,
          gas: 5000000
        })
      );
    });
  });
});
