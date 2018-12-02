const BigNumber = web3.BigNumber;

const SmartBondRegister = artifacts.require('SmartBondRegister');

contract('SmartBondRegister', function () {

  beforeEach(async function () {
    this.smartBondRegister = await SmartBondRegister.new();
  });

  describe('SmartBondRegister created', function () {
    it('should have no registered contracts', async function () {
      let res = await this.smartBondRegister.cnt();
      res.should.be.bignumber.equal(0x0);
    });
  });

  describe('SmartBondRegister after creation', function () {
    it('should have contract not registered', async function () {
      let res = await this.smartBondRegister.getSmartBond('1234');
      res.should.be.bignumber.equal(0x0);
    });

    it('should register contract', async function () {
      const SMART_BOND_ADDRESS = '0x0000000000000000000000000000000000001234';
      await this.smartBondRegister.registerSmartBond('1234', SMART_BOND_ADDRESS);
      let res = await this.smartBondRegister.getSmartBond('1234');
      res.should.be.bignumber.equal(SMART_BOND_ADDRESS);
    });
  });
});
