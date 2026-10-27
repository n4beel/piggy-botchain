# Piggy Contract Design Decisions

## 1. Soft Lock Philosophy
- **Mechanism**: The user can break their savings pot at any moment via `withdraw(id)`.
- **Incentive**: A pre-committed penalty percentage (1%–50%) goes to a designated third-party beneficiary (`penaltyTo`) if broken before unlock.
- **Rationale**:
  - Hard locks (like Ironbox) can be catastrophic if emergencies occur.
  - Soft locks provide a psychological and economic brake against impulsive spending without trapping funds irreversibly.

## 2. Penalty Beneficiary Rules
- **Rule**: `penaltyTo != address(0)`, `penaltyTo != msg.sender`, and `penaltyTo != address(this)`.
- **Fixed at Inception**: The beneficiary is chosen when opening the pot and cannot be altered.
- **Game Theory**:
  - If a user could set `penaltyTo` to themselves, the penalty would be zero in practice.
  - If a user could set `penaltyTo` to the contract, funds would be permanently stuck.
  - Directing penalties to an accountability partner, charity, or friend gives the commitment device social and financial gravity.

## 3. Dual-Unlock Condition (Free Withdrawal)
- **Rule**: Withdrawal is completely free (0% penalty, 100% payout to owner) if:
  `block.timestamp >= unlockAt` OR `balance >= goal`.
- **Rationale**:
  - Achieving the savings goal early should be rewarded, not penalized.
  - Waiting until the agreed time target has elapsed satisfies the original commitment.

## 4. Pull-Payment Pattern & Reentrancy Safety
- **Mechanism**:
  - `withdraw(id)` updates balances and credits `pending[owner]` and `pending[penaltyTo]`.
  - Beneficiaries and owners pull their funds by calling `claim()`.
  - `claim()` uses zero-before-call state update and is protected by `nonReentrant`.
- **Rationale**:
  - Pushing funds directly during `withdraw(id)` could allow a malicious `penaltyTo` (or owner) contract to revert and DOS the withdrawal.
  - Pull-payments isolate failures and protect participants against gas griefing or revert attacks.

## 5. Bounded Storage & Pagination
- **Pagination**: `latest(offset, count)` bounds returned results to `MAX_PAGE = 50`.
- **Constant Gas**: Deposit, withdraw, and claim execute in constant $O(1)$ gas.

## 6. Formal Invariants
- **Conservation of ETH**: Contract balance strictly equals the sum of all active open pot balances plus all pending pull-payment claims.
- **Closed Pots Zero Balance**: Closed pots always have a balance of exactly 0 and can never be deposited into or withdrawn from again.
- **Solvency**: Contract never reverts due to insufficient balance during valid claims.

## 7. Mutation Testing Results
- Sample size: 25 mutants tested across state transitions, boundary operators, penalty calculation, access controls, and reentrancy modifier.
- Results: 25 of 25 killed (100% mutation kill rate).
- Key verification: Boundary condition equality (`block.timestamp == unlockAt` and `balance == goal`) tested and proven sound.

