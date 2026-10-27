// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Piggy
 * @notice A savings pot you can always break — at a price you set in advance.
 * @dev Non-custodial savings pots with user-chosen penalty beneficiaries.
 * Holds funds strictly in escrow until goal is reached, unlock date passes, or pot is broken early.
 */
contract Piggy {
    // --- Constants ---
    uint16 public constant MIN_PENALTY_BPS = 100; // 1.00%
    uint16 public constant MAX_PENALTY_BPS = 5000; // 50.00%
    uint256 public constant MAX_LABEL = 40; // 40 bytes max label
    uint256 public constant MAX_LOCK = 3650 days; // 10 years max lock
    uint256 public constant MAX_PAGE = 50;

    // --- Storage ---
    struct Pot {
        address owner;
        address penaltyTo;
        uint128 goal;
        uint128 balance;
        uint64 unlockAt;
        uint16 penaltyBps;
        bool closed;
        string label;
    }

    struct PotView {
        uint256 id;
        address owner;
        address penaltyTo;
        uint128 goal;
        uint128 balance;
        uint64 unlockAt;
        uint16 penaltyBps;
        bool closed;
        string label;
        bool free;
    }

    mapping(uint256 => Pot) private _pots;
    mapping(address => uint256) public pending;
    mapping(address => uint256[]) private _byOwner;
    uint256 public potCount;

    // Reentrancy state
    uint256 private _status = 1;

    // --- Events ---
    event Opened(
        uint256 indexed id,
        address indexed owner,
        uint128 goal,
        uint64 unlockAt,
        uint16 penaltyBps,
        address indexed penaltyTo,
        string label
    );
    event Deposited(uint256 indexed id, uint256 amount, uint128 balance);
    event Withdrawn(uint256 indexed id, uint256 toOwner, uint256 penalty, bool early);
    event Claimed(address indexed to, uint256 amount);

    // --- Errors ---
    error ZeroGoal();
    error BadUnlock();
    error BadPenalty();
    error BadPenaltyTo();
    error ZeroDeposit();
    error LabelTooLong();
    error NotOwner();
    error ClosedPot();
    error NoSuchPot();
    error NothingToClaim();
    error TransferFailed();
    error ReentrancyGuard();

    modifier nonReentrant() {
        if (_status != 1) revert ReentrancyGuard();
        _status = 2;
        _;
        _status = 1;
    }

    /**
     * @notice Opens a new savings pot with an initial deposit.
     * @param goal The target savings goal in wei
     * @param unlockAt The timestamp after which withdrawal is completely free
     * @param penaltyBps The penalty basis points (100..5000, 1%..50%) if broken early
     * @param penaltyTo The recipient address for the penalty if broken early
     * @param label A short label describing the goal (<= 40 bytes)
     * @return id The identifier of the newly created pot
     */
    function open(
        uint128 goal,
        uint64 unlockAt,
        uint16 penaltyBps,
        address penaltyTo,
        string calldata label
    ) external payable returns (uint256 id) {
        if (goal == 0) revert ZeroGoal();
        // forge-lint: disable-next-line(block-timestamp)
        if (unlockAt <= block.timestamp || unlockAt > block.timestamp + MAX_LOCK) {
            revert BadUnlock();
        }
        if (penaltyBps < MIN_PENALTY_BPS || penaltyBps > MAX_PENALTY_BPS) {
            revert BadPenalty();
        }
        if (
            penaltyTo == address(0) ||
            penaltyTo == msg.sender ||
            penaltyTo == address(this)
        ) {
            revert BadPenaltyTo();
        }
        if (msg.value == 0) revert ZeroDeposit();
        if (bytes(label).length > MAX_LABEL) revert LabelTooLong();

        unchecked {
            id = ++potCount;
        }

        uint128 initialDeposit = uint128(msg.value);
        _pots[id] = Pot({
            owner: msg.sender,
            penaltyTo: penaltyTo,
            goal: goal,
            balance: initialDeposit,
            unlockAt: unlockAt,
            penaltyBps: penaltyBps,
            closed: false,
            label: label
        });

        _byOwner[msg.sender].push(id);

        emit Opened(id, msg.sender, goal, unlockAt, penaltyBps, penaltyTo, label);
        emit Deposited(id, msg.value, initialDeposit);
    }

    /**
     * @notice Top up an open savings pot.
     * @param id The pot identifier
     */
    function deposit(uint256 id) external payable {
        if (id == 0 || id > potCount) revert NoSuchPot();
        Pot storage p = _pots[id];
        if (p.owner != msg.sender) revert NotOwner();
        if (p.closed) revert ClosedPot();
        if (msg.value == 0) revert ZeroDeposit();

        uint128 newBalance = p.balance + uint128(msg.value);
        p.balance = newBalance;

        emit Deposited(id, msg.value, newBalance);
    }

    /**
     * @notice Withdraw funds from an open pot.
     * @dev If unlockAt passed or balance >= goal, no penalty applies.
     * Otherwise, penalty is deducted and allocated to pending[penaltyTo].
     * Payouts are credited via pull-payment in pending balances.
     * @param id The pot identifier
     */
    function withdraw(uint256 id) external {
        if (id == 0 || id > potCount) revert NoSuchPot();
        Pot storage p = _pots[id];
        if (p.owner != msg.sender) revert NotOwner();
        if (p.closed) revert ClosedPot();

        uint128 bal = p.balance;
        // forge-lint: disable-next-line(block-timestamp)
        bool free = block.timestamp >= p.unlockAt || bal >= p.goal;

        p.closed = true;
        p.balance = 0;

        uint256 toOwner;
        uint256 penalty;

        if (free) {
            toOwner = bal;
            penalty = 0;
            pending[msg.sender] += bal;
        } else {
            penalty = (uint256(bal) * uint256(p.penaltyBps)) / 10000;
            toOwner = uint256(bal) - penalty;

            pending[p.penaltyTo] += penalty;
            pending[msg.sender] += toOwner;
        }

        emit Withdrawn(id, toOwner, penalty, !free);
    }

    /**
     * @notice Pull payment of pending balances.
     * @dev Uses checks-effects-interactions and nonReentrant guard.
     */
    function claim() external nonReentrant {
        uint256 amount = pending[msg.sender];
        if (amount == 0) revert NothingToClaim();

        pending[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Claimed(msg.sender, amount);
    }

    // --- Views ---

    /**
     * @notice Returns pot data for a given ID.
     */
    function potOf(uint256 id) external view returns (Pot memory) {
        if (id == 0 || id > potCount) revert NoSuchPot();
        return _pots[id];
    }

    /**
     * @notice Returns all pot IDs created by an address.
     */
    function byOwner(address addr) external view returns (uint256[] memory) {
        return _byOwner[addr];
    }

    /**
     * @notice Quotes the withdrawal distribution if broken right now.
     * @param id The pot identifier
     * @return toOwner The amount the owner receives
     * @return penalty The amount sent to penaltyTo
     * @return free True if no penalty applies (date passed or goal reached)
     */
    function quoteWithdraw(uint256 id)
        external
        view
        returns (
            uint256 toOwner,
            uint256 penalty,
            bool free
        )
    {
        if (id == 0 || id > potCount) revert NoSuchPot();
        Pot storage p = _pots[id];
        uint128 bal = p.balance;
        // forge-lint: disable-next-line(block-timestamp)
        free = block.timestamp >= p.unlockAt || bal >= p.goal;

        if (free) {
            toOwner = bal;
            penalty = 0;
        } else {
            penalty = (uint256(bal) * uint256(p.penaltyBps)) / 10000;
            toOwner = uint256(bal) - penalty;
        }
    }

    /**
     * @notice Returns latest pots in reverse chronological order for gallery view.
     * @param offset Starting offset from newest pot
     * @param count Number of pots to return (max 50)
     */
    function latest(uint256 offset, uint256 count) external view returns (PotView[] memory) {
        if (offset >= potCount) return new PotView[](0);
        if (count > MAX_PAGE) count = MAX_PAGE;

        uint256 available = potCount - offset;
        uint256 n = count < available ? count : available;
        PotView[] memory result = new PotView[](n);

        for (uint256 i = 0; i < n; i++) {
            uint256 id = potCount - offset - i;
            Pot storage p = _pots[id];
            // forge-lint: disable-next-line(block-timestamp)
            bool free = block.timestamp >= p.unlockAt || p.balance >= p.goal;
            result[i] = PotView({
                id: id,
                owner: p.owner,
                penaltyTo: p.penaltyTo,
                goal: p.goal,
                balance: p.balance,
                unlockAt: p.unlockAt,
                penaltyBps: p.penaltyBps,
                closed: p.closed,
                label: p.label,
                free: free
            });
        }

        return result;
    }
}
