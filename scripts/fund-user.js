const hre = require("hardhat");

async function main() {
    // Hardcoded address from user request
    const recipientAddress = "0x4ddeb2d99a4a0022c3deb44e133ac802a5566e15";
    const amountStr = "1000.0";
    const amount = hre.ethers.parseEther(amountStr);

    console.log(`Funding address: ${recipientAddress} with ${amountStr} ETH...`);

    const [sender] = await hre.ethers.getSigners();
    console.log(`Sending from: ${sender.address} `);

    const tx = await sender.sendTransaction({
        to: recipientAddress,
        value: amount,
    });

    await tx.wait();

    console.log(`Transaction successful! Hash: ${tx.hash} `);
    console.log(`New balance of ${recipientAddress}: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(recipientAddress))} ETH`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
