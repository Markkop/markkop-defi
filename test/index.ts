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
    await createStakingPool(stakingManager, rewardToken.address);

    const amount = 10;
    await rewardToken.approve(stakingManager.address, amount);

    await expect(stakingManager.deposit(0, amount))
      .to.emit(stakingManager, "Deposit")
      .withArgs(account1.address, 0, amount);

    const stakingManagerBalance = await rewardToken.balanceOf(
      stakingManager.address
    );
    expect(stakingManagerBalance).to.be.equal(10);
  });
});
