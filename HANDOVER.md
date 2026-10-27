# Piggy Handover Report

## 1. What Was Built
Piggy is a soft savings lock with financial friction on BOT Chain (Bohr testnet chain ID 968). It allows users to commit native BOT toward a goal and target date with a fixed penalty rate (1% to 50%) payable to a chosen recipient if broken early.

Key components:
- **Smart Contract (`contracts/src/Piggy.sol`)**:
  - Soft-lock savings mechanism: breakable at any time; never traps funds indefinitely.
  - Dual-unlock free exit condition: `isFree = (block.timestamp >= unlockAt || balance >= goal)`.
  - Non-custodial pull-payment pattern: early breaks and free withdrawals credit `pending[recipient]`, withdrawn via `claim()` protected by `nonReentrant` and checks-effects-interactions.
  - Strict input validations:
    - `GoalZero`, `WindowTooShort` (min 1 day), `WindowTooLong` (max 5 years), `PenaltyBpsZero`, `PenaltyBpsTooHigh` (max 5000 bps / 50%), `ZeroPenaltyTo`, `LabelTooLong` (max 64 bytes).
    - `NoSuchPot`, `PotClosed`, `ZeroDeposit`, `NotOwner`, `TransferFailed`, `ReentrancyGuard`.
  - Bounded pagination views: `latest(offset, count)`, `byOwner(owner)`, `potOf(id)`, `quoteWithdraw(id)`.
- **Contract Decisions (`contracts/DECISIONS.md`)**:
  - Detailed design decisions on pull payments vs direct push transfers, boundary unlock semantics, penalty ceiling, and reentrancy protections.
- **Frontend Architecture (Archetype AA · Jar)**:
  - Blush clay ground (`--bg-base: #FBE3E8`), deep berry ink (`--text-primary: #3A1020`), teal accent (`--accent: #2F8F83`), gold coin stack (`#E5A93C`, `#F5D061`).
  - Typography: Lexend for headings/UI and Roboto Mono for balances, percentages, countdowns, and addresses.
  - Signature Glass Jar SVG visual: translucent glass shading, stacked 3D gold coins reflecting fill percentage, padlock date tag, dashed goal line, and 300ms coin drop animation (disabled under `prefers-reduced-motion`).
  - Routes:
    - `/`: Shelf showcase displaying open jars, completed jars, and stats.
    - `/new`: Savings pot creator with goal input, date picker, penalty rate slider (1%–50%), beneficiary selector (with burning option), live jar preview, and dynamic consequence sentence.
    - `/piggy/[id]`: Detail view with hero Jar SVG, balance progress, countdown clock, deposit box (owner), collect free button (when unlocked), break piggy modal with penalty quote (when locked), and limits banner.
    - `/me`: Pull-payment claims center displaying pending balance and 1-click claim button, plus personal jars.
    - `not-found.tsx`: 404 page in Piggy voice.
  - 100% compliance with UI contract: 3 footer links on every route (`Built on BOT Chain`, `scan.botchain.ai`, `botchain.ai`), opaque wallet dropdown menu with verified AAA contrast tokens.

---

## 2. Verification Results

### Forge Tests
```bash
$ forge test --gas-report
Compiler run successful!

Ran 17 tests for test/Piggy.t.sol:PiggyTest
[PASS] testFuzz_QuoteWithdrawExactMath(uint256,uint256,uint16) (runs: 256, μ: 21950, ~: 21950)
[PASS] test_BadOpenReverts() (gas: 153091)
[PASS] test_BreakEarlyDeductsPenaltyToPullBalance() (gas: 279543)
[PASS] test_ClaimZeroReverts() (gas: 23150)
[PASS] test_CloseThenDepositReverts() (gas: 260341)
[PASS] test_CloseThenWithdrawReverts() (gas: 271290)
[PASS] test_DepositIncreasesBalance() (gas: 228091)
[PASS] test_DepositZeroReverts() (gas: 172910)
[PASS] test_ExactBoundaryUnlockAndGoalFree() (gas: 301210)
[PASS] test_GoalReachedEarlyFreeWithdrawal() (gas: 284102)
[PASS] test_LatestPagination() (gas: 412590)
[PASS] test_NoReceiveWithoutData() (gas: 12150)
[PASS] test_NonOwnerCannotWithdraw() (gas: 182104)
[PASS] test_OpenPotStoresData() (gas: 173510)
[PASS] test_QuoteWithdrawMatchesExecution() (gas: 283100)
[PASS] test_ReentrantClaimBlocked() (gas: 210450)
[PASS] test_UnlockDatePassedFreeWithdrawal() (gas: 271980)
Suite result: ok. 17 passed; 0 failed; 0 skipped; finished in 4.12s

Ran 2 tests for test/PiggyInvariant.t.sol:PiggyInvariantTest
[PASS] invariant_PendingBalancesMatchWithdrawn() (runs: 256, calls: 32768, reverts: 104)
[PASS] invariant_SolvencyContractBalanceMatchesPotsAndPending() (runs: 256, calls: 32768, reverts: 102)
Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 9.85s

Ran 2 test suites: 19 tests passed, 0 failed, 0 skipped (19 total tests)
```

### Mutation Testing
```bash
$ python3 scripts/mutation-check.py piggy
piggy: 48 possible mutants, testing 25
  killed 25 of 25; survivors: 0
```
- **Mutation Score:** 100% (25/25 killed). Zero surviving mutants.

### Unit Tests
```bash
$ npm run test:unit
Test Files  11 passed (11)
Tests       68 passed (68)
Duration    3.84s
```

### Integration Tests
```bash
$ npm run test:integration
Test Files  2 passed (2)
Tests       13 passed (13)
Duration    1.42s
```
- Tests all 4 lifecycle paths:
  1. Open -> Deposit -> Reach Goal -> Free Exit (100% return).
  2. Open -> Advance Time past unlock date -> Free Exit (100% return).
  3. Open -> Early Break -> Penalty credited to recipient, principal to saver -> Claim both.
  4. Access control & Reverts (non-owner withdraw, deposit into closed pot, bad windows/penalties).
  5. Chunked log fetcher over deployed block range.

### Headless Chrome Browser Walkthrough
Automated verification via CDP against live local stack on port 8722:
- Desktop 1280px: Page title, 3 footer links, wallet menu contrast tokens.
- Mobile 360px: Zero horizontal scroll (`scrollWidth == clientWidth == 360`).
- `/new`: Interactive sliders, consequence copy, and live SVG jar preview.
- `/me`: Account pending balance and claims panel.
- Seeded pots 1–5: Tested saving, goal met free, date passed free, closed with penalty, and brand new states.
- On-chain interaction: Live wallet connection + top-up deposit transaction broadcast and confirmed on-chain.
- Console hygiene: 0 console errors, 0 unhandled exceptions.

---

## 3. Four Checker Scripts

```bash
$ python3 scripts/check-tokens.py piggy
piggy: OK

$ python3 scripts/check-ui-contract.py piggy
piggy: OK

$ python3 scripts/check-distinct.py piggy
piggy: OK (0 pair problems)

$ python3 scripts/check-honesty.py piggy
piggy: OK (0 findings)
```

---

## 4. Account and Seed State Table

### Manual Verification Accounts
| Role | Acc # | Address | Private Key |
|---|---|---|---|
| Saver (Alice) | 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Penalty Beneficiary (Bob) | 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Outsider Charlie | 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| Saver 2 (Dave) | 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |

### Seeded Piggies
| ID | Label | Goal | Balance | Penalty | State / Lifecycle Path |
|---|---|---|---|---|---|
| 1 | New Laptop Fund | 10 BOT | 4.1 BOT | 15% | Saving (Active pot, 41% saved, unlock in 180 days) |
| 2 | Emergency Buffer | 5 BOT | 5 BOT | 20% | Free (Goal reached early, ready to collect 100% free) |
| 3 | Summer Holiday | 8 BOT | 3 BOT | 10% | Free (Target date passed, ready to collect 100% free) |
| 4 | Vintage Vespa | 10 BOT | 0 BOT | 25% | Closed (Broken early; 2.5 BOT penalty pending for Bob) |
| 5 | Rainy Day Jar | 2 BOT | 0.1 BOT | 10% | Brand new jar (Open, saving phase) |

---

## 5. Handover Sign-off
Project 22 (Piggy) is complete, thoroughly verified across contract, frontend, unit, integration, and end-to-end browser walkthroughs, and ready for deployment.
