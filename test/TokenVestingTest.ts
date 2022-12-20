import chai, { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";

import { TokenVesting__factory } from "../typechain/factories/TokenVesting__factory";
import { TokenVesting } from "../typechain/TokenVesting";
import { TokenWithVaryingDecimals__factory } from "../typechain/factories/TokenWithVaryingDecimals__factory";
import { TokenWithVaryingDecimals } from "../typechain/TokenWithVaryingDecimals";
import { expandTo18Decimals } from "./shared/utilities";

chai.use(solidity);

async function increaseTime(timeToAdd: number) {
    await ethers.provider.send("evm_increaseTime", [timeToAdd]);
    await ethers.provider.send("evm_mine", []);
}

describe("Vesting tests", () => {
    let signers: Signer[];
    let token: TokenWithVaryingDecimals;
    let vesting: TokenVesting;

    beforeEach(async () => {
        signers = await ethers.getSigners();
        token = await new TokenWithVaryingDecimals__factory(signers[0])
            .deploy("Token", "TST", 18);
        vesting = await new TokenVesting__factory(signers[0]).deploy(
            token.address
        );

        // mint tokens
        await token.mint(
            await signers[0].getAddress(),
            expandTo18Decimals(1000000)
        );
        // approve spending
        await token.connect(signers[0])
            .approve(vesting.address, expandTo18Decimals(1000000));
    });

    
    it("Can create multiple plans", async () => {
        //Create new payment plans
        await vesting.connect(signers[0]).addPaymentPlan(1000, 10, 2);
        await vesting.connect(signers[0]).addPaymentPlan(2000, 10, 2);
        await vesting.connect(signers[0]).addPaymentPlan(3000, 10, 2);

        // check that payment plans number equals 3
        let plansNumber = await vesting.paymentPlansCount();
        expect(plansNumber).to.be.equal(3);
    });

    it("Can't create an invalid plan", async () => {
        // try to create an invalid paymentPlan
        await expect(vesting.connect(signers[0])
            .addPaymentPlan(3000, 10, 15))
            .to.be.revertedWith("TokenVesting: invalid cliff periods")
    });

    it("Can revoke a plan", async () => {
        // revoke last plan and check it is revoked
        await vesting.connect(signers[0]).addPaymentPlan(1000, 10, 2);
        await vesting.connect(signers[0]).setRevoked(0, true);
        let isRevoked = (await vesting.paymentPlans(0)).revoked;
        expect(isRevoked).to.be.true;
    });

    it("Can setup a lock instance", async () => {
        await vesting.connect(signers[0]).addPaymentPlan(1000, 10, 2);
        const lockAmount = expandTo18Decimals(1000)
        
        const currentTime = (await ethers.provider.getBlock("latest"))
            .timestamp;
        const beneficiary = await signers[1].getAddress();
        const lockStart = BigNumber.from(currentTime + 2000)
        const lockPaymentPlan = 0
        expect(await vesting.connect(signers[0])
            .lock(beneficiary, lockAmount, lockStart, lockPaymentPlan)
            ).to.be.to.emit(vesting, "TokensLocked");
        
        // check if values have been properly set
        let details = await vesting.detailsOf(beneficiary);
        expect(details[0].beneficiary).to.be.equal(beneficiary);
        expect(details[0].totalAmount).to.be.equal(lockAmount);
        expect(details[0].start).to.be.equal(lockStart);
        expect(details[0].paymentPlan).to.be.equal(lockPaymentPlan);
    });
    
    describe("Can't create a lock violating rules", () => {
        const lockAmount = expandTo18Decimals(1000);
        let lockStart: any;
        let currentTime: any;
        let beneficiary: any, beneficiary2: any;
        const lockPaymentPlan = 0

        beforeEach(async () => {
            currentTime = (await ethers.provider.getBlock("latest")).timestamp;
            beneficiary = await signers[1].getAddress();
            beneficiary2 = await signers[2].getAddress();
            lockStart = BigNumber.from(currentTime + 2000);

            await vesting.connect(signers[0]).addPaymentPlan(1000, 10, 2);
            expect(await vesting.connect(signers[0])
                .lock(beneficiary, lockAmount, lockStart, lockPaymentPlan)
                ).to.be.to.emit(vesting, "TokensLocked");
        });
    
        it("Can't assign a revoked plan", async () => {
            await vesting.connect(signers[0]).setRevoked(0, true);
            const beneficiary2 = await signers[2].getAddress();
            await expect(vesting.connect(signers[0])
                .lock(beneficiary2, lockAmount, lockStart, 0)
                ).to.be.revertedWith("Payment Plan has Already Revoked");  
            await vesting.connect(signers[0]).setRevoked(0, false);
        });
    
        it("Can't assign a new vesting lock to the same address", async () => {
            await expect(vesting.connect(signers[0])
                .lock(beneficiary, lockAmount, lockStart, lockPaymentPlan)
                ).to.be.revertedWith("TokenVesting: already locked")
        });
    
        it("Can't assign a new vesting lock to zero address", async () => {
            const nullAddress = "0x0000000000000000000000000000000000000000";
            await expect(vesting.connect(signers[0])
                .lock(nullAddress, lockAmount, lockStart, lockPaymentPlan)
                ).to.be.revertedWith("TokenVesting: beneficiary is the zero address")
        });
    
        it("Can't assign a new vesting lock with an invalid start parameter", async () => {
            const dateInThePast = BigNumber.from(currentTime - 2000);
            await expect(vesting.connect(signers[0])
                .lock(beneficiary2, lockAmount, dateInThePast, lockPaymentPlan)
                ).to.be.revertedWith("TokenVesting: final time is before current time")
        });
    
        it("Can't assign a new vesting lock with an insufficient allowance", async () => {
            await token.connect(signers[0]).approve(vesting.address, 0);
            await expect(vesting.connect(signers[0])
                .lock(beneficiary2, lockAmount, lockStart, 0)
                ).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
            await token.connect(signers[0]).approve(vesting.address, expandTo18Decimals(1000000));
        });
    
        it("Can't assign a new vesting lock with an invalid payment plan", async () => {
            await expect(vesting.connect(signers[0])
                .lock(beneficiary2, lockAmount, lockStart, 5)
                ).to.be.revertedWith("TokenVesting: invalid payment plan");
        });

    });

    describe("Release checks", () => {
        let beneficiary: any, beneficiary2: any;
        const cliffPeriods = 2;
        const periodLength = 1000;

        beforeEach(async () => {
            const lockAmount = expandTo18Decimals(1000);
            const lockPaymentPlan = 0
            let currentTime = (await ethers.provider.getBlock("latest")).timestamp;
            beneficiary = await signers[1].getAddress();
            beneficiary2 = await signers[2].getAddress();
            let lockStart = BigNumber.from(currentTime + 1000);

            await vesting.connect(signers[0]).addPaymentPlan(periodLength, 10, cliffPeriods);
            expect(await vesting.connect(signers[0])
                .lock(beneficiary, lockAmount, lockStart, lockPaymentPlan)
                ).to.be.to.emit(vesting, "TokensLocked");
        });
    
        it("Releasable amount is 0 when period not started", async () => {
            expect(await vesting.releasableAmount(beneficiary)).to.be.equal(0);
        });
    
        it("Release reverts with error if no tokens are available", async () => {
            await expect(
                vesting.connect(signers[1]).release(beneficiary)
            ).to.be.revertedWith("TokenVesting: no tokens available");
        });
    
        it("Releasable amount is 0 when cliff period is active", async () => {
            await increaseTime(cliffPeriods * periodLength);
            expect(await vesting.releasableAmount(beneficiary)).to.be.equal(0);
            //Release reverts with error.
            await expect(
                vesting.connect(signers[1]).release(beneficiary)
            ).to.be.revertedWith("TokenVesting: no tokens available");
        });
    
        it("Multiple token releases after cliff period", async () => {
            let toIncrease = cliffPeriods * periodLength + 1000
            await increaseTime(toIncrease);

            // Releasable amount is 200 when cliff period is over
            expect(await vesting.releasableAmount(beneficiary)).to.be.equal(
                expandTo18Decimals(200)
            );

            // tokens get released
            await expect(
                vesting.connect(signers[1]).release(beneficiary)
            ).to.be.to.emit(vesting, "TokensReleased");


            // No tokens available after release.
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
        });
    
        it("Single token release after cliff period", async () => {
            let lockStart = BigNumber.from(
                (await ethers.provider.getBlock("latest")).timestamp + 1000);

            expect(await vesting.connect(signers[0])
                .lock(beneficiary2, expandTo18Decimals(5000), lockStart, 0)
                ).to.be.to.emit(vesting, "TokensLocked");

            await increaseTime(11000);

            //Releasable amount is 5000 when vesting is over;
            expect(await vesting.releasableAmount(beneficiary2)).to.be.equal(
                expandTo18Decimals(5000)
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
            expect(await token.balanceOf(beneficiary2)).to.be.equal(
                expandTo18Decimals(5000)
            );
        });

    });
});
