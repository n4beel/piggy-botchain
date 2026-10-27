// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import "../src/Piggy.sol";

contract MaliciousClaimer {
    Piggy public piggy;
    uint256 public attacks;
    bool public reentrancyFailed;
    bytes public reentrancyError;

    constructor(Piggy _piggy) {
        piggy = _piggy;
    }

    function attack() external {
        piggy.claim();
    }

    receive() external payable {
        if (attacks == 0) {
            attacks++;
            (bool ok, bytes memory data) = address(piggy).call(abi.encodeWithSelector(Piggy.claim.selector));
            reentrancyFailed = !ok;
            reentrancyError = data;
        }
    }
}

contract PiggyTest is Test {
    Piggy public piggy;

    address public alice = address(0xAA11);
    address public bob = address(0xBB22);
    address public charlie = address(0xCC33);

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

    function setUp() public {
        piggy = new Piggy();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
    }

    // --- Happy Paths ---

    function test_OpenAndDeposit() public {
        uint64 unlock = uint64(block.timestamp + 30 days);
        vm.startPrank(alice);

        vm.expectEmit(true, true, true, true);
        emit Opened(1, alice, 5 ether, unlock, 1000, bob, "Vacation Fund");
        vm.expectEmit(true, false, false, true);
        emit Deposited(1, 1 ether, 1 ether);

        uint256 id = piggy.open{value: 1 ether}(5 ether, unlock, 1000, bob, "Vacation Fund");
        assertEq(id, 1);
        assertEq(piggy.potCount(), 1);

        Piggy.Pot memory p = piggy.potOf(id);
        assertEq(p.owner, alice);
        assertEq(p.penaltyTo, bob);
        assertEq(p.goal, 5 ether);
        assertEq(p.balance, 1 ether);
        assertEq(p.unlockAt, unlock);
        assertEq(p.penaltyBps, 1000);
        assertEq(p.closed, false);
        assertEq(p.label, "Vacation Fund");

        uint256[] memory alicePots = piggy.byOwner(alice);
        assertEq(alicePots.length, 1);
        assertEq(alicePots[0], 1);

        // Deposit top-up
        vm.expectEmit(true, false, false, true);
        emit Deposited(1, 2 ether, 3 ether);
        piggy.deposit{value: 2 ether}(id);

        p = piggy.potOf(id);
        assertEq(p.balance, 3 ether);
        vm.stopPrank();
    }

    function test_WithdrawAfterUnlockNoPenalty() public {
        uint64 unlock = uint64(block.timestamp + 10 days);
        vm.prank(alice);
        uint256 id = piggy.open{value: 2 ether}(10 ether, unlock, 2000, bob, "Unlock Fund");

        // Warp time past unlock date
        vm.warp(block.timestamp + 10 days + 1);

        (uint256 toOwner, uint256 penalty, bool free) = piggy.quoteWithdraw(id);
        assertEq(free, true);
        assertEq(toOwner, 2 ether);
        assertEq(penalty, 0);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(id, 2 ether, 0, false);
        piggy.withdraw(id);

        Piggy.Pot memory p = piggy.potOf(id);
        assertEq(p.closed, true);
        assertEq(p.balance, 0);

        assertEq(piggy.pending(alice), 2 ether);
        assertEq(piggy.pending(bob), 0);

        // Claim
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        piggy.claim();
        assertEq(alice.balance, balBefore + 2 ether);
        assertEq(piggy.pending(alice), 0);
    }

    function test_WithdrawAtGoalNoPenaltyBeforeUnlock() public {
        uint64 unlock = uint64(block.timestamp + 100 days);
        vm.startPrank(alice);
        uint256 id = piggy.open{value: 2 ether}(5 ether, unlock, 2500, bob, "Goal Fund");

        // Deposit enough to reach goal before unlock date
        piggy.deposit{value: 3 ether}(id);

        (uint256 toOwner, uint256 penalty, bool free) = piggy.quoteWithdraw(id);
        assertEq(free, true);
        assertEq(toOwner, 5 ether);
        assertEq(penalty, 0);

        piggy.withdraw(id);
        vm.stopPrank();

        assertEq(piggy.pending(alice), 5 ether);
        assertEq(piggy.pending(bob), 0);
    }

    function test_EarlyWithdrawPaysPenaltyToChosenAddress() public {
        uint64 unlock = uint64(block.timestamp + 50 days);
        vm.prank(alice);
        uint256 id = piggy.open{value: 10 ether}(20 ether, unlock, 1500, bob, "Early Break Fund"); // 15%

        (uint256 toOwner, uint256 penalty, bool free) = piggy.quoteWithdraw(id);
        assertEq(free, false);
        assertEq(penalty, 1.5 ether); // 15% of 10 ether
        assertEq(toOwner, 8.5 ether);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(id, 8.5 ether, 1.5 ether, true);
        piggy.withdraw(id);

        assertEq(piggy.pending(alice), 8.5 ether);
        assertEq(piggy.pending(bob), 1.5 ether);

        // Bob claims penalty
        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        vm.expectEmit(true, false, false, true);
        emit Claimed(bob, 1.5 ether);
        piggy.claim();
        assertEq(bob.balance, bobBefore + 1.5 ether);
    }

    function test_PenaltyMathRounding() public {
        // Test 1 wei with 10% penalty
        uint64 unlock = uint64(block.timestamp + 1 days);
        vm.prank(alice);
        uint256 id1 = piggy.open{value: 1}(10 ether, unlock, 1000, bob, "1 wei");
        (uint256 toOwner1, uint256 penalty1, ) = piggy.quoteWithdraw(id1);
        // 1 * 1000 / 10000 = 0
        assertEq(penalty1, 0);
        assertEq(toOwner1, 1);

        // Test odd amount: 999 wei with 15% penalty (1500 bps)
        vm.prank(alice);
        uint256 id2 = piggy.open{value: 999}(10 ether, unlock, 1500, bob, "odd wei");
        (uint256 toOwner2, uint256 penalty2, ) = piggy.quoteWithdraw(id2);
        // 999 * 1500 / 10000 = 1498500 / 10000 = 149
        assertEq(penalty2, 149);
        assertEq(toOwner2, 999 - 149);
        assertEq(toOwner2 + penalty2, 999);
    }

    function test_QuoteMatchesWithdraw() public {
        uint64 unlock = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 id = piggy.open{value: 7.77 ether}(15 ether, unlock, 1234, bob, "Quote Match");

        (uint256 quoteOwner, uint256 quotePenalty, bool quoteFree) = piggy.quoteWithdraw(id);

        vm.prank(alice);
        piggy.withdraw(id);

        assertEq(piggy.pending(alice), quoteOwner);
        assertEq(piggy.pending(bob), quotePenalty);
        assertEq(quoteFree, false);
    }

    function test_ClosedPotRejects() public {
        uint64 unlock = uint64(block.timestamp + 1 days);
        vm.startPrank(alice);
        uint256 id = piggy.open{value: 1 ether}(5 ether, unlock, 1000, bob, "Close Test");
        piggy.withdraw(id);

        vm.expectRevert(Piggy.ClosedPot.selector);
        piggy.deposit{value: 1 ether}(id);

        vm.expectRevert(Piggy.ClosedPot.selector);
        piggy.withdraw(id);
        vm.stopPrank();
    }

    function test_NotOwnerCannotDepositOrWithdraw() public {
        uint64 unlock = uint64(block.timestamp + 10 days);
        vm.prank(alice);
        uint256 id = piggy.open{value: 1 ether}(5 ether, unlock, 1000, bob, "Auth Test");

        vm.startPrank(charlie);
        vm.expectRevert(Piggy.NotOwner.selector);
        piggy.deposit{value: 1 ether}(id);

        vm.expectRevert(Piggy.NotOwner.selector);
        piggy.withdraw(id);
        vm.stopPrank();
    }

    function test_BadParamsRevert() public {
        uint64 unlock = uint64(block.timestamp + 10 days);

        // ZeroGoal
        vm.expectRevert(Piggy.ZeroGoal.selector);
        piggy.open{value: 1 ether}(0, unlock, 1000, bob, "ZeroGoal");

        // BadUnlock (in the past or now)
        vm.expectRevert(Piggy.BadUnlock.selector);
        piggy.open{value: 1 ether}(5 ether, uint64(block.timestamp), 1000, bob, "Past");

        // BadUnlock (> 3650 days)
        vm.expectRevert(Piggy.BadUnlock.selector);
        piggy.open{value: 1 ether}(5 ether, uint64(block.timestamp + 3650 days + 1), 1000, bob, "TooFar");

        // BadPenalty (< 100 or > 5000)
        vm.expectRevert(Piggy.BadPenalty.selector);
        piggy.open{value: 1 ether}(5 ether, unlock, 99, bob, "TooLow");

        vm.expectRevert(Piggy.BadPenalty.selector);
        piggy.open{value: 1 ether}(5 ether, unlock, 5001, bob, "TooHigh");

        // BadPenaltyTo
        vm.expectRevert(Piggy.BadPenaltyTo.selector);
        piggy.open{value: 1 ether}(5 ether, unlock, 1000, address(0), "ZeroAddress");

        vm.expectRevert(Piggy.BadPenaltyTo.selector);
        piggy.open{value: 1 ether}(5 ether, unlock, 1000, address(this), "ThisContract");

        vm.prank(alice);
        vm.expectRevert(Piggy.BadPenaltyTo.selector);
        piggy.open{value: 1 ether}(5 ether, unlock, 1000, alice, "SelfPenalty");

        // ZeroDeposit
        vm.expectRevert(Piggy.ZeroDeposit.selector);
        piggy.open{value: 0}(5 ether, unlock, 1000, bob, "ZeroVal");

        // LabelTooLong (> 40 bytes)
        string memory longLabel = "12345678901234567890123456789012345678901"; // 41 bytes
        vm.expectRevert(Piggy.LabelTooLong.selector);
        piggy.open{value: 1 ether}(5 ether, unlock, 1000, bob, longLabel);

        // NoSuchPot
        vm.expectRevert(Piggy.NoSuchPot.selector);
        piggy.deposit{value: 1 ether}(999);

        vm.expectRevert(Piggy.NoSuchPot.selector);
        piggy.withdraw(999);

        vm.expectRevert(Piggy.NoSuchPot.selector);
        piggy.potOf(0);

        vm.expectRevert(Piggy.NoSuchPot.selector);
        piggy.quoteWithdraw(999);

        // NothingToClaim
        vm.expectRevert(Piggy.NothingToClaim.selector);
        piggy.claim();
    }

    function test_BoundaryDurationsAndPenaltiesSucceed() public {
        // Exact min penalty (100 bps)
        uint64 unlockMin = uint64(block.timestamp + 1);
        vm.prank(alice);
        uint256 id1 = piggy.open{value: 1 ether}(1 ether, unlockMin, 100, bob, "Min");
        assertEq(piggy.potOf(id1).penaltyBps, 100);

        // Exact max penalty (5000 bps) and max lock (3650 days) and max label (40 bytes)
        uint64 unlockMax = uint64(block.timestamp + 3650 days);
        string memory maxLabel = "1234567890123456789012345678901234567890"; // 40 bytes
        vm.prank(alice);
        uint256 id2 = piggy.open{value: 1 ether}(1 ether, unlockMax, 5000, bob, maxLabel);
        assertEq(piggy.potOf(id2).penaltyBps, 5000);
        assertEq(piggy.potOf(id2).label, maxLabel);
    }

    function test_ReentrantClaimBlocked() public {
        MaliciousClaimer attacker = new MaliciousClaimer(piggy);
        vm.deal(address(attacker), 10 ether);

        // Create pot with attacker as penalty recipient
        uint64 unlock = uint64(block.timestamp + 10 days);
        vm.prank(alice);
        uint256 id = piggy.open{value: 5 ether}(10 ether, unlock, 2000, address(attacker), "Attack");

        // Alice breaks early -> 1 ether penalty allocated to attacker
        vm.prank(alice);
        piggy.withdraw(id);
        assertEq(piggy.pending(address(attacker)), 1 ether);

        // Attacker attempts reentrancy via claim
        attacker.attack();
        assertTrue(attacker.reentrancyFailed());
        assertEq(bytes4(attacker.reentrancyError()), Piggy.ReentrancyGuard.selector);
        assertEq(address(attacker).balance, 11 ether);
        assertEq(piggy.pending(address(attacker)), 0);
    }

    function test_LatestPagination() public {
        // Open 3 pots
        uint64 unlock = uint64(block.timestamp + 5 days);
        vm.prank(alice);
        piggy.open{value: 1 ether}(5 ether, unlock, 1000, bob, "Pot 1");
        vm.prank(alice);
        piggy.open{value: 2 ether}(5 ether, unlock, 1000, bob, "Pot 2");
        vm.prank(alice);
        piggy.open{value: 3 ether}(5 ether, unlock, 1000, bob, "Pot 3");

        Piggy.PotView[] memory views = piggy.latest(0, 2);
        assertEq(views.length, 2);
        assertEq(views[0].id, 3);
        assertEq(views[1].id, 2);

        Piggy.PotView[] memory views2 = piggy.latest(2, 2);
        assertEq(views2.length, 1);
        assertEq(views2[0].id, 1);

        Piggy.PotView[] memory emptyViews = piggy.latest(3, 2);
        assertEq(emptyViews.length, 0);
    }

    function test_ExactBoundaryUnlockAndGoalFree() public {
        uint64 unlock = uint64(block.timestamp + 5 days);
        vm.prank(alice);
        uint256 id1 = piggy.open{value: 2 ether}(5 ether, unlock, 1000, bob, "Boundary Unlock");

        // Warp exactly to unlockAt (balance is 2 ether, below 5 ether goal)
        vm.warp(unlock);

        // quoteWithdraw must return free = true, penalty = 0
        (uint256 toOwner, uint256 penalty, bool free) = piggy.quoteWithdraw(id1);
        assertTrue(free);
        assertEq(penalty, 0);
        assertEq(toOwner, 2 ether);

        // latest must show free = true
        Piggy.PotView[] memory views = piggy.latest(0, 1);
        assertEq(views.length, 1);
        assertTrue(views[0].free);

        // withdraw must be non-early
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(id1, 2 ether, 0, false);
        piggy.withdraw(id1);

        // Test exact goal boundary before unlock date
        uint64 futureUnlock = uint64(block.timestamp + 10 days);
        vm.prank(alice);
        uint256 id2 = piggy.open{value: 5 ether}(5 ether, futureUnlock, 1000, bob, "Exact Goal");

        // balance is exactly goal (5 ether == 5 ether) while timestamp is still before futureUnlock
        views = piggy.latest(0, 1);
        assertEq(views.length, 1);
        assertEq(views[0].id, id2);
        assertTrue(views[0].free);

        (toOwner, penalty, free) = piggy.quoteWithdraw(id2);
        assertTrue(free);
        assertEq(penalty, 0);
        assertEq(toOwner, 5 ether);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(id2, 5 ether, 0, false);
        piggy.withdraw(id2);
    }

    // --- Fuzz Tests (>= 256 runs) ---

    function testFuzz_Conservation(uint64 deposit1, uint64 deposit2, uint16 penaltyBps) public {
        vm.assume(deposit1 >= 1000);
        vm.assume(deposit2 >= 1000);
        vm.assume(penaltyBps >= 100 && penaltyBps <= 5000);

        uint64 unlock = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 id = piggy.open{value: deposit1}(uint128(deposit1) * 3, unlock, penaltyBps, bob, "Fuzz");

        vm.prank(alice);
        piggy.deposit{value: deposit2}(id);

        uint128 totalBal = uint128(deposit1) + uint128(deposit2);
        assertEq(piggy.potOf(id).balance, totalBal);

        // Early break
        vm.prank(alice);
        piggy.withdraw(id);

        uint256 ownerPending = piggy.pending(alice);
        uint256 bobPending = piggy.pending(bob);

        // Conservation: owner + penalty == total deposit
        assertEq(ownerPending + bobPending, totalBal);
    }

    function testFuzz_PenaltyNeverExceedsBalance(uint64 bal, uint16 penaltyBps) public {
        vm.assume(bal > 0);
        vm.assume(penaltyBps >= 100 && penaltyBps <= 5000);

        uint64 unlock = uint64(block.timestamp + 10 days);
        vm.prank(alice);
        uint256 id = piggy.open{value: bal}(uint128(bal) * 2, unlock, penaltyBps, bob, "Fuzz Penalty");

        (uint256 toOwner, uint256 penalty, ) = piggy.quoteWithdraw(id);

        assertLe(penalty, bal);
        assertEq(toOwner + penalty, bal);
    }
}
