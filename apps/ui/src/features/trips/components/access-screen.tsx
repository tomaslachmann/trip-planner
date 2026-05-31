import { LogIn, Plane, UserRound } from 'lucide-react';
import { TripButton, TripCard } from './design-system';

export function AccessScreen({
  message,
  onSignIn,
}: {
  message?: string | null;
  onSignIn: (data: FormData) => Promise<void> | void;
}) {
  return (
    <div className="access-shell">
      <TripCard pad className="access-card">
        <div className="row g12 mb16">
          <div className="desk-brand" style={{ padding: 0 }}>
            <div className="logo"><Plane /></div>
          </div>
          <div className="col">
            <span className="t-title">Plánovač cest</span>
            <span className="muted t-sm mt4">Přihlas se a vyber si trip nebo se připoj přes pozvánku.</span>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSignIn(new FormData(event.currentTarget));
          }}
        >
          <label className="field-label" htmlFor="name">Jméno</label>
          <div className="input mb10">
            <UserRound />
            <input id="name" name="name" placeholder="Tomas" autoComplete="name" />
          </div>
          <label className="field-label" htmlFor="email">E-mail člena</label>
          <div className="input mb10">
            <UserRound />
            <input id="email" name="email" type="email" placeholder="tomas@example.com" autoComplete="email" />
          </div>
          {message && <div className="badge red mb12" style={{ justifyContent: 'center', width: '100%' }}>{message}</div>}
          <TripButton tone="primary" block type="submit"><LogIn />Pokračovat</TripButton>
        </form>

        <p className="muted t-xs mt16">Použij e-mail, pod kterým chceš spravovat svoje tripy.</p>
      </TripCard>
    </div>
  );
}
