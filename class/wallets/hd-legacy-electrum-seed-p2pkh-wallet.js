import { HDLegacyP2PKHWallet } from './hd-legacy-p2pkh-wallet';

const bitcoin = require('bitcoinjs-lib');
const mn = require('electrum-mnemonic');
const HDNode = require('bip32');

const PREFIX = mn.PREFIXES.standard;
const MNEMONIC_TO_SEED_OPTS = {
  prefix: PREFIX,
};

/**
 * ElectrumSeed means that instead of BIP39 seed format it works with the format invented by Electrum wallet. Otherwise
 * its a regular HD wallet that has all the properties of parent class.
 *
 * @see https://electrum.readthedocs.io/en/latest/seedphrase.html
 */
export class HDLegacyElectrumSeedP2PKHWallet extends HDLegacyP2PKHWallet {
  static type = 'HDlegacyElectrumSeedP2PKH';
  static typeReadable = 'HD Legacy Electrum (BIP32 P2PKH)';
  static derivationPath = 'm';

  validateMnemonic() {
    return mn.validateMnemonic(this.secret, PREFIX);
  }

  async generate() {
    throw new Error('Not implemented');
  }

  getXpub() {
    if (this._xpub) {
      return this._xpub; // cache hit
    }
    const root = bitcoin.bip32.fromSeed(mn.mnemonicToSeedSync(this.secret, MNEMONIC_TO_SEED_OPTS));
    this._xpub = root.neutered().toBase58();
    return this._xpub;
  }

  _getInternalAddressByIndex(index) {
    index = index * 1; // cast to int
    if (this.internal_addresses_cache[index]) return this.internal_addresses_cache[index]; // cache hit

    const node = bitcoin.bip32.fromBase58(this.getXpub());
    const address = bitcoin.payments.p2pkh({
      pubkey: node.derive(1).derive(index).publicKey,
    }).address;

    return (this.internal_addresses_cache[index] = address);
  }

  _getExternalAddressByIndex(index) {
    index = index * 1; // cast to int
    if (this.external_addresses_cache[index]) return this.external_addresses_cache[index]; // cache hit

    const node = bitcoin.bip32.fromBase58(this.getXpub());
    const address = bitcoin.payments.p2pkh({
      pubkey: node.derive(0).derive(index).publicKey,
    }).address;

    return (this.external_addresses_cache[index] = address);
  }

  _getWIFByIndex(internal, index) {
    if (!this.secret) return false;
    const root = bitcoin.bip32.fromSeed(mn.mnemonicToSeedSync(this.secret, MNEMONIC_TO_SEED_OPTS));
    const path = `m/${internal ? 1 : 0}/${index}`;
    const child = root.derivePath(path);

    return child.toWIF();
  }

  allowSendMax() {
    return true;
  }

  _getNodePubkeyByIndex(node, index) {
    index = index * 1; // cast to int

    if (node === 0 && !this._node0) {
      const xpub = this.getXpub();
      const hdNode = HDNode.fromBase58(xpub);
      this._node0 = hdNode.derive(node);
    }

    if (node === 1 && !this._node1) {
      const xpub = this.getXpub();
      const hdNode = HDNode.fromBase58(xpub);
      this._node1 = hdNode.derive(node);
    }

    if (node === 0) {
      return this._node0.derive(index).publicKey;
    }

    if (node === 1) {
      return this._node1.derive(index).publicKey;
    }
  }
}
