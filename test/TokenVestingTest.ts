import chai, { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";

import { TokenVesting__factory } from "../typechain/factories/TokenVesting__factory";
import { TokenMock__factory } from "../typechain/factories/TokenMock__factory";
import { TokenMock } from "../typechain/TokenMock";
import {
    expandTo18Decimals
} from "./shared/utilities";

chai.use(solidity);

async function increaseTime(timeToAdd: number) {
    await ethers.provider.send("evm_increaseTime", [timeToAdd]);
    await ethers.provider.send("evm_mine", []);
}

describe("Vesting tests", () => {
    let signers: Signer[];
    let token: TokenMock;

    beforeEach(async () => {
        signers = await ethers.getSigners();
        token = await new TokenMock__factory(signers[0]).deploy("Token", "TST");
    });

    it("Vesting works", async () => {
        const vesting = await new TokenVesting__factory(signers[0]).deploy(
            token.address
        );
        await token.mint(
            await signers[0].getAddress(),
            expandTo18Decimals(10000)
        );
        await token
            .connect(signers[0])
            .approve(vesting.address, expandTo18Decimals(10000000));
        //Create new payment plan
        await vesting.connect(signers[0]).addPaymentPlan(1000, 10, 2);

        const currentTime = (await ethers.provider.getBlock("latest"))
            .timestamp;
        const beneficiary = await signers[1].getAddress();

        expect(
            await vesting
                .connect(signers[0])
                .lock(
                    beneficiary,
                    expandTo18Decimals(1000),
                    BigNumber.from(currentTime + 2000),
                    0
                )
        ).to.be.to.emit(vesting, "TokensLocked");

        //Releasable amount is 0 when period not started;
        expect(await vesting.releasableAmount(beneficiary)).to.be.equal(0);
        //Release reverts with error.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.revertedWith("TokenVesting: no tokens available");

        await increaseTime(2000);
        //Releasable amount is 0 when cliff period is active;
        expect(await vesting.releasableAmount(beneficiary)).to.be.equal(0);
        //Release reverts with error.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.revertedWith("TokenVesting: no tokens available");

        await increaseTime(1500);
        //Releasable amount is 0 when cliff period is STILL active;
        expect(await vesting.releasableAmount(beneficiary)).to.be.equal(0);
        //Release reverts with error.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.revertedWith("TokenVesting: no tokens available");

        await increaseTime(500);
        //Releasable amount is 200 when cliff period is over;
        expect(await vesting.releasableAmount(beneficiary)).to.be.equal(
            expandTo18Decimals(200)
        );
        //Release reverts with error.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.to.emit(vesting, "TokensReleased");
        //No tokens available after release.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.revertedWith("TokenVesting: no tokens available");

        await increaseTime(1000);
        //Releasable amount is 100 when first period after cliff is over
        expect(await vesting.releasableAmount(beneficiary)).to.be.equal(
            expandTo18Decimals(100)
        );
        //Release reverts with error.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.to.emit(vesting, "TokensReleased");
        //No tokens available after release.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.revertedWith("TokenVesting: no tokens available");

        await increaseTime(7000);
        //Releasable amount is 700 when vesting is over;
        expect(await vesting.releasableAmount(beneficiary)).to.be.equal(
            expandTo18Decimals(700)
        );
        //Release reverts with error.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.to.emit(vesting, "TokensReleased");
        //No tokens available after release.
        await expect(
            vesting.connect(signers[1]).release(beneficiary)
        ).to.be.revertedWith("TokenVesting: no tokens available");

        //Only 1 final release
        const beneficiary2 = await signers[2].getAddress();
        expect(
            await vesting
                .connect(signers[0])
                .lock(
                    beneficiary2,
                    expandTo18Decimals(1000),
                    BigNumber.from(
                        (await ethers.provider.getBlock("latest")).timestamp +
                            1000
                    ),
                    0
                )
        ).to.be.to.emit(vesting, "TokensLocked");
        await increaseTime(11005);
        //Releasable amount is 1000 when vesting is over;
        expect(await vesting.releasableAmount(beneficiary2)).to.be.equal(
            expandTo18Decimals(1000)
        );
        //Release reverts with error.
        await expect(vesting.release(beneficiary2)).to.be.to.emit(
            vesting,
            "TokensReleased"
        );
        //No tokens available after release.
        await expect(vesting.release(beneficiary2)).to.be.revertedWith(
            "TokenVesting: no tokens available"
        );

        expect(await token.balanceOf(beneficiary)).to.be.equal(
            expandTo18Decimals(1000)
        );
        expect(await token.balanceOf(beneficiary2)).to.be.equal(
            expandTo18Decimals(1000)
        );
    });
});
