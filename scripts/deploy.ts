import { ethers } from "hardhat";
import { TokenVesting__factory } from "../typechain/factories/TokenVesting__factory";
import { parseEthAddress } from "../test/shared/parser";

// This is a script for deploying your contracts. You can adapt it to deploy
// yours, or create new ones.
async function main() {
    // This is just a convenience check
    const [deployer] = await ethers.getSigners();
    const tokenAddress = parseEthAddress("TOKEN_ADDRESS");
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Deploy contracts");
    const vestingContract = await new TokenVesting__factory(deployer).deploy(
        tokenAddress
    );
    console.log("Vesting contract deployed: ", await vestingContract.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
