// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./interfaces/IERC20Detailed.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 */
contract TokenVesting is Ownable, AccessControl {
    
    /**
     * @notice Payment plan details structure
     * @param periodLength Length of each period, expressed in seconds
     * @param periods Total vesting periods of the payment plan
     * @param cliff Initial period for which no distribution will happen, expressed in 
     * seconds. Tokens unlocked during this period will be available for release after the 
     * cliff period has passed
     * @param revoked True if the payment plan has been invalidated by administrators
     */
    struct PaymentPlan {
        uint256 periodLength;
        uint256 periods;
        uint256 cliff;
        bool revoked;
    }

    /**
     * @notice Lock structure. Keeps track of token distribution
     * @param beneficiary Address that will receive the tokens once released
     * @param start Unix timestamp at which point vesting starts
     * @param paymentPlan Index of the payment plan in the array paymentPlans
     * @param totalAmount Total amount of tokens to be distributed to beneficiary according to payment plan rules, measured in Wei
     * @param released Amount of tokens already redistributed to beneficiary
     */
    struct Lock {
        address beneficiary;
        uint256 start;
        uint256 paymentPlan;
        uint256 totalAmount;
        uint256 released;
    }
    

    /**
     * @dev array of PaymentPlan structs that holds the created payment plans.
     */
    PaymentPlan[] public paymentPlans;


    /**
     * @dev mapping that stores the Lock struct of each beneficiary address
     */
    mapping(address => Lock) public locks;

    /**
     * @dev ERC20 address of the vesting token.
     */
    IERC20Detailed public immutable token;
    
    /**
     * @dev 100% with two extra digits for precision
     */
    uint256 public constant PERCENT_100 = 100_00; 

    /**
     * @dev keccak256 hash of “VESTING_ADMIN”, representing a role of this same name for access control purposes.
     */
    bytes32 public constant VESTING_ADMIN = keccak256("VESTING_ADMIN");


    /**
     * @notice Emitted when tokens have been released to beneficiary
     * @param amount Released tokens expressed in Wei
     * @param beneficiary Address receiving funds
     */
    event TokensReleased(address beneficiary, uint256 amount);
    
    /**
     * @notice Emitted when tokens have been locked
     * @param amount Locked tokens expressed in Wei
     * @param beneficiary Address tied to locked funds
     * @param paymentPlan Index of the payment plan in the array paymentPlans
     */
    event TokensLocked(address beneficiary, uint256 amount, uint256 paymentPlan);
    
    /**
     * @dev Checks if the payment plan is still valid
     */
    modifier planNotRevoked(uint256 paymentPlan){
        require(paymentPlan <= paymentPlans.length - 1, "TokenVesting: invalid payment plan"); 
        require(!paymentPlans[paymentPlan].revoked, "Payment Plan has Already Revoked");
        _;
    }


    /**
     * @dev sets the vesting token address and the VESTING_ADMIN role
     */
    constructor(IERC20Detailed _token) {
        token = _token;
        _setupRole(VESTING_ADMIN, msg.sender);
    }

    /**
     * @notice Getter of payment plans count
     * @dev Includes also revoked payment plans
     * @return Number of payment plans set by the administrators
     */
    function paymentPlansCount() external view returns (uint256) {
        return paymentPlans.length;
    }

    /**
     * @notice Getter of beneficiary's vesting process status
     * @param beneficiary Target address to lookup
     * @return Beneficiary's lock structure and the corresponding payment plan details
     */
    function detailsOf(address beneficiary) external view returns (Lock memory, PaymentPlan memory) {
        Lock storage _lock = locks[beneficiary];
        PaymentPlan storage plan = paymentPlans[_lock.paymentPlan];
        return (_lock, plan);
    }

    /**
     * @notice Add new payment plan to paymentPlans array.
     * @dev Only for VESTING_ADMIN role
     * @param periodLength length of 1 period expressed in seconds
     * @param periods Total vesting periods
     * @param cliffPeriods Number of initial periods for which no distribution will happen
     */
    function addPaymentPlan(
        uint256 periodLength,
        uint256 periods,
        uint256 cliffPeriods
    ) external onlyRole(VESTING_ADMIN) {
        require(cliffPeriods <= periods, "TokenVesting: invalid cliff periods");
        paymentPlans.push(PaymentPlan(periodLength, periods, periodLength * cliffPeriods, false));
    }

    /**
     * @notice Set up vesting process for a beneficiary
     * @dev Allowance should be set!
     * @param beneficiary Address of the beneficiary to whom vested tokens will be transferred once released
     * @param amount Amount of tokens to lock, expressed in Wei
     * @param start Unix timestamp at which point vesting starts
     * @param paymentPlan Payment plan to apply. Index of the payment plan in the array paymentPlans
     */
    function lock(
        address beneficiary,
        uint256 amount,
        uint256 start,
        uint256 paymentPlan
    ) external planNotRevoked(paymentPlan) {
        require(locks[beneficiary].beneficiary == address(0), "TokenVesting: already locked");
        require(beneficiary != address(0), "TokenVesting: beneficiary is the zero address");
        require(start > block.timestamp, "TokenVesting: final time is before current time");
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "TokenVesting: transfer failed"
        );
        locks[beneficiary].beneficiary = beneficiary;
        locks[beneficiary].start = start;
        locks[beneficiary].paymentPlan = paymentPlan;
        locks[beneficiary].totalAmount = amount;
        emit TokensLocked(beneficiary, amount, paymentPlan);
    }

    /**
     * @notice Getter of funds that can be released for a given user
     * @param beneficiary Address to lookup
     * @return Funds that can be released, expressed in Wei
     */
    function releasableAmount(address beneficiary) external view returns (uint256) {
        return _releasableAmount(locks[beneficiary]);
    }

    /**
     * @notice Function to release funds, if available
     * @param beneficiary Address of the target user
     */
    function release(address beneficiary) external {
        Lock storage _lock = locks[beneficiary];
        uint256 unreleased = _releasableAmount(_lock);
        require(unreleased > 0, "TokenVesting: no tokens available");
        _lock.released = _lock.released + unreleased;
        require(token.transfer(beneficiary, unreleased), "TokenVesting: transfer failed");
        emit TokensReleased(beneficiary, unreleased);
    }

    /**
     * @notice Revokes the given payment plan
     * @dev Only for VESTING_ADMIN role
     * @param paymentPlan Index of the payment plan in the array paymentPlans
    */
    function setRevoked(uint256 paymentPlan, bool revoke) external onlyRole(VESTING_ADMIN) {
        paymentPlans[paymentPlan].revoked = revoke;
    }

    /**
     * @notice Getter of funds that can be released for a given user
     * @param _lock Lock structure tied to the address to lookup
     * @return Funds that can be released, expressed in Wei
     */
    function _releasableAmount(Lock storage _lock) private view returns (uint256) {
        return _vestedAmount(_lock) - _lock.released;
    }

    /**
     * @notice Getter of the vested amount for a given beneficiary user
     * @param _lock Lock structure tied to the address to lookup
     * @return amount of vested tokens according to the lock periods passed.
     */
    function _vestedAmount(Lock storage _lock) private view returns (uint256) {
        PaymentPlan storage paymentPlan = paymentPlans[_lock.paymentPlan];
        if (block.timestamp < _lock.start + paymentPlan.cliff) {
            return 0;
        } else if (
            block.timestamp >= _lock.start + (paymentPlan.periods * paymentPlan.periodLength)
        ) {
            return _lock.totalAmount;
        } else {
            uint256 periodsPassed = (block.timestamp - _lock.start) / paymentPlan.periodLength;
            uint256 unlockedPercents = periodsPassed * (PERCENT_100 / paymentPlan.periods);
            return (_lock.totalAmount * unlockedPercents) / PERCENT_100;
        }
    }
}
