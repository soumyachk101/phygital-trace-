# PRD — Phygital-Trace: Proof-of-Reality for Citizen Journalism

**Version:** 1.0  
**Date:** March 2026  
**Status:** Active Development

---

## 1. Problem Statement

In 2026, AI-generated video and images are indistinguishable from reality. This creates a critical trust crisis in:
- Citizen journalism (leaked footage of events)
- Police accountability recordings
- Courtroom evidence
- Social media "breaking news"

There is currently **no low-friction way** for a regular person to prove their photo or video is real, taken at a specific place, at a specific time — and not AI-generated or manipulated post-capture.

---

## 2. Solution

**Phygital-Trace** is a mobile-first "Camera-to-Blockchain" verification tool that:
1. Captures a photo/video + a **PhysicalFingerprint** (sensor snapshot) simultaneously
2. Signs the combined hash using the phone's **Secure Enclave** (hardware-level, tamper-proof)
3. Uploads metadata to **IPFS** and anchors it on the **Base L2 blockchain**
4. Issues a publicly verifiable **TruthCertificate** with a shareable link + QR code

Anyone can then visit `phygitaltrace.app/verify/{id}` and independently verify the certificate.

---

## 3. Goals & Non-Goals

### Goals ✅
- Make it trivially easy to capture "verified" media (< 3 taps)
- Make verification publicly accessible with no account needed
- Cost per attestation under $0.01 (Base L2)
- Work offline — sync to chain when connected
- Open-source the verification protocol

### Non-Goals ❌
- Not a social media platform
- Not a cloud photo storage app
- Not a replacement for forensic investigation
- Does not verify the *content* of the image (what it shows), only *provenance* (where/when it was taken)

---

## 4. Target Users

| User Type | Description | Primary Need |
|-----------|-------------|-------------|
| Citizen Journalist | Captures events on streets | Proof their footage is real |
| Activist / Protestor | Records police interactions | Legal accountability |
| Insurance Claimant | Documents accident/damage | Tamper-proof timestamp |
| Investigative Reporter | Collects field evidence | Chain of custody |
| NGO Field Worker | Documents human rights situations | UN/Court admissibility |

---

## 5. User Stories

### Core Flow
- **US-01:** As a user, I want to open the app and take a photo that automatically captures sensor data so I don't have to do anything extra.
- **US-02:** As a user, I want to receive a shareable verification link immediately after capture.
- **US-03:** As a user, I want to see when my attestation is confirmed on-chain.
- **US-04:** As a journalist, I want to share a QR code that anyone can scan to verify my photo's authenticity.

### Verification
- **US-05:** As a viewer, I want to verify a TruthCertificate without creating an account.
- **US-06:** As a viewer, I want to see the sensor data, GPS location, and timestamp that were recorded.
- **US-07:** As a viewer, I want a clear "VERIFIED / TAMPERED / PENDING" status badge.

### Advanced
- **US-08:** As a power user, I want to export my TruthCertificate as a PDF for legal submission.
- **US-09:** As a developer, I want an API to integrate verification into my own platform.
- **US-10:** As a user, I want to capture offline and sync later without losing the proof.

---

## 6. Features

### MVP (v1.0)
| Feature | Priority | Description |
|---------|----------|-------------|
| Verified Camera | P0 | In-app camera with auto sensor capture |
| PhysicalFingerprint | P0 | GPS + accelerometer + light + timestamp snapshot |
| Secure Enclave Signing | P0 | Hardware key signs the hash on-device |
| IPFS Upload | P0 | Metadata + thumbnail pinned to IPFS |
| Base L2 Attestation | P0 | On-chain anchoring via smart contract |
| Verification Page | P0 | Public URL to verify any certificate |
| QR Code Share | P1 | Shareable QR linking to verification page |
| Offline Queue | P1 | Capture offline, auto-sync when connected |
| Certificate History | P1 | User's list of past captures |

### v1.1
| Feature | Priority | Description |
|---------|----------|-------------|
| Video Support | P1 | Frame-by-frame hash for videos |
| PDF Export | P2 | Legal-format certificate download |
| Public API | P2 | REST API for third-party verification |
| AI Anomaly Flag | P2 | ML flags suspicious sensor patterns |
| Wallet Connect | P2 | Link to MetaMask / Coinbase Wallet |

---

## 7. Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Captures verified | 10,000+ |
| App downloads | 5,000+ |
| Verification page visits | 50,000+ |
| Average attestation cost | < $0.005 |
| App capture-to-certificate time | < 30 seconds |
| False tamper-detection rate | < 0.1% |

---

## 8. Constraints & Assumptions

- **Device support:** iOS 14+ (Secure Enclave) and Android 9+ (StrongBox/TEE)
- **Network:** Base L2 is the primary chain; Polygon as fallback
- **Cost model:** Free for users; costs covered by gas abstraction (ERC-4337 paymaster)
- **Legal:** Platform does not endorse the *content* of verified media — only provenance
- **Privacy:** GPS coordinates are hashed by default; users can opt-in to reveal exact location

---

## 9. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Secure Enclave bypassed via jailbreak | Medium | Server-side jailbreak detection + warning badge |
| GPS spoofing by attacker | Medium | AI anomaly detection on sensor coherence |
| IPFS content lost (unpinned) | Low | Dual-pin: Pinata + own node + S3 fallback |
| Base L2 downtime | Low | Queue with retry; Polygon as secondary |
| Legal subpoena for user data | Medium | Store only hashes, never raw media on servers |
