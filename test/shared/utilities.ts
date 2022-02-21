import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function expandTo18Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

export function expandToDecimals(n: number, d: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(d));
}

export async function mineBlock(
    provider: typeof ethers.provider,
    timestamp: number
): Promise<void> {
    await provider.send("evm_setNextBlockTimestamp", [timestamp]);
}
