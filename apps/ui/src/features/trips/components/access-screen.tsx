import { KeyRound, LogIn, Plane, UserPlus, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ValidatedForm } from '@/components/ui/validated-form';

export function AccessScreen({
  message,
  onSignIn,
}: {
  message?: string | null;
  onSignIn: (data: FormData) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const confirm = confirmRef.current;
    if (!confirm) return;
    confirm.setCustomValidity(mode === 'register' && passwordConfirm && password !== passwordConfirm ? 'Hesla se neshodují.' : '');
  }, [mode, password, passwordConfirm]);

  return (
    <div className="access-shell">
      <Card className="access-card p-[14px] shadow-[var(--sh-sm)]">
        <div className="row g12 mb16">
          <div className="desk-brand" style={{ padding: 0 }}>
            <div className="logo"><Plane /></div>
          </div>
          <div className="col">
            <span className="t-title">Plánovač cest</span>
            <span className="muted t-sm mt4">Přihlas se heslem, nebo si vytvoř účet.</span>
          </div>
        </div>

        <ValidatedForm
          onSubmit={(event) => {
            event.preventDefault();
            onSignIn(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="authMode" value={mode} />
          <SegmentedControl
            className="mb16"
            value={mode}
            onValueChange={(value) => setMode(value as typeof mode)}
            options={[
              { value: 'sign-in', label: 'Přihlášení' },
              { value: 'register', label: 'Registrace' },
            ]}
          />
          {mode === 'register' && (
            <>
              <Label htmlFor="name">Jméno</Label>
              <div className="relative mb-3">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" id="name" name="name" placeholder="Tomas" autoComplete="name" required />
              </div>
            </>
          )}
          <Label htmlFor="email">E-mail člena</Label>
          <div className="relative mb-3">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" id="email" name="email" type="email" placeholder="tomas@example.com" autoComplete="email" required />
          </div>
          <Label htmlFor="password">Heslo</Label>
          <div className="relative mb-3">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              id="password"
              name="password"
              type="password"
              minLength={8}
              placeholder="Minimálně 8 znaků"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {mode === 'register' && (
            <>
              <Label htmlFor="passwordConfirm">Potvrzení hesla</Label>
              <div className="relative mb-3">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  minLength={8}
                  placeholder="Zopakuj heslo"
                  autoComplete="new-password"
                  ref={confirmRef}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  required
                />
              </div>
            </>
          )}
          {message && <div className="badge red mb12" style={{ justifyContent: 'center', width: '100%' }}>{message}</div>}
          <Button className="w-full" type="submit">{mode === 'register' ? <UserPlus /> : <LogIn />}{mode === 'register' ? 'Vytvořit účet' : 'Přihlásit'}</Button>
        </ValidatedForm>

        <p className="muted t-xs mt16">Starý dev login bez hesla už neplatí. Pro existující e-mail bez hesla použij registraci a účet se převede.</p>
      </Card>
    </div>
  );
}
