import { parseAnyLedgerFormat } from "../core/ledger-parser.js";

export type LedgerEntry = {
  date: string;
  description: string;
  amount: number;
  account: string;
};

export function getLedgerSnapshot(ledgerPath: string): LedgerEntry[] {
  return parseAnyLedgerFormat(ledgerPath);
}
