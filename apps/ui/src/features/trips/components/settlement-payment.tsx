'use client';

import { AlertTriangle, ArrowRight, Check, Copy, QrCode, ShieldCheck, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Avatar } from './avatar';
import type { Settlement, TripMember } from '../types';

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
  onClose,
  onStatusChange,
}: {
  settlement: Settlement;
  members: TripMember[];
  onClose?: () => void;
  onStatusChange?: (settlement: Settlement, status: 'OPEN' | 'PAID' | 'CONFIRMED' | 'CANCELLED') => void;
}) {
  const [copied, setCopied] = useState(false);
  const fromName = memberName(members, settlement.fromUserId);
  const toName = memberName(members, settlement.toUserId);
  const copyText = useMemo(() => paymentText(settlement, members), [settlement, members]);
  const hasPaymentQr = Boolean(settlement.qrPayload);
  const status = settlement.status ?? 'OPEN';
  const statusLabel = status === 'CONFIRMED' ? 'Potvrzeno' : status === 'PAID' ? 'Zaplaceno' : status === 'CANCELLED' ? 'Zrušeno' : 'Čeká na platbu';
  const statusClass = status === 'CONFIRMED' ? 'green' : status === 'PAID' ? 'amber' : status === 'CANCELLED' ? 'red' : 'muted';

  async function copyDetails() {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
  onClose,
  onStatusChange,
}: {
  settlement: Settlement | null;
  members: TripMember[];
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
          <SettlementPaymentContent settlement={settlement} members={members} onClose={onClose} onStatusChange={onStatusChange} />
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
