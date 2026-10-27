// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import "../src/Piggy.sol";

contract PiggyHandler is Test {
    Piggy public piggy;

    address[] public actors;
    uint256[] public openPotIds;

    uint256 public sumPending;
    uint256 public sumOpenBalances;

    constructor(Piggy _piggy) {
        piggy = _piggy;

        actors.push(address(0x1111));
        actors.push(address(0x2222));
        actors.push(address(0x3333));
        actors.push(address(0x4444));

        for (uint256 i = 0; i < actors.length; i++) {
            vm.deal(actors[i], 1_000_000 ether);
        }
    }

    function openPot(
        uint8 actorIdx,
        uint8 penaltyToIdx,
        uint64 depositAmount,
        uint64 goalMultiple,
        uint16 penaltyBps,
        uint32 lockDuration
    ) external {
        address owner = actors[actorIdx % actors.length];
        address penaltyTo = actors[(penaltyToIdx + 1) % actors.length];
        if (penaltyTo == owner) {
            penaltyTo = actors[(penaltyToIdx + 2) % actors.length];
        }

        uint128 dep = uint128(bound(depositAmount, 1000, 100 ether));
        uint128 goal = dep + uint128(bound(goalMultiple, 1, 100 ether));
        uint16 bps = uint16(bound(penaltyBps, 100, 5000));
        uint64 unlock = uint64(block.timestamp + bound(lockDuration, 60, 365 days));

        vm.prank(owner);
        uint256 id = piggy.open{value: dep}(goal, unlock, bps, penaltyTo, "Invariant Pot");

        openPotIds.push(id);
        sumOpenBalances += dep;
    }

    function depositPot(uint8 potIdx, uint64 amount) external {
        if (openPotIds.length == 0) return;
        uint256 id = openPotIds[potIdx % openPotIds.length];

        Piggy.Pot memory p = piggy.potOf(id);
        if (p.closed) return;

        uint128 dep = uint128(bound(amount, 1000, 50 ether));
        vm.prank(p.owner);
        piggy.deposit{value: dep}(id);

        sumOpenBalances += dep;
    }

    function withdrawPot(uint8 potIdx) external {
        if (openPotIds.length == 0) return;
        uint256 idx = potIdx % openPotIds.length;
        uint256 id = openPotIds[idx];

        Piggy.Pot memory p = piggy.potOf(id);
        if (p.closed) return;

        uint128 bal = p.balance;

        vm.prank(p.owner);
        piggy.withdraw(id);

        sumOpenBalances -= bal;
        sumPending += bal;

        // Swap and remove from openPotIds
        openPotIds[idx] = openPotIds[openPotIds.length - 1];
        openPotIds.pop();
    }

    function claimPending(uint8 actorIdx) external {
        address actor = actors[actorIdx % actors.length];
        uint256 pend = piggy.pending(actor);
        if (pend == 0) return;

        vm.prank(actor);
        piggy.claim();

        sumPending -= pend;
    }

    function warpTime(uint32 secondsWarp) external {
        uint256 secs = bound(secondsWarp, 1, 30 days);
        vm.warp(block.timestamp + secs);
    }
}

contract PiggyInvariantTest is Test {
    Piggy public piggy;
    PiggyHandler public handler;

    function setUp() public {
        piggy = new Piggy();
        handler = new PiggyHandler(piggy);

        targetContract(address(handler));
    }

    function invariant_ConservationOfETH() public view {
        uint256 contractBalance = address(piggy).balance;
        uint256 accountedBalance = handler.sumOpenBalances() + handler.sumPending();
        assertEq(contractBalance, accountedBalance);
    }

    function invariant_ClosedPotsHaveZeroBalance() public view {
        uint256 count = piggy.potCount();
        for (uint256 i = 1; i <= count; i++) {
            Piggy.Pot memory p = piggy.potOf(i);
            if (p.closed) {
                assertEq(p.balance, 0);
            }
        }
    }
}
