export type SpdPaymentInput = {
  iban: string;
  amount: number;
  currency?: string;
  message?: string;
  recipientName?: string;
};

function sanitize(value: string): string {
  return value.replace(/[\*]/g, ' ').trim();
}

export function createSpdPaymentPayload(input: SpdPaymentInput): string {
  const parts = [
    'SPD',
    '1.0',
    `ACC:${sanitize(input.iban)}`,
    `AM:${input.amount.toFixed(2)}`,
    `CC:${sanitize(input.currency ?? 'CZK')}`,
  ];

  if (input.message) parts.push(`MSG:${sanitize(input.message)}`);
  if (input.recipientName) parts.push(`RN:${sanitize(input.recipientName)}`);

  return parts.join('*');
}
