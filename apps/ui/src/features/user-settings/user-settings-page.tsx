'use client';

import { ArrowLeft, Check, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ValidatedForm } from '@/components/ui/validated-form';
import { AccessScreen } from '@/features/trips/components/access-screen';
import { Avatar } from '@/features/trips/components/avatar';
import {
  clearAccessToken,
  getSessionUser,
  registerRequest,
  readAccessToken,
  signInRequest,
  signOutRequest,
  updateSessionUser,
  writeAccessToken,
  type SessionUser,
  type UpdateSessionUserRequest,
} from '@/lib/api';

type BudgetValue = 'BUDGET' | 'NORMAL' | 'PREMIUM';
type CurrencyValue = 'CZK' | 'EUR' | 'USD' | 'GBP';

const currencyOptions: Array<{ value: CurrencyValue; label: string }> = [
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'CZK', label: 'CZK - Česká koruna' },
  { value: 'USD', label: 'USD - Americký dolar' },
  { value: 'GBP', label: 'GBP - Britská libra' },
];

function accountComplete(user: SessionUser | null) {
  const account = user?.accounts?.[0];
  return Boolean(account?.recipientName && (account.iban || account.domesticAccount));
}

function SettingsRow({ label, name, val, ph, type = 'text', required = false }: { label: string; name: string; val?: string | null; ph?: string; type?: string; required?: boolean }) {
  return (
    <>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={val ?? ''} placeholder={ph} required={required} />
    </>
  );
}

function UserSettingsBody({
  user,
  saving,
  message,
  onSave,
  onSignOut,
}: {
  user: SessionUser;
  saving: boolean;
  message?: string | null;
  onSave: (input: UpdateSessionUserRequest) => void;
  onSignOut: () => void;
}) {
  const account = user.accounts?.[0];
  const [budget, setBudget] = useState<BudgetValue>(user.travelBudgetPreference ?? 'NORMAL');
  const [currency, setCurrency] = useState<CurrencyValue>((user.defaultCurrency as CurrencyValue | undefined) ?? 'EUR');
  const paymentComplete = accountComplete(user);

  useEffect(() => {
    setBudget(user.travelBudgetPreference ?? 'NORMAL');
    setCurrency((user.defaultCurrency as CurrencyValue | undefined) ?? 'EUR');
  }, [user]);

  return (
    <>
      <div className="row g14" style={{ marginBottom: 8 }}>
        <Avatar name={user.name} size="lg" />
        <div className="col flex1" style={{ minWidth: 0 }}>
          <span className="t-h3">{user.name}</span>
          <span className="muted t-sm ellipsis">{user.email}</span>
        </div>
      </div>

      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const text = (key: string) => String(data.get(key) ?? '').trim();
          onSave({
            name: text('name'),
            email: text('email').toLowerCase(),
            travelBudgetPreference: budget,
            foodNotes: text('foodNotes') || null,
            accessibilityNotes: text('accessibilityNotes') || null,
            defaultCurrency: currency,
            paymentAccount: {
              recipientName: text('recipientName') || null,
              iban: text('iban') || null,
              domesticAccount: text('domesticAccount') || null,
              bankCode: text('bankCode') || null,
            },
          });
        }}
      >
        <div className="t-h3 mt24 mb12">Profil</div>
        <Card className="card pad">
          <SettingsRow label="Jméno" name="name" val={user.name} ph="Tvoje jméno" required />
          <div className="mt14" />
          <SettingsRow label="E-mail" name="email" val={user.email} ph="ty@email.cz" type="email" required />
        </Card>

        <div className="t-h3 mt24 mb12">Cestovní preference</div>
        <Card className="card pad">
          <Label>Styl rozpočtu</Label>
          <SegmentedControl
            value={budget}
            onValueChange={setBudget}
            options={[
              { value: 'BUDGET', label: 'Úsporný' },
              { value: 'NORMAL', label: 'Střed' },
              { value: 'PREMIUM', label: 'Komfort' },
            ]}
          />
          <Label className="mt16" htmlFor="foodNotes">Jídlo</Label>
          <Input id="foodNotes" name="foodNotes" defaultValue={user.foodNotes ?? ''} placeholder="Alergie, dieta..." />
          <Label className="mt16" htmlFor="accessibilityNotes">Přístupnost</Label>
          <Input id="accessibilityNotes" name="accessibilityNotes" defaultValue={user.accessibilityNotes ?? ''} placeholder="Co máme při plánování hlídat" />
        </Card>

        <div className="row between mt24 mb12">
          <span className="t-h3">Platební údaje</span>
          <span className={`badge ${paymentComplete ? 'green' : 'amber'}`}>
            {paymentComplete ? <Check size={12} /> : <ShieldCheck size={12} />}
            {paymentComplete ? 'Doplněno' : 'Chybí údaje'}
          </span>
        </div>
        <Card className="card pad">
          <SettingsRow label="Jméno příjemce" name="recipientName" val={account?.recipientName ?? user.name} ph="Jméno na účtu" />
          <div className="mt14" />
          <SettingsRow label="IBAN" name="iban" val={account?.iban} ph="CZ65 0800 0000 1920 0014 5399" />
          <div className="row g12 mt14">
            <div className="flex1" style={{ flex: 2 }}>
              <SettingsRow label="Číslo účtu" name="domesticAccount" val={account?.domesticAccount} ph="1920001453" />
            </div>
            <div className="flex1">
              <SettingsRow label="Kód banky" name="bankCode" val={account?.bankCode} ph="0800" />
            </div>
          </div>
          <Label className="mt14">Výchozí měna</Label>
          <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyValue)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {currencyOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>

        {message && <div className={`badge ${message.includes('uloženo') ? 'green' : 'red'} mt16`} style={{ justifyContent: 'center', width: '100%' }}>{message}</div>}

        <Button className="w-full mt16" type="submit" disabled={saving}>
          {saving ? 'Ukládám...' : 'Uložit nastavení'}
        </Button>
      </ValidatedForm>

      <Button className="w-full mt10" variant="ghost" type="button" onClick={onSignOut} style={{ color: 'var(--destructive)' }}>
        <LogOut size={16} />Odhlásit
      </Button>
    </>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 980px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

export function UserSettingsContent({ mobileAppBar = false }: { mobileAppBar?: boolean } = {}) {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = readAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setAccessToken(token);
    getSessionUser(token)
      .then(({ user: nextUser }) => setUser(nextUser))
      .catch(() => {
        clearAccessToken();
        setAccessToken('');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const body = useMemo(() => {
    if (!user) return null;
    return (
      <UserSettingsBody
        user={user}
        saving={saving}
        message={message}
        onSave={(input) => {
          setSaving(true);
          setMessage(null);
          updateSessionUser(input, accessToken)
            .then(({ user: nextUser }) => {
              setUser(nextUser);
              setMessage('Nastavení uloženo.');
            })
            .catch(() => setMessage('Nastavení se nepodařilo uložit.'))
            .finally(() => setSaving(false));
        }}
        onSignOut={() => {
          void Promise.resolve(accessToken ? signOutRequest(accessToken) : undefined).finally(() => {
            clearAccessToken();
            router.push('/trips');
          });
        }}
      />
    );
  }, [accessToken, message, router, saving, user]);

  if (loading) {
    return (
      <div className="app-empty-stage">
        <Card className="center p-[16px] shadow-[var(--sh-sm)]">
          <div className="t-h2">Načítám nastavení...</div>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <AccessScreen
        message={message}
        onSignIn={(formData) => {
          const email = String(formData.get('email') ?? '').trim().toLowerCase();
          const name = String(formData.get('name') ?? '').trim();
          const password = String(formData.get('password') ?? '');
          const passwordConfirm = String(formData.get('passwordConfirm') ?? '');
          const authMode = String(formData.get('authMode') ?? 'sign-in') === 'register' ? 'register' : 'sign-in';
          if (password.length < 8) {
            setMessage('Heslo musí mít alespoň 8 znaků.');
            return;
          }
          if (authMode === 'register' && password !== passwordConfirm) {
            setMessage('Hesla se neshodují.');
            return;
          }
          setLoading(true);
          const request = authMode === 'register'
            ? registerRequest({ email, name, password })
            : signInRequest({ email, password });
          request
            .then((session) => {
              writeAccessToken(session.accessToken);
              setAccessToken(session.accessToken);
              setUser(session.user);
              setMessage(null);
            })
            .catch(() => setMessage(authMode === 'register' ? 'Registrace se nepodařila.' : 'Přihlášení se nepodařilo.'))
            .finally(() => setLoading(false));
        }}
      />
    );
  }

  if (!mobileAppBar) return <>{body}</>;

  return (
    <div className="screen">
      <div className="appbar">
        <Button
          size="icon"
          variant="ghost"
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push('/trips');
          }}
          aria-label="Zpět"
        >
          <ArrowLeft />
        </Button>
        <span className="t-h3 flex1">Nastavení</span>
      </div>
      <div className="scroll px18" style={{ flex: 1, paddingBottom: 18, paddingTop: 6 }}>
        {body}
      </div>
    </div>
  );
}

export function UserSettingsPage() {
  const isDesktop = useIsDesktop();

  if (isDesktop === null) {
    return (
      <div className="app-empty-stage">
        <Card className="center p-[16px] shadow-[var(--sh-sm)]">
          <div className="t-h2">Načítám nastavení...</div>
        </Card>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="desktop-stage">
        <div className="desk">
          <main className="desk-main">
            <div className="desk-body">
              <div className="desk-scroll">
                <div className="maxw" style={{ maxWidth: 680 }}>
                  <h1 className="desk-h mb16">Tvoje nastavení</h1>
                  <UserSettingsContent />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-stage">
      <div className="mobile-app-shell">
        <UserSettingsContent mobileAppBar />
      </div>
    </div>
  );
}
