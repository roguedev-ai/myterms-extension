const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyTermsConsentLedger", function () {
    let consentLedger;
    let owner;
    let user1;
    let user2;

    beforeEach(async function () {
        // Get signers
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy contract
        const MyTermsConsentLedger = await ethers.getContractFactory("MyTermsConsentLedger");
        consentLedger = await MyTermsConsentLedger.deploy();
        await consentLedger.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should deploy successfully", async function () {
            expect(await consentLedger.getAddress()).to.be.properAddress;
        });
    });

    describe("logConsent", function () {
        it("Should log a single consent", async function () {
            const site = "example.com";
            const termsHash = ethers.keccak256(ethers.toUtf8Bytes("terms-v1"));

            await expect(consentLedger.connect(user1).logConsent(site, termsHash))
                .to.emit(consentLedger, "ConsentLogged")
                .withArgs(user1.address, site, termsHash, await getBlockTimestamp());
        });

        it("Should allow multiple consents from same user", async function () {
            const site1 = "example.com";
            const site2 = "test.com";
            const hash1 = ethers.keccak256(ethers.toUtf8Bytes("terms-v1"));
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("terms-v2"));

            await consentLedger.connect(user1).logConsent(site1, hash1);
            await consentLedger.connect(user1).logConsent(site2, hash2);

            // Both should succeed without reverting
        });

        it("Should allow different users to log consents for same site", async function () {
            const site = "example.com";
            const hash = ethers.keccak256(ethers.toUtf8Bytes("terms-v1"));

            await expect(consentLedger.connect(user1).logConsent(site, hash))
                .to.emit(consentLedger, "ConsentLogged");

            await expect(consentLedger.connect(user2).logConsent(site, hash))
                .to.emit(consentLedger, "ConsentLogged");
        });

        it("Should handle empty site domain", async function () {
            const site = "";
            const hash = ethers.keccak256(ethers.toUtf8Bytes("terms-v1"));

            await expect(consentLedger.connect(user1).logConsent(site, hash))
                .to.emit(consentLedger, "ConsentLogged");
        });

        it("Should handle zero hash", async function () {
            const site = "example.com";
            const hash = ethers.ZeroHash;

            await expect(consentLedger.connect(user1).logConsent(site, hash))
                .to.emit(consentLedger, "ConsentLogged")
                .withArgs(user1.address, site, hash, await getBlockTimestamp());
        });
    });

    describe("logConsentBatch", function () {
        it("Should log multiple consents in a batch", async function () {
            const sites = ["example.com", "test.com", "demo.org"];
            const hashes = [
                ethers.keccak256(ethers.toUtf8Bytes("terms-v1")),
                ethers.keccak256(ethers.toUtf8Bytes("terms-v2")),
                ethers.keccak256(ethers.toUtf8Bytes("terms-v3"))
            ];

            const tx = await consentLedger.connect(user1).logConsentBatch(sites, hashes);
            const receipt = await tx.wait();

            // Should emit 3 events
            const events = receipt.logs.filter(log => {
                try {
                    return consentLedger.interface.parseLog(log)?.name === "ConsentLogged";
                } catch {
                    return false;
                }
            });

            expect(events.length).to.equal(3);
        });

        it("Should emit correct events for each consent in batch", async function () {
            const sites = ["example.com", "test.com"];
            const hashes = [
                ethers.keccak256(ethers.toUtf8Bytes("terms-v1")),
                ethers.keccak256(ethers.toUtf8Bytes("terms-v2"))
            ];

            const tx = await consentLedger.connect(user1).logConsentBatch(sites, hashes);
            const receipt = await tx.wait();

            // Verify both events were emitted
            const events = receipt.logs.filter(log => {
                try {
                    return consentLedger.interface.parseLog(log)?.name === "ConsentLogged";
                } catch {
                    return false;
                }
            });

            expect(events.length).to.equal(2);

            const event1 = consentLedger.interface.parseLog(events[0]);
            const event2 = consentLedger.interface.parseLog(events[1]);

            expect(event1.args.user).to.equal(user1.address);
            expect(event1.args.siteDomain).to.equal(sites[0]);
            expect(event1.args.termsHash).to.equal(hashes[0]);

            expect(event2.args.user).to.equal(user1.address);
            expect(event2.args.siteDomain).to.equal(sites[1]);
            expect(event2.args.termsHash).to.equal(hashes[1]);
        });

        it("Should revert if arrays have different lengths", async function () {
            const sites = ["example.com", "test.com"];
            const hashes = [ethers.keccak256(ethers.toUtf8Bytes("terms-v1"))];

            await expect(
                consentLedger.connect(user1).logConsentBatch(sites, hashes)
            ).to.be.revertedWith("Mismatched input lengths");
        });

        it("Should handle empty batch", async function () {
            const sites = [];
            const hashes = [];

            await expect(consentLedger.connect(user1).logConsentBatch(sites, hashes))
                .to.not.be.reverted;
        });

        it("Should handle large batch", async function () {
            const batchSize = 50;
            const sites = Array(batchSize).fill(0).map((_, i) => `site${i}.com`);
            const hashes = Array(batchSize).fill(0).map((_, i) =>
                ethers.keccak256(ethers.toUtf8Bytes(`terms-v${i}`))
            );

            const tx = await consentLedger.connect(user1).logConsentBatch(sites, hashes);
            const receipt = await tx.wait();

            // Should emit batchSize events
            const events = receipt.logs.filter(log => {
                try {
                    return consentLedger.interface.parseLog(log)?.name === "ConsentLogged";
                } catch {
                    return false;
                }
            });

            expect(events.length).to.equal(batchSize);
        });

        it("Should allow different users to submit batches", async function () {
            const sites = ["example.com"];
            const hashes = [ethers.keccak256(ethers.toUtf8Bytes("terms-v1"))];

            await expect(consentLedger.connect(user1).logConsentBatch(sites, hashes))
                .to.emit(consentLedger, "ConsentLogged");

            await expect(consentLedger.connect(user2).logConsentBatch(sites, hashes))
                .to.emit(consentLedger, "ConsentLogged");
        });
    });

    describe("Event Verification", function () {
        it("Should emit ConsentLogged with correct parameters", async function () {
            const site = "example.com";
            const hash = ethers.keccak256(ethers.toUtf8Bytes("terms-v1"));

            const tx = await consentLedger.connect(user1).logConsent(site, hash);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);

            const event = receipt.logs.find(log => {
                try {
                    return consentLedger.interface.parseLog(log)?.name === "ConsentLogged";
                } catch {
                    return false;
                }
            });

            const parsedEvent = consentLedger.interface.parseLog(event);

            expect(parsedEvent.args.user).to.equal(user1.address);
            expect(parsedEvent.args.siteDomain).to.equal(site);
            expect(parsedEvent.args.termsHash).to.equal(hash);
            expect(parsedEvent.args.timestamp).to.equal(block.timestamp);
        });

        it("Should have indexed user parameter for efficient filtering", async function () {
            const site = "example.com";
            const hash = ethers.keccak256(ethers.toUtf8Bytes("terms-v1"));

            // Log consents from different users
            await consentLedger.connect(user1).logConsent(site, hash);
            await consentLedger.connect(user2).logConsent(site, hash);

            // Query events by user (this tests that user is indexed)
            const filter = consentLedger.filters.ConsentLogged(user1.address);
            const events = await consentLedger.queryFilter(filter);

            expect(events.length).to.equal(1);
            expect(events[0].args.user).to.equal(user1.address);
        });
    });

    describe("Gas Optimization", function () {
        it("Should use less gas for batch than individual calls", async function () {
            const sites = ["example.com", "test.com", "demo.org"];
            const hashes = [
                ethers.keccak256(ethers.toUtf8Bytes("terms-v1")),
                ethers.keccak256(ethers.toUtf8Bytes("terms-v2")),
                ethers.keccak256(ethers.toUtf8Bytes("terms-v3"))
            ];

            // Individual calls
            const tx1 = await consentLedger.connect(user1).logConsent(sites[0], hashes[0]);
            const receipt1 = await tx1.wait();
            const tx2 = await consentLedger.connect(user1).logConsent(sites[1], hashes[1]);
            const receipt2 = await tx2.wait();
            const tx3 = await consentLedger.connect(user1).logConsent(sites[2], hashes[2]);
            const receipt3 = await tx3.wait();

            const individualGas = receipt1.gasUsed + receipt2.gasUsed + receipt3.gasUsed;

            // Batch call
            const batchTx = await consentLedger.connect(user2).logConsentBatch(sites, hashes);
            const batchReceipt = await batchTx.wait();
            const batchGas = batchReceipt.gasUsed;

            console.log(`Individual gas: ${individualGas}`);
            console.log(`Batch gas: ${batchGas}`);
            const savings = Number(individualGas - batchGas);
            const percentage = (savings / Number(individualGas) * 100).toFixed(2);
            console.log(`Savings: ${savings} (${percentage}%)`);

            expect(batchGas).to.be.lessThan(individualGas);
        });
    });

    // Helper function to get the next block timestamp
    async function getBlockTimestamp() {
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        return block.timestamp + 1; // Next block will have timestamp + 1
    }
});
