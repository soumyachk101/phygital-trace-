import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('TruthAttestation', function () {
  let truthAttestation: any;
  let owner: any;
  let submitter: any;
  let trustedSubmitter: any;

  beforeEach(async function () {
    [owner, submitter, trustedSubmitter] = await ethers.getSigners();

    const TruthAttestation = await ethers.getContractFactory('TruthAttestation');
    truthAttestation = await TruthAttestation.deploy(trustedSubmitter.address);
    await truthAttestation.waitForDeployment();
  });

  describe('Deployment', function () {
    it('Should set the right initial submitter', async function () {
      expect(await truthAttestation.trustedSubmitters(trustedSubmitter.address)).to.equal(true);
    });

    it('Should set the right owner', async function () {
      expect(await truthAttestation.owner()).to.equal(owner.address);
    });
  });

  describe('Attestation', function () {
    it('Should allow trusted submitter to attest', async function () {
      const payloadHash = '0x' + 'a'.repeat(64);
      const ipfsCid = '0x' + 'b'.repeat(64);

      await expect(
        truthAttestation.connect(trustedSubmitter).attest(payloadHash, ipfsCid)
      ).to.emit(truthAttestation, 'AttestationCreated');

      const attestation = await truthAttestation.verify(payloadHash);
      expect(attestation.payloadHash).to.equal(payloadHash);
      expect(attestation.ipfsCid).to.equal(ipfsCid);
      expect(attestation.submitter).to.equal(trustedSubmitter.address);
      expect(attestation.isRevoked).to.equal(false);
    });

    it('Should reject untrusted submitter', async function () {
      const payloadHash = '0x' + 'a'.repeat(64);
      const ipfsCid = '0x' + 'b'.repeat(64);

      await expect(
        truthAttestation.connect(submitter).attest(payloadHash, ipfsCid)
      ).to.be.revertedWith('NotTrustedSubmitter');
    });

    it('Should reject duplicate attestation', async function () {
      const payloadHash = '0x' + 'a'.repeat(64);
      const ipfsCid = '0x' + 'b'.repeat(64);

      await truthAttestation.connect(trustedSubmitter).attest(payloadHash, ipfsCid);
      await expect(
        truthAttestation.connect(trustedSubmitter).attest(payloadHash, ipfsCid)
      ).to.be.revertedWith('AlreadyAttested');
    });

    it('Should return true for isAttested', async function () {
      const payloadHash = '0x' + 'a'.repeat(64);
      const ipfsCid = '0x' + 'b'.repeat(64);

      await truthAttestation.connect(trustedSubmitter).attest(payloadHash, ipfsCid);
      expect(await truthAttestation.isAttested(payloadHash)).to.equal(true);
    });

    it('Should return false for isAttested after revoke', async function () {
      const payloadHash = '0x' + 'a'.repeat(64);
      const ipfsCid = '0x' + 'b'.repeat(64);

      await truthAttestation.connect(trustedSubmitter).attest(payloadHash, ipfsCid);
      await truthAttestation.connect(owner).revoke(payloadHash);
      expect(await truthAttestation.isAttested(payloadHash)).to.equal(false);
    });

    it('Should emit revocation event', async function () {
      const payloadHash = '0x' + 'a'.repeat(64);
      const ipfsCid = '0x' + 'b'.repeat(64);

      await truthAttestation.connect(trustedSubmitter).attest(payloadHash, ipfsCid);
      await expect(
        truthAttestation.connect(owner).revoke(payloadHash)
      ).to.emit(truthAttestation, 'AttestationRevoked');
    });
  });

  describe('Batch Attestation', function () {
    it('Should batch attest up to 100 hashes', async function () {
      const batchSize = 10;
      const payloadHashes: string[] = [];
      const ipfsCids: string[] = [];

      for (let i = 0; i < batchSize; i++) {
        payloadHashes.push('0x' + i.toString(16).padStart(64, 'a'));
        ipfsCids.push('0x' + i.toString(16).padStart(64, 'b'));
      }

      await expect(
        truthAttestation.connect(trustedSubmitter).attestBatch(payloadHashes, ipfsCids)
      ).to.emit(truthAttestation, 'AttestationCreated').exactly(batchSize).times;

      for (let i = 0; i < batchSize; i++) {
        expect(await truthAttestation.isAttested(payloadHashes[i])).to.equal(true);
      }
    });

    it('Should reject batch over 100', async function () {
      const payloadHashes = new Array(101).fill('0x' + 'a'.repeat(64));
      const ipfsCids = new Array(101).fill('0x' + 'b'.repeat(64));

      await expect(
        truthAttestation.connect(trustedSubmitter).attestBatch(payloadHashes, ipfsCids)
      ).to.be.revertedWith('Max 100 per batch');
    });
  });

  describe('Admin Functions', function () {
    it('Should allow owner to add submitter', async function () {
      await truthAttestation.connect(owner).setSubmitter(submitter.address, true);
      expect(await truthAttestation.trustedSubmitters(submitter.address)).to.equal(true);
    });

    it('Should allow owner to pause', async function () {
      await truthAttestation.connect(owner).pause();
      expect(await truthAttestation.paused()).to.equal(true);
    });

    it('Should allow owner to unpause', async function () {
      await truthAttestation.connect(owner).pause();
      await truthAttestation.connect(owner).unpause();
      expect(await truthAttestation.paused()).to.equal(false);
    });
  });
});
