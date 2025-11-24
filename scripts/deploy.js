// Deployment script for MyTermsConsentLedger contract
const hre = require("hardhat");

async function main() {
    console.log("Deploying MyTermsConsentLedger contract...");

    // Get the contract factory
    const MyTermsConsentLedger = await hre.ethers.getContractFactory("MyTermsConsentLedger");

    // Deploy the contract
    const consentLedger = await MyTermsConsentLedger.deploy();

    await consentLedger.waitForDeployment();

    const address = await consentLedger.getAddress();

    console.log("MyTermsConsentLedger deployed to:", address);
    console.log("\nDeployment details:");
    console.log("- Network:", hre.network.name);
    console.log("- Contract Address:", address);
    console.log("- Deployer:", (await hre.ethers.getSigners())[0].address);

    // Wait for a few block confirmations before verification
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("\nWaiting for block confirmations...");
        await consentLedger.deploymentTransaction().wait(5);

        console.log("\nTo verify the contract on Etherscan, run:");
        console.log(`npx hardhat verify --network ${hre.network.name} ${address}`);
    }

    // Save deployment info to a file
    const fs = require("fs");
    const deploymentInfo = {
        network: hre.network.name,
        contractAddress: address,
        deployer: (await hre.ethers.getSigners())[0].address,
        deploymentTime: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber()
    };

    const deploymentPath = `./deployments/${hre.network.name}.json`;
    fs.mkdirSync("./deployments", { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\nDeployment info saved to ${deploymentPath}`);

    return address;
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
