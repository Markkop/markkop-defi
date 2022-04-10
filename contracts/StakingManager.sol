//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StakingManager {
    string private greeting;

    // Staking user
    struct User {
        uint256 amount; // How many LP tokens the user has staked.
        uint256 rewardLockedUp; // Reward locked up.
        uint256 nextHarvestUntil; // When the user can harvest again.
    }

    // Staking pool
    struct Pool {
        IERC20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. Reward tokens to distribute per block.
        uint256 lastRewardBlock; // Last block number that reward tokens distribution occurs.
        uint256 accPositionPerShare; // Accumulated reward tokens per share, times 1e12.
        uint16 depositFeeBP; // Deposit fee in basis points
        uint256 harvestInterval; // Harvest interval in seconds
    }

    // Staking pools
    Pool[] public pools;

    // A user from an user address from a staking pool
    mapping(uint256 => mapping(address => User)) public user;
}
