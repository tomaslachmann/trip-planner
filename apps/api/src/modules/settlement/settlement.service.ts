import { prisma } from '../../db/prisma.js';
import { createSpdPaymentPayload } from '../payment/spd.js';

export type SettlementTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  qrPayload?: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function calculateTripSettlements(tripId: string): Promise<SettlementTransfer[]> {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      expenses: { include: { splits: true } },
      members: { include: { user: { include: { accounts: true } } } },
    },
  });

  const balances = new Map<string, number>();
  for (const member of trip.members) balances.set(member.userId, 0);

  for (const expense of trip.expenses) {
    balances.set(expense.paidById, roundMoney((balances.get(expense.paidById) ?? 0) + Number(expense.amount)));
    for (const split of expense.splits) {
      balances.set(split.userId, roundMoney((balances.get(split.userId) ?? 0) - Number(split.amount)));
    }
  }

  const debtors = [...balances.entries()].filter(([, value]) => value < 0).map(([userId, value]) => ({ userId, amount: roundMoney(-value) }));
  const creditors = [...balances.entries()].filter(([, value]) => value > 0).map(([userId, value]) => ({ userId, amount: roundMoney(value) }));
  const transfers: SettlementTransfer[] = [];

  for (const debtor of debtors) {
    while (debtor.amount > 0 && creditors.length > 0) {
      const creditor = creditors[0];
      const amount = roundMoney(Math.min(debtor.amount, creditor.amount));
      const creditorMember = trip.members.find((member) => member.userId === creditor.userId);
      const account = creditorMember?.user.accounts[0];
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount,
        currency: trip.currency,
        qrPayload: account?.iban ? createSpdPaymentPayload({ iban: account.iban, amount, currency: trip.currency, message: `Trip ${trip.name}`, recipientName: account.recipientName ?? undefined }) : undefined,
      });
      debtor.amount = roundMoney(debtor.amount - amount);
      creditor.amount = roundMoney(creditor.amount - amount);
      if (creditor.amount <= 0) creditors.shift();
    }
  }

  return transfers;
}
