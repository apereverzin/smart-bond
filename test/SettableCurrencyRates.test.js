const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const SettableCurrencyRates = artifacts.require('SettableCurrencyRates');

contract('SettableCurrencyRates', function () {

  beforeEach(async function () {
    this.settableCurrencyRates = await SettableCurrencyRates.new();
  });

  describe('SettableCurrencyRates', function () {
    it('should set currency rate', async function () {
      await this.settableCurrencyRates.setCurrencyRate('GBP', 1234);
      let res = await this.settableCurrencyRates.getCurrencyRate('GBP');
      res.should.be.bignumber.equal(1234);
    });
  });
});
