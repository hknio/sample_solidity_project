import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy-ethers";
import "hardhat-deploy";
import "hardhat-typechain";
import "@typechain/ethers-v5";
import "@nomiclabs/hardhat-etherscan";

import * as dotenv from "dotenv";
import { accounts } from "./test/shared/accounts";

dotenv.config();

const secret: string = process.env.PRIVATE_KEY as string;
const etherscanKey: string = process.env.ETHERSCAN_API_KEY as string;

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
    const accounts = await hre.ethers.getSigners();
    for (const account of accounts) {
        console.log(account.address);
    }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.11",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            gas: 15000000,
            gasPrice: 875000000,
            blockGasLimit: 15000000,
            allowUnlimitedContractSize: true,
            accounts: accounts,
        },
        // mumbai: {
        //     url: "https://rpc-mumbai.maticvigil.com",
        //     chainId: 80001,
        //     accounts: [secret],
        //     gas: "auto",
        //     gasPrice: 1000000000, // 1 gwei
        //     gasMultiplier: 1.5,
        // },
        // rinkeby: {
        //   url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
        //   accounts: [secret],
        // },
        // ropsten: {
        //   url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
        //   accounts: [secret],
        // },
        // mainnet: {
        //   url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
        //   accounts: [secret],
        // },
        coverage: {
            url: "http://127.0.0.1:8555", // Coverage launches its own ganache-cli client
        },
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: etherscanKey,
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v5",
    },
};
export default config;
