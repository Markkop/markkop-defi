import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { RewardToken, StakingManager } from "../typechain";

async function deployRewardToken(): Promise<RewardToken> {
  const RewardToken = await ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy();
  await rewardToken.deployed();
  return rewardToken;
}

async function deployStakingManager(
  rewardTokenAddress: string,
  rewardTokensPerBlock: BigNumber
): Promise<StakingManager> {
  const StakingManager = await ethers.getContractFactory("StakingManager");
  const stakingManager = await StakingManager.deploy(
    rewardTokenAddress,
    rewardTokensPerBlock
  );
  await stakingManager.deployed();
  return stakingManager;
}

async function grantRewardTokenMinterRole(
  stakingManagerAddress: string,
  rewardToken: RewardToken
) {
  const transaction = await rewardToken.grantRole(
    solidityKeccak256(["string"], ["MINTER_ROLE"]),
    stakingManagerAddress
  );
  return await transaction.wait();
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
  let account2: SignerWithAddress;
  const rewardTokensPerBlock = ethers.utils.parseEther("4");

  this.beforeEach(async () => {
    rewardToken = await deployRewardToken();
    stakingManager = await deployStakingManager(
      rewardToken.address,
      rewardTokensPerBlock
    );
    await grantRewardTokenMinterRole(stakingManager.address, rewardToken);
    [account1, account2] = await ethers.getSigners();
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
    const amount = ethers.utils.parseEther("10");
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
  });

  it("Withdraw tokens and harvest rewards from a pool", async function () {
    // Arrange
    const stakeToken = rewardToken;
    const account1PreviousBalance = await stakeToken.balanceOf(
      account1.address
    );
    await createStakingPool(stakingManager, stakeToken.address);
    const amount = ethers.utils.parseEther("20");
    await stakeToken.approve(stakingManager.address, amount);
    await stakingManager.deposit(0, amount);
    const startingBlockNumber = await ethers.provider.getBlockNumber();

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
    const endingBlockNumber = await ethers.provider.getBlockNumber();
    const blocksPassed = endingBlockNumber - startingBlockNumber;
    const rewards = rewardTokensPerBlock.mul(blocksPassed);
    const previousBalanceWithRewards = account1PreviousBalance.add(
      BigNumber.from(rewards)
    );
    expect(account1Balance).to.be.equal(previousBalanceWithRewards);
  });

  it("Harvest rewards according with the staker pool's share", async function () {
    // Arrange Pool
    const stakeToken = rewardToken;
    await stakeToken.transfer(
      account2.address,
      ethers.utils.parseEther("200000") // 200.000
    );
    await createStakingPool(stakingManager, stakeToken.address);
    const amount1 = ethers.utils.parseEther("80");
    const amount2 = ethers.utils.parseEther("20");

    // Arrange Account1 staking
    await stakeToken.approve(stakingManager.address, amount1);
    await stakingManager.deposit(0, amount1);

    // Arrange Account 2 staking
    await stakeToken.connect(account2).approve(stakingManager.address, amount2);
    await stakingManager.connect(account2).deposit(0, amount2);

    // Act
    // await ethers.provider.send("evm_mine", []); // Mine a block
    const acc1HarvestTransaction = await stakingManager.harvestRewards(0);
    const acc2HarvestTransaction = await stakingManager
      .connect(account2)
      .harvestRewards(0);

    // Assert

    // 2 blocks with 100% participation = 4 reward tokens * 2 blocks = 8
    // 1 block with 80% participation = 3.2 reward tokens * 1 block = 3.2
    // Account1 Total = 8 + 3.2 = 11.2 reward tokens
    const expectedAccount1Rewards = ethers.utils.parseEther("11.2");
    await expect(acc1HarvestTransaction)
      .to.emit(stakingManager, "HarvestRewards")
      .withArgs(account1.address, 0, expectedAccount1Rewards);

    // 2 block with 20% participation = 0.8 reward tokens * 2 block
    // Account 1 Total = 1.6 reward tokens
    const expectedAccount2Rewards = ethers.utils.parseEther("1.6");
    await expect(acc2HarvestTransaction)
      .to.emit(stakingManager, "HarvestRewards")
      .withArgs(account2.address, 0, expectedAccount2Rewards);
  });
});
