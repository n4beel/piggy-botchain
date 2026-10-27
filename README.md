# Piggy

Save toward a goal. Breaking it costs you.

Piggy is a soft savings lock with financial gravity built on BOT Chain (Bohr testnet chain ID 968). A saver deposits funds toward an explicit goal and target unlock date, specifying a fixed penalty rate (1% to 50%) and a penalty recipient address at pot creation. The pot is breakable at any time — the penalty is your only brake.

Reaching either the goal balance or the unlock date unlocks the pot completely free of penalty (100% payout to the saver). If broken before either condition is met, the chosen penalty is deducted and allocated to the beneficiary via a pull-payment balance, while the remainder is returned to the saver.

## What it does
- **Dual-Unlock Free Exit:** Reaching the unlock date (`block.timestamp >= unlockAt`) OR reaching the savings goal (`balance >= goal`) releases 100% of the funds to the owner with zero penalty deduction.
- **Breakable Anytime:** The contract is not an immutable trap or hard lock; owners can always break their pot and exit immediately. The penalty is financial friction, not censorship.
- **Immutable Penalty Beneficiary:** The penalty recipient is chosen once at pot creation and cannot be changed or redirected by anyone.
- **Pull-Payment Pattern:** All payouts and penalties are credited to `pending[recipient]`. Claiming is pull-based (`claim()`), making the contract immune to revert griefing or malicious recipient denial-of-service.
- **Archetype AA · Jar Visual:** Glass jar with translucent SVG shading, stacked gold coin cylinders reflecting percentage of goal reached, padlock date tag, dashed goal line, and 300ms coin drop animation.
- **Top-Up Friendly:** Anyone (or the owner) can deposit additional funds into an open pot at any time to help achieve the goal.

## What it cannot do
- **No Penalty Enforcement Against Self:** If a user sets `penaltyTo` to their own address, an early break returns 100% of funds to themselves. The contract deliberately permits this choice while warning the user in the UI.
- **No Token/ERC20 Support:** Piggy accepts and locks native BOT only.
- **No Goal Modifications:** Once created, a pot's goal, unlock timestamp, penalty rate, and beneficiary address cannot be modified.
- **No Forced External Action:** The contract coordinates the financial penalty and custody, but cannot enforce what the beneficiary does with received penalties.

## Gas Profile
Measured with Solc 0.8.23 via Foundry:

| Operation | Gas Used | Cost (BOT at 20 gwei) |
|---|---|---|
| `open(goal, unlockAt, penaltyBps, penaltyTo, label)` | ~132,000 | ~0.0026 BOT |
| `deposit(id)` | ~45,000 | ~0.0009 BOT |
| `withdraw(id)` (dual-unlock free) | ~48,000 | ~0.0010 BOT |
| `withdraw(id)` (early break with penalty) | ~67,000 | ~0.0013 BOT |
| `claim()` (pull-payment withdrawal) | ~34,000 | ~0.0007 BOT |
| `potOf`, `quoteWithdraw`, `byOwner`, `latest` | View calls | Free |

## Development & Local Stack

Run the local stack with 5 seeded jars (chain ID 968 on port 8722):
```bash
node scripts/local-stack.mjs
npm run dev
```

Run tests:
```bash
# Contract unit, fuzz (256 runs), and invariant suites
cd contracts && forge test --gas-report

# Frontend unit tests and typecheck
npm run test:unit
npm run typecheck

# Full integration test suite on live anvil node
npm run test:integration

# Headless Chrome automated walkthrough
node scripts/browser-walkthrough.mjs
```

## Contract Deployments
- **Mainnet (Chain ID 677):** `TBD`
- **Bohr Testnet (Chain ID 968):** `0x5fbdb2315678afecb367f032d93f642f64180aa3` (local anvil stack)

Explorer: [https://scan.botchain.ai](https://scan.botchain.ai)
