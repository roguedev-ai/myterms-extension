const { ethers } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  const recipient = process.env.RECIPIENT;
  const senderIndex = parseInt(process.env.SENDER_INDEX || "1");

  const funder = signers[senderIndex];
  const before = await ethers.provider.getBalance(recipient);
  console.log(`Balance before: ${ethers.formatEther(before)} ETH`);

  if (parseFloat(ethers.formatEther(before)) > 100) {
    console.log("Already well funded — no transfer needed.");
    return;
  }

  const tx = await funder.sendTransaction({ to: recipient, value: ethers.parseEther("10.0") });
  await tx.wait();

  const after = await ethers.provider.getBalance(recipient);
  console.log(`Sent 10 ETH from Account #${senderIndex}. New balance: ${ethers.formatEther(after)} ETH`);
}

main().catch(console.error);
