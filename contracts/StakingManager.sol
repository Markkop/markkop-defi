//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RewardToken.sol";

contract StakingManager is Ownable{
    // Token to be payed as reward
    RewardToken public rewardToken;

    // Staking user for a pool
    struct PoolStaker {
        uint256 amount; // How many tokens the user has staked.
    }

    // Staking pool
    struct Pool {
        IERC20 stakeToken; // Token to be staked
    }

    // Staking pools
    Pool[] public pools;

    // Mapping poolId => staker address => PoolStaker
    mapping(uint256 => mapping(address => PoolStaker)) public poolStakers;

    // Events
    event Deposit(address indexed user, uint256 indexed poolId, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed poolId, uint256 amount);
    event PoolCreated(uint256 poolId);

    // Constructor
    constructor(address rewardTokenAddress) {
        rewardToken = RewardToken(rewardTokenAddress);
    }

    /**
     * @dev Create a new staking pool
     */
    function createPool(IERC20 _stakeToken) public onlyOwner {
        pools.push(Pool({
            stakeToken: _stakeToken
        }));
        uint256 poolId = pools.length - 1;
        emit PoolCreated(poolId);
    }

    /**
     * @dev Deposit tokens to an existing pool
     */
    function deposit(uint256 _poolId, uint256 _amount) public {
        require(_amount > 0, "Deposit amount can't be zero");
        Pool storage pool = pools[_poolId];
        PoolStaker storage staker = poolStakers[_poolId][msg.sender];
        pool.stakeToken.transferFrom(
            address(msg.sender),
            address(this),
            _amount
        );
        staker.amount = staker.amount + _amount;
        emit Deposit(msg.sender, _poolId, _amount);
    }

    /**
     * @dev Withdraw all tokens from an existing pool
     */
    function withdraw(uint256 _poolId) public {
        Pool storage pool = pools[_poolId];
        PoolStaker storage staker = poolStakers[_poolId][msg.sender];
        uint256 amount = staker.amount;
        require(amount > 0, "Withdraw amount can't be zero");
        staker.amount = 0;
        pool.stakeToken.transfer(
            address(msg.sender),
            amount
        );
        emit Withdraw(msg.sender, _poolId, amount);
    }
}
