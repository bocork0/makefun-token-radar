# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bocork0/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bocork0/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar for the token launches that have not happened yet. It reads a sealed snapshot of every protocol DefiLlama tracks, finds the ones that record no token and are not a wrapped, staked or bridged product of one that trades, ranks them by what their launch would be worth, and hands the reader a dashboard: the board, a detail view for every protocol, and the steps to farm it.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

`main.ts` (Node 22, standard library only) writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Open `out/dashboard/index.html` in a browser — the page makes no network requests; all data comes from `data.js` beside it.

## The value model

No protocol name is ever special-cased. One formula scores every row, from the snapshot's own figures:

```
implied = TVL × peerMultiple(category)
        × (1 + clamp(change_7d, −50%, +150%) × 0.35)
        × (0.75 + 0.25 × min(ageDays, 1095) / 1095)
        × (1 + 0.02 × min(chains − 1, 5))
```

* **Peer multiple.** For each category, the median market-cap / TVL ratio of the protocols in that category whose token already trades, shrunk toward the snapshot-wide median (weight 6) so a category with one or two live peers cannot set the multiple on its own, then clamped to 0.05–1.00. A category with no live peers uses the snapshot-wide median (0.205 in this snapshot).
* **Growth.** The protocol's own 7-day TVL change, clamped and weighted 0.35.
* **Maturity.** 0.75 when just listed, rising to 1.00 after three years tracked; 365 days assumed when no listing date is reported.
* **Breadth.** 2% per extra chain, up to five.

The dashboard's detail view shows every row's four factors and re-derives its implied value from them, so any number on the board can be checked against the snapshot.

## What counts as pre-token

A protocol is rankable when it records no token (no market cap, no CoinGecko id, no symbol) **and** passes the watchlist's exclusion rule as far as the snapshot's fields can state it: its category is not Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX; its name carries no whole word `wrapped`, `staked` or `staking`, does not begin with an exchange's name, and does not end in a version marker. DefiLlama's parent-protocol record is not one of the snapshot's fields, so a row the house watchlist leaves out is still ranked — the dashboard flags it **Early find** and says to verify it before farming.

This snapshot's board holds **198 rows**: all 40 watchlist protocols plus 158 early finds below and beyond the $50M floor. The live-token protocols are kept apart in their own view, shown with the market's own values — they are the peer group the multiples come from, never ranked rows.

## Farm plans

Every row carries six steps, each with a cost and a time, derived from the protocol's own record (category, chains, TVL, age): a fresh-wallet setup, a category-specific main action (supply, LP, vault deposit, stake, hedge, mint…), a weekly qualifying action, a hold period (45–90 days by age), a safe-claim check on the protocol's own page, and a farm log. Capital is $50–$500 by TVL.

## What the radar does not do

It does not predict whether or when a token is issued. "Records no token" is not proof a protocol has none — a token may exist that DefiLlama's record does not carry. An implied value is this entry's own claim about what a launch would be worth *if* the protocol's record stayed as it is.

## Layout

* `main.ts` — the program: snapshot parsing, the peer-multiple model, farm plans, the board, and the output writer.
* `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
* `vendor/makefun-board.ts` — make.fun's dossier library, copied unchanged from the competition kit.
* `screenshots/` — the board, a detail view and a filtered view, rendered from the dashboard's own code.
* `board.json`, `dossier.json` — outputs of a local run of `main.ts`.

## License

MIT — see `LICENSE`.

---

Entered on [make.fun](https://make.fun/?ref=7wt04jdt&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
