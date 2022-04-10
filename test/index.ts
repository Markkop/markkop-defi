import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { RewardToken, StakingManager } from "../typechain";

async function deployRewardToken(): Promise<RewardToken> {
  const RewardToken = await ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy();
  await rewardToken.deployed();
  return rewardToken;
}

async function deployStakingManager(
  rewardTokenAddress: string
): Promise<StakingManager> {
  const StakingManager = await ethers.getContractFactory("StakingManager");
  const stakingManager = await StakingManager.deploy(rewardTokenAddress);
  await stakingManager.deployed();
  return stakingManager;
}

async function createStakingPool(
  stakingManager: StakingManager,
  stakeTokenAddress: string
) {
  return await stakingManager.createPool(stakeTokenAddress);
}

describe("StakingManager", function () {
  let rewardToken: RewardToken;
  let stakingManager: StakingManager;
  let account1: SignerWithAddress;

  this.beforeEach(async () => {
    rewardToken = await deployRewardToken();
    stakingManager = await deployStakingManager(rewardToken.address);
    [account1] = await ethers.getSigners();
  });

  it("Creates a new pool", async function () {
    await expect(createStakingPool(stakingManager, rewardToken.address))
      .to.emit(stakingManager, "PoolCreated")
      .withArgs(0);
  });

  it("Deposits a token in the first pool", async function () {
    // Arrange
    const stakeToken = rewardToken;
    await createStakingPool(stakingManager, stakeToken.address);
    const amount = 10;
    await stakeToken.approve(stakingManager.address, amount);

    // Act
    const depositTransaction = await stakingManager.deposit(0, amount);

    // Assert
    await expect(depositTransaction)
      .to.emit(stakingManager, "Deposit")
      .withArgs(account1.address, 0, amount);

    const stakingManagerBalance = await stakeToken.balanceOf(
      stakingManager.address
    );
    expect(stakingManagerBalance).to.be.equal(amount);
  });

  it("Withdraw all tokens from a pool", async function () {
    // Arrange
    const stakeToken = rewardToken;
    const account1PreviousBalance = await stakeToken.balanceOf(
      account1.address
    );
    await createStakingPool(stakingManager, stakeToken.address);
    const amount = 20;
    await stakeToken.approve(stakingManager.address, amount);
    await stakingManager.deposit(0, amount);

    // Act
    const withdrawTransaction = await stakingManager.withdraw(0);

    // Assert
    await expect(withdrawTransaction)
      .to.emit(stakingManager, "Withdraw")
      .withArgs(account1.address, 0, amount);

    const stakingManagerBalance = await stakeToken.balanceOf(
      stakingManager.address
    );
    expect(stakingManagerBalance).to.be.equal(0);

    const account1Balance = await stakeToken.balanceOf(account1.address);
    expect(account1Balance).to.be.equal(account1PreviousBalance);
  });
});
