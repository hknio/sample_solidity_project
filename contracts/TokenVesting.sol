pragma solidity 0.8.11;

import "./interfaces/IERC20Detailed.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 */
contract TokenVesting is Ownable {
    event TokensReleased(address beneficiary, uint256 amount);
    event TokensLocked(address beneficiary, uint256 amount, uint256 paymentPlan);

    struct PaymentPlan {
        uint256 periodLength;
        uint256 periods;
        uint256 cliff;
    }

    struct Lock {
        address beneficiary;
        uint256 start;
        uint256 paymentPlan;
        uint256 totalAmount;
        uint256 released;
    }

    uint256 public constant PERCENT_100 = 100_00; // 100% with extra denominator

    PaymentPlan[] public paymentPlans;

    IERC20Detailed immutable token;

    mapping(address => Lock) public locks;

    constructor(IERC20Detailed _token) {
        token = _token;
    }

    function paymentPlansCount() external view returns (uint256) {
        return paymentPlans.length;
    }

    function detailsOf(address beneficiary) external view returns (Lock memory, PaymentPlan memory) {
        Lock storage lock = locks[beneficiary];
        PaymentPlan storage plan = paymentPlans[lock.paymentPlan];
        return(lock, plan);
    }

    /**
     * @dev Add new payment plan.
     * @param periodLength length of 1 period.
     * @param periods total vesting periods.
     * @param cliffPeriods number periods that will be scipped.
     */
    function addPaymentPlan(
        uint256 periodLength,
        uint256 periods,
        uint256 cliffPeriods
    ) public onlyOwner {
        require(cliffPeriods <= periods, "TokenVesting: invalid cliff periods");
        paymentPlans.push(PaymentPlan(periodLength, periods, periodLength * cliffPeriods));
    }

    /**
     * @dev lock tokens. Allowance should be set!!!
     * @param beneficiary address of the beneficiary to whom vested tokens are transferred
     * @param amount amount of tokens to lock
     * @param start the time (as Unix time) at which point vesting starts
     * @param paymentPlan payment plan to apply
     */
    function lock(
        address beneficiary,
        uint256 amount,
        uint256 start,
        uint256 paymentPlan
    ) public {
        require(locks[beneficiary].beneficiary == address(0), "TokenVesting: already locked");
        require(beneficiary != address(0), "TokenVesting: beneficiary is the zero address");
        require(start > block.timestamp, "TokenVesting: final time is before current time");
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "TokenVesting: transfer failed"
        );
        require(paymentPlan <= paymentPlans.length - 1, "TokenVesting: invalid payment plan");
        locks[beneficiary].beneficiary = beneficiary;
        locks[beneficiary].start = start;
        locks[beneficiary].paymentPlan = paymentPlan;
        locks[beneficiary].totalAmount = amount;
        emit TokensLocked(beneficiary, amount, paymentPlan);
    }

    function releasableAmount(address beneficiary) external view returns (uint256) {
        return _releasableAmount(locks[beneficiary]);
    }

    function release(address beneficiary) public {
        Lock storage lock = locks[beneficiary];
        uint256 unreleased = _releasableAmount(lock);
        require(unreleased > 0, "TokenVesting: no tokens available");
        lock.released = lock.released + unreleased;
        require(token.transfer(beneficiary, unreleased));
        emit TokensReleased(beneficiary, unreleased);
    }

    function _releasableAmount(Lock storage lock) private view returns (uint256) {
        return _vestedAmount(lock) - lock.released;
    }

    function _vestedAmount(Lock storage lock) private view returns (uint256) {
        PaymentPlan storage paymentPlan = paymentPlans[lock.paymentPlan];
        if (block.timestamp < lock.start + paymentPlan.cliff) {
            return 0;
        } else if (
            block.timestamp >= lock.start + (paymentPlan.periods * paymentPlan.periodLength)
        ) {
            return lock.totalAmount;
        } else {
            uint256 periodsPassed = (block.timestamp - lock.start) / paymentPlan.periodLength;
            uint256 unlockedPercents = periodsPassed * (PERCENT_100 / paymentPlan.periods);
            return (lock.totalAmount * unlockedPercents) / PERCENT_100;
        }
    }
}
