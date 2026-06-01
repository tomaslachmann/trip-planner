import { LogIn, Plane, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ValidatedForm } from '@/components/ui/validated-form';

export function AccessScreen({
  message,
  onSignIn,
}: {
  message?: string | null;
  onSignIn: (data: FormData) => Promise<void> | void;
}) {
  return (
    <div className="access-shell">
      <Card className="access-card p-[14px] shadow-[var(--sh-sm)]">
        <div className="row g12 mb16">
          <div className="desk-brand" style={{ padding: 0 }}>
            <div className="logo"><Plane /></div>
          </div>
          <div className="col">
            <span className="t-title">Plánovač cest</span>
            <span className="muted t-sm mt4">Přihlas se a vyber si trip nebo se připoj přes pozvánku.</span>
          </div>
        </div>

        <ValidatedForm
          onSubmit={(event) => {
            event.preventDefault();
            onSignIn(new FormData(event.currentTarget));
          }}
        >
          <Label htmlFor="name">Jméno</Label>
          <div className="relative mb-3">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" id="name" name="name" placeholder="Tomas" autoComplete="name" required />
          </div>
          <Label htmlFor="email">E-mail člena</Label>
          <div className="relative mb-3">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" id="email" name="email" type="email" placeholder="tomas@example.com" autoComplete="email" required />
          </div>
          {message && <div className="badge red mb12" style={{ justifyContent: 'center', width: '100%' }}>{message}</div>}
          <Button className="w-full" type="submit"><LogIn />Pokračovat</Button>
        </ValidatedForm>

        <p className="muted t-xs mt16">Použij e-mail, pod kterým chceš spravovat svoje tripy.</p>
      </Card>
    </div>
  );
}
