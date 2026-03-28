// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TruthAttestation
 * @notice Records cryptographic proof that media was captured at a
 *         specific time and place. Does not store media — only hashes.
 * @dev Deployed on Base L2 (chainId: 8453)
 */
contract TruthAttestation is Ownable, Pausable {

    struct Attestation {
        bytes32 payloadHash;    // SHA-256 of (imageHash + fingerprintHash + timestampMs)
        bytes32 ipfsCid;        // IPFS CID encoded as bytes32
        address submitter;      // address that called attest()
        uint256 timestamp;      // block.timestamp at attestation
        bool isRevoked;
    }

    // payloadHash => Attestation
    mapping(bytes32 => Attestation) public attestations;

    // Trusted backend signers (multi-sig for decentralization later)
    mapping(address => bool) public trustedSubmitters;

    // ─── Events ───────────────────────────────────────────────────────────
    event AttestationCreated(
        bytes32 indexed payloadHash,
        bytes32 ipfsCid,
        address indexed submitter,
        uint256 timestamp
    );

    event AttestationRevoked(
        bytes32 indexed payloadHash,
        address revokedBy
    );

    event SubmitterUpdated(address submitter, bool trusted);

    // ─── Errors ───────────────────────────────────────────────────────────
    error AlreadyAttested(bytes32 payloadHash);
    error NotFound(bytes32 payloadHash);
    error Revoked(bytes32 payloadHash);
    error NotTrustedSubmitter();

    // ─── Modifiers ────────────────────────────────────────────────────────
    modifier onlyTrustedSubmitter() {
        if (!trustedSubmitters[msg.sender]) revert NotTrustedSubmitter();
        _;
    }

    constructor(address initialSubmitter) Ownable(msg.sender) {
        trustedSubmitters[initialSubmitter] = true;
    }

    // ─── Core Functions ───────────────────────────────────────────────────

    /**
     * @notice Record a new attestation on-chain
     * @param payloadHash SHA-256 hash of (imageHash + fingerprintHash + timestampMs)
     * @param ipfsCid IPFS CID of the full TruthCertificate metadata JSON
     */
    function attest(
        bytes32 payloadHash,
        bytes32 ipfsCid
    ) external onlyTrustedSubmitter whenNotPaused {
        if (attestations[payloadHash].timestamp != 0) {
            revert AlreadyAttested(payloadHash);
        }

        attestations[payloadHash] = Attestation({
            payloadHash: payloadHash,
            ipfsCid: ipfsCid,
            submitter: msg.sender,
            timestamp: block.timestamp,
            isRevoked: false
        });

        emit AttestationCreated(payloadHash, ipfsCid, msg.sender, block.timestamp);
    }

    /**
     * @notice Batch attest multiple hashes in one tx (gas efficient)
     */
    function attestBatch(
        bytes32[] calldata payloadHashes,
        bytes32[] calldata ipfsCids
    ) external onlyTrustedSubmitter whenNotPaused {
        require(payloadHashes.length == ipfsCids.length, "Length mismatch");
        require(payloadHashes.length <= 100, "Max 100 per batch");

        for (uint i = 0; i < payloadHashes.length; i++) {
            if (attestations[payloadHashes[i]].timestamp == 0) {
                attestations[payloadHashes[i]] = Attestation({
                    payloadHash: payloadHashes[i],
                    ipfsCid: ipfsCids[i],
                    submitter: msg.sender,
                    timestamp: block.timestamp,
                    isRevoked: false
                });
                emit AttestationCreated(payloadHashes[i], ipfsCids[i], msg.sender, block.timestamp);
            }
        }
    }

    /**
     * @notice Verify a payload hash — returns full attestation data
     */
    function verify(bytes32 payloadHash)
        external view
        returns (Attestation memory)
    {
        Attestation memory att = attestations[payloadHash];
        if (att.timestamp == 0) revert NotFound(payloadHash);
        return att;
    }

    /**
     * @notice Check if a hash is attested (simple boolean)
     */
    function isAttested(bytes32 payloadHash) external view returns (bool) {
        return attestations[payloadHash].timestamp != 0 &&
               !attestations[payloadHash].isRevoked;
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function revoke(bytes32 payloadHash) external onlyOwner {
        if (attestations[payloadHash].timestamp == 0) revert NotFound(payloadHash);
        attestations[payloadHash].isRevoked = true;
        emit AttestationRevoked(payloadHash, msg.sender);
    }

    function setSubmitter(address submitter, bool trusted) external onlyOwner {
        trustedSubmitters[submitter] = trusted;
        emit SubmitterUpdated(submitter, trusted);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
