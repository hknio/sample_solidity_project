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
import { TokenVesting } from "../typechain/TokenVesting";
import { version } from "os";
import { stat } from "fs";

chai.use(solidity);

async function increaseTime(timeToAdd: number) {
    await ethers.provider.send("evm_increaseTime", [timeToAdd]);
    await ethers.provider.send("evm_mine", []);
}

describe("Payment Plan Creation", function(){
    // Variables
    let accounts: Signer[];
    let token: TokenMock;
    
    // Initial Setup
    beforeEach(async () => {
        accounts = await ethers.getSigners();
        token = await new TokenMock__factory(accounts[0]).deploy("Token", "TST");
    });

    // Tests
    it("Vesting Admin Creates a Payment Plan", async function () {
       this.timeout(0);
       // Deploy TokenVesting 
       const vesting = await new TokenVesting__factory(accounts[0]).deploy(token.address);
       // Mint initial token amount for the admin
       await token.mint(await accounts[0].getAddress(), expandTo18Decimals(10000));
       await token.connect(accounts[0]).approve(vesting.address, expandTo18Decimals(10000000));
       // Create a Payment Plan
       await vesting.connect(accounts[0]).addPaymentPlan(1000, 10, 2);
       // Check if the Plan has been created
       let payment_plans =  await vesting.connect(accounts[0]).paymentPlansCount();
       expect(payment_plans).gte(0);
    });
    it("Vestor Tries to Create a Payment Plan (Should REVERT)", async function () {
        this.timeout(0);
        // Deploy TokenVesting & Handle Other Configs
        const vesting = await new TokenVesting__factory(accounts[0]).deploy(token.address);
        const vestor = await accounts[1].getAddress();
        // Mint initial token amount for the admin
        await token.mint(await accounts[0].getAddress(), expandTo18Decimals(10000));
        await token.connect(accounts[0]).approve(vesting.address, expandTo18Decimals(10000000));
        // Mint some amount of token for the vestor
        await token.mint(vestor, expandTo18Decimals(1000));
        await token.connect(accounts[1]).approve(vesting.address, expandTo18Decimals(10000));
        // Try to Create a Payment Plan & Revert
        await expect(vesting.connect(vestor).addPaymentPlan(100, 10, 2)).to.be.reverted;
     });
});

describe("Fund Locking", () =>{
    // Variables
    let accounts: Signer[];
    let token: TokenMock;
    let vesting: TokenVesting;
    
    // Initial Setup
    beforeEach(async () => {
        accounts = await ethers.getSigners();
        token = await new TokenMock__factory(accounts[0]).deploy("Token", "TST");
        // Deploy TokenVesting 
        vesting = await new TokenVesting__factory(accounts[0]).deploy(token.address);
        // Mint initial token amount for the admin
        await token.mint(await accounts[0].getAddress(), expandTo18Decimals(10000));
        await token.connect(accounts[0]).approve(vesting.address, expandTo18Decimals(10000000));
        // Create Payment Plans
        await vesting.connect(accounts[0]).addPaymentPlan(1000, 10, 2);
    });

    // Tests
    it("Vestor Successfully Locks Some Funds for Himself", async function() {
        this.timeout(0);
        const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
        // Vestor Setup
        const vestor = await accounts[1].getAddress();
        let tx = await token.mint(vestor, expandTo18Decimals(10000));
        await tx.wait();
        tx = await token.connect(accounts[1]).approve(vesting.address, expandTo18Decimals(10000000));
        await tx.wait();   
        // Lock Funds    
        expect(await vesting.connect(accounts[1]).lock(vestor,expandTo18Decimals(1000), BigNumber.from(currentTime + 2000),0)).to.be.to.emit(vesting, "TokensLocked");
    });
    it("Vestor Successfully Locks Some Funds for another address", async function() {
        this.timeout(0);
        const vestor1 = await accounts[1].getAddress();
        const vestor2 = await accounts[1].getAddress();
        const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
        // Vestor1 Setup
        let tx = await token.mint(vestor1, expandTo18Decimals(10000));
        await tx.wait();
        tx = await token.connect(accounts[1]).approve(vesting.address, expandTo18Decimals(10000000));
        await tx.wait(); 
        // Lock Funds 
        expect(await vesting.connect(accounts[1]).lock(vestor2, expandTo18Decimals(1000), BigNumber.from(currentTime + 2000),0)).to.be.to.emit(vesting, "TokensLocked");
    });
    it("Vestor Tries to Lock Some Funds to a Revoked Plan (Should REVERT)", async () => {
        const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
        // Vestor Setup
        const vestor = await accounts[1].getAddress();
        let tx = await token.mint(vestor, expandTo18Decimals(10000));
        await tx.wait();
        tx = await token.connect(accounts[1]).approve(vesting.address, expandTo18Decimals(10000000));
        await tx.wait(); 
        // Revoke the Payment Plan
        tx = await vesting.connect(accounts[0]).setRevoked(0, true);
        await tx.wait();
        // Vestor Tries to Lock Funds into the Revoked Payment Plan
        await expect(vesting.connect(accounts[1]).lock(vestor, expandTo18Decimals(1000), BigNumber.from(currentTime + 2000),0)).to.be.revertedWith("Payment Plan has Already Revoked");
    });
    it("Vestor Locks Tries to Lock Some Funds to a Non-Existing Plan (Should REVERT)", async () => {
        const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
        // Vestor Setup
        const vestor = await accounts[1].getAddress();
        let tx = await token.mint(vestor, expandTo18Decimals(10000));
        await tx.wait();
        tx = await token.connect(accounts[1]).approve(vesting.address, expandTo18Decimals(10000000));
        await tx.wait(); 
        // Vestor Tries to Lock Funds
        await expect(vesting.connect(accounts[1]).lock(vestor, expandTo18Decimals(1000), BigNumber.from(currentTime + 2000),1)).to.be.reverted;
    });
});

describe("Fund Releasing", function(){
    // Variables
    let accounts: Signer[];
    let token: TokenMock;
    let vesting: TokenVesting;

     // Initial Setup
     beforeEach(async () => {
        accounts = await ethers.getSigners();
        token = await new TokenMock__factory(accounts[0]).deploy("Token", "TST");
        // Deploy TokenVesting 
        vesting = await new TokenVesting__factory(accounts[0]).deploy(token.address);
        // Mint initial token amount for the admin
        await token.mint(await accounts[0].getAddress(), expandTo18Decimals(10000));
        await token.connect(accounts[0]).approve(vesting.address, expandTo18Decimals(10000000));
        // Create a Payment Plan
        await vesting.connect(accounts[0]).addPaymentPlan(1000, 10, 2);
        // Vestor Setup
        const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
        const vestor = await accounts[1].getAddress();
        let tx = await token.mint(vestor, expandTo18Decimals(10000));
        await tx.wait();
        tx = await token.connect(accounts[1]).approve(vesting.address, expandTo18Decimals(10000000));
        await tx.wait();
        // Vestor Locks Funds 
        expect(await vesting.connect(accounts[1]).lock(vestor,expandTo18Decimals(1000), BigNumber.from(currentTime + 2000),0)).to.be.to.emit(vesting, "TokensLocked");
    });

    // Tests
    it("Releasable Amount is 0 Before Start", async function() {
        expect(await vesting.releasableAmount(await accounts[1].getAddress())).to.be.equal(0);
    });
    it("Releasable Amount is 0 During Cliff", async function() {
        // Advance Time
        await increaseTime(2000);
        expect(await vesting.releasableAmount(await accounts[1].getAddress())).to.be.equal(0);
    });
    it("Vestor Cannot Release during Cliff Period", async function() {
        // Advance Time
        await increaseTime(2000);
        const vestor = await accounts[1].getAddress();
        // Try to Release
        await expect(vesting.connect(accounts[1]).release(vestor)).to.be.revertedWith("TokenVesting: no tokens available");
    });
    it("Releasable Amount is > 0 After  Cliff", async function() {
        // Advance Time
        await increaseTime(4000);
        const vestor = await accounts[1].getAddress();
        // Check
        expect(await vesting.releasableAmount(await accounts[1].getAddress())).to.be.gte(0);
    });
    it("Vestor Successfully Releases his Locked Funds to Himself after Cliff Period Ends", async function() {
        // Advance Time
        await increaseTime(4000);
        const vestor = await accounts[1].getAddress();
        // Release Funds
        await expect(vesting.connect(accounts[1]).release(vestor)).to.be.to.emit(vesting, "TokensReleased");
        // Check Release
        expect(await token.balanceOf(vestor)).to.be.equal(expandTo18Decimals(9200));
    });
    it("Vestor Successfully Releases his Locked Funds to Himself After Plan Ends", async function() {
        // Advance Time
        await increaseTime(13000);
        const vestor = await accounts[1].getAddress();
        // Release Funds
        await expect(vesting.connect(accounts[1]).release(vestor)).to.be.to.emit(vesting, "TokensReleased");
        // Check Release
        expect(await token.balanceOf(vestor)).to.be.equal(expandTo18Decimals(10000));
    });
    it("Releasable Amount is 0  After a Release", async function() {
        // Advance Time
        await increaseTime(4000);
        const vestor = await accounts[1].getAddress();
        // Release Funds
        let tx =  await vesting.connect(accounts[1]).release(vestor);
        await tx.wait();
        // Check Funds
        await expect(vesting.connect(accounts[1]).release(vestor)).to.be.revertedWith("TokenVesting: no tokens available");
    });
});

describe("Revoking Payment Plans", function(){
    // Variables
    let accounts: Signer[];
    let token: TokenMock;
    let vesting: TokenVesting;

    // Initial Setup
    beforeEach(async () => {
        accounts = await ethers.getSigners();
        token = await new TokenMock__factory(accounts[0]).deploy("Token", "TST");
        // Deploy TokenVesting 
        vesting = await new TokenVesting__factory(accounts[0]).deploy(token.address);
        // Mint initial token amount for the admin
        await token.mint(await accounts[0].getAddress(), expandTo18Decimals(10000));
        await token.connect(accounts[0]).approve(vesting.address, expandTo18Decimals(10000000));
        // Create Payment Plans
        await vesting.connect(accounts[0]).addPaymentPlan(1000, 10, 2);
    });

    // Tests
    it("Vesting Admin Successfully Revokes a Plan", async function() {
        // Revoke
        let tx = await vesting.connect(accounts[0]).setRevoked(0, true);
        await tx.wait();
        let stats = await vesting.connect(accounts[0]).getRevoked(0);
        // Check
        expect(stats).to.be.equal(true);
    });
    it("Vesting Admin Tries to Revoke an Already Revoked Plan (SHOULD REVERT)", async function() {
        // Vesting Admin Revokes A Plan
        let tx = await vesting.connect(accounts[0]).setRevoked(0, true);
        await tx.wait();
        // Then Tries to Revoke it Again
        await expect(vesting.connect(accounts[0]).setRevoked(0, true)).to.be.revertedWith("Payment Plan has Already Revoked");
    });
    it("A Vestor  Tries to Revoke a Plan (SHOULD REVERT)", async function() {
        // Vestor Setup
        const vestor = await accounts[1].getAddress();
        // Vestor Tries to Revoke the Plan
        await expect(vesting.connect(accounts[1]).setRevoked(0, true)).to.be.reverted;
    });
});
