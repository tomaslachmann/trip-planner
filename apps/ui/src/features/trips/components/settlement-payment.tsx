'use client';

import { AlertTriangle, ArrowRight, Check, Copy, Download, ExternalLink, QrCode, Receipt, ShieldCheck, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Avatar } from './avatar';
import type { Expense, Settlement, TripMember } from '../types';

function memberName(members: TripMember[], userId: string) {
  return members.find((member) => member.userId === userId)?.user.name ?? userId.slice(0, 8);
}

function paymentText(settlement: Settlement, members: TripMember[]) {
  return settlement.qrPayload ?? [
    `Od: ${memberName(members, settlement.fromUserId)}`,
    `Komu: ${memberName(members, settlement.toUserId)}`,
    `Částka: ${settlement.amount.toFixed(2)} ${settlement.currency}`,
  ].join('\n');
}

function sanitizeFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'platba';
}

function dataUrlToBlob(dataUrl: string) {
  const [header = '', base64 = ''] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

async function downloadPaymentQr(payload: string, fileName: string) {
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 1024,
    color: { dark: '#111827', light: '#ffffff' },
  });
  const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function settlementReceiptExpenses(settlement: Settlement, expenses: Expense[]) {
  return expenses.filter((expense) => {
    if (!expense.receiptUrl) return false;
    const splitUserIds = new Set((expense.splits ?? []).map((split) => split.userId));
    const isCreditorPaidForDebtor = expense.paidById === settlement.toUserId && splitUserIds.has(settlement.fromUserId);
    const isDebtorPaidForCreditor = expense.paidById === settlement.fromUserId && splitUserIds.has(settlement.toUserId);
    return isCreditorPaidForDebtor || isDebtorPaidForCreditor;
  });
}

export function PaymentQrCode({ payload, size = 180 }: { payload?: string; size?: number }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!payload) {
      setSrc('');
      return;
    }
    void QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: { dark: '#111827', light: '#ffffff' },
    }).then((dataUrl) => {
      if (mounted) setSrc(dataUrl);
    }).catch(() => {
      if (mounted) setSrc('');
    });
    return () => {
      mounted = false;
    };
  }, [payload, size]);

  if (!payload) {
    return (
      <div className="center" style={{ width: size, height: size, color: 'var(--amber)' }}>
        <AlertTriangle size={Math.round(size * 0.34)} />
      </div>
    );
  }

  if (!src) {
    return (
      <div className="center" style={{ width: size, height: size, color: 'var(--faint-fg)' }}>
        <QrCode size={Math.round(size * 0.34)} />
      </div>
    );
  }

  return <img alt="QR platba" height={size} src={src} width={size} />;
}

export function SettlementPaymentContent({
  settlement,
  members,
  expenses = [],
  onClose,
  onStatusChange,
}: {
  settlement: Settlement;
  members: TripMember[];
  expenses?: Expense[];
  onClose?: () => void;
  onStatusChange?: (settlement: Settlement, status: 'OPEN' | 'PAID' | 'CONFIRMED' | 'CANCELLED') => void;
}) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fromName = memberName(members, settlement.fromUserId);
  const toName = memberName(members, settlement.toUserId);
  const copyText = useMemo(() => paymentText(settlement, members), [settlement, members]);
  const receiptExpenses = useMemo(() => settlementReceiptExpenses(settlement, expenses), [settlement, expenses]);
  const hasPaymentQr = Boolean(settlement.qrPayload);
  const status = settlement.status ?? 'OPEN';
  const statusLabel = status === 'CONFIRMED' ? 'Potvrzeno' : status === 'PAID' ? 'Zaplaceno' : status === 'CANCELLED' ? 'Zrušeno' : 'Čeká na platbu';
  const statusClass = status === 'CONFIRMED' ? 'green' : status === 'PAID' ? 'amber' : status === 'CANCELLED' ? 'red' : 'muted';

  async function copyDetails() {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function downloadQr() {
    if (!settlement.qrPayload) return;
    setDownloading(true);
    try {
      await downloadPaymentQr(
        settlement.qrPayload,
        `qr-platba-${sanitizeFilePart(fromName)}-${sanitizeFilePart(toName)}-${settlement.amount.toFixed(2)}-${settlement.currency.toLowerCase()}.png`,
      );
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 1400);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="scroll px18 center" style={{ flex: 1, paddingTop: 10 }}>
        <div className="row g8 jcc muted t-sm">
          <Avatar name={fromName} size="sm" />
          {fromName} platí {toName}
          <Avatar name={toName} size="sm" />
        </div>
        <span className={`badge ${statusClass} mt10`}>{statusLabel}</span>
        <div className="t-title tnum mt10" style={{ fontSize: 34 }}>{settlement.amount.toFixed(2)} {settlement.currency}</div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
          <Card style={{ padding: 14 }}><PaymentQrCode payload={settlement.qrPayload} size={180} /></Card>
        </div>
        {hasPaymentQr && (
          <Button className="mb12" variant="outline" size="sm" type="button" onClick={() => void downloadQr()} disabled={downloading}>
            {downloaded ? <Check size={15} /> : <Download size={15} />}
            {downloaded ? 'Staženo' : 'Stáhnout QR'}
          </Button>
        )}

        {!hasPaymentQr && (
          <Card className="mb12" style={{ padding: 12, background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412', textAlign: 'left' }}>
            <div className="row g10">
              <AlertTriangle size={18} />
              <span className="t-sm flex1">QR nejde vygenerovat, protože {toName} nemá uložené platební údaje.</span>
            </div>
          </Card>
        )}

        <Card style={{ padding: '4px 14px', textAlign: 'left' }}>
          {[
            ['Od', fromName],
            ['Komu', toName],
            ['Částka', `${settlement.amount.toFixed(2)} ${settlement.currency}`],
            ['QR payload', settlement.qrPayload ?? 'Chybí platební údaje'],
          ].map(([label, value], index) => (
            <div key={label}>
              {index > 0 && <hr className="sep" />}
              <div className="row between" style={{ padding: '11px 0', gap: 12 }}>
                <span className="muted t-sm">{label}</span>
                <span className="mono t-sm tnum" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{value}</span>
              </div>
            </div>
          ))}
        </Card>

        {receiptExpenses.length > 0 && (
          <Card className="mt12" style={{ padding: '4px 14px', textAlign: 'left', width: '100%' }}>
            <div className="row between" style={{ padding: '11px 0' }}>
              <span className="t-h3 row g8"><Receipt size={16} />Účtenky k vyrovnání</span>
              <span className="badge muted">{receiptExpenses.length}</span>
            </div>
            {receiptExpenses.map((expense) => {
              const paidByName = memberName(members, expense.paidById ?? '');
              return (
                <div key={expense.id}>
                  <hr className="sep" />
                  <div className="row between" style={{ padding: '11px 0', gap: 12 }}>
                    <div className="col flex1" style={{ minWidth: 0 }}>
                      <span className="t-sm semib" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expense.title}</span>
                      <span className="faint t-xs mt4">Platí {paidByName} · {Number(expense.amount).toFixed(0)} {expense.currency}</span>
                    </div>
                    <a className="btn outline sm" href={expense.receiptUrl ?? '#'} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                      <ExternalLink size={14} />Otevřít
                    </a>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        <span className="faint t-xs row g6 jcc mt14" style={{ paddingBottom: 6 }}>
          <ShieldCheck size={13} />{hasPaymentQr ? 'Naskenuj bankovní aplikací' : 'Doplň účet příjemce a QR se objeví automaticky'}
        </span>
      </div>
      <div className="row g8 p16" style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <Button variant="outline" className="flex1" type="button" onClick={() => void copyDetails()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Zkopírováno' : 'Kopírovat údaje'}
        </Button>
        {onStatusChange && status !== 'PAID' && status !== 'CONFIRMED' && (
          <Button className="flex1" type="button" onClick={() => onStatusChange(settlement, 'PAID')}>
            <Check size={16} />Zaplaceno
          </Button>
        )}
        {onStatusChange && status === 'PAID' && (
          <Button className="flex1" type="button" onClick={() => onStatusChange(settlement, 'CONFIRMED')}>
            <Check size={16} />Potvrdit
          </Button>
        )}
        {onClose && (
          <Button className="flex1" type="button" onClick={onClose}>
            <Check size={16} />Hotovo
          </Button>
        )}
      </div>
    </>
  );
}

export function SettlementPaymentSheet({
  settlement,
  members,
  expenses = [],
  onClose,
  onStatusChange,
}: {
  settlement: Settlement | null;
  members: TripMember[];
  expenses?: Expense[];
  onClose: () => void;
  onStatusChange?: (settlement: Settlement, status: 'OPEN' | 'PAID' | 'CONFIRMED' | 'CANCELLED') => void;
}) {
  return (
    <Sheet open={Boolean(settlement)} onOpenChange={(open) => !open && onClose()}>
      {settlement && (
        <SheetContent style={{ height: '90%' }}>
          <div className="grabber" />
          <div className="sheet-head">
            <SheetTitle className="t-h3">QR platba</SheetTitle>
            <button className="iconbtn plain" type="button" onClick={onClose} aria-label="Zavřít"><X size={20} /></button>
          </div>
          <SettlementPaymentContent settlement={settlement} members={members} expenses={expenses} onClose={onClose} onStatusChange={onStatusChange} />
        </SheetContent>
      )}
    </Sheet>
  );
}

export function SettlementParticipants({ settlement, members }: { settlement: Settlement; members: TripMember[] }) {
  const fromName = memberName(members, settlement.fromUserId);
  const toName = memberName(members, settlement.toUserId);
  return (
    <div className="row g8">
      <Avatar name={fromName} size="sm" />
      <ArrowRight size={16} color="var(--faint-fg)" />
      <Avatar name={toName} size="sm" />
      <span className="t-sm" style={{ marginLeft: 2 }}>
        <b>{fromName}</b> → <b>{toName}</b>
      </span>
    </div>
  );
}
