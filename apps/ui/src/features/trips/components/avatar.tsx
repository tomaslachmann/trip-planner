import { cn } from '@/lib/utils';

const avatarPalette = [
  { backgroundColor: '#0f766e', color: '#fff' },
  { backgroundColor: '#b45309', color: '#fff' },
  { backgroundColor: '#6d28d9', color: '#fff' },
  { backgroundColor: '#be123c', color: '#fff' },
  { backgroundColor: '#1d4ed8', color: '#fff' },
  { backgroundColor: '#047857', color: '#fff' },
  { backgroundColor: '#7c3aed', color: '#fff' },
  { backgroundColor: '#c2410c', color: '#fff' },
];

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase('cs-CZ') || '?';
}

function avatarStyle(name: string) {
  const normalized = normalizeName(name);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return avatarPalette[hash % avatarPalette.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toLocaleUpperCase('cs-CZ');
  return (parts[0]?.slice(0, 1) ?? '?').toLocaleUpperCase('cs-CZ');
}

export function Avatar({ name, size = '' }: { name: string; size?: 'sm' | 'lg' | 'xl' | '' }) {
  return <div className={cn('av', size)} style={avatarStyle(name)}>{initials(name)}</div>;
}

export function AvatarRow({ names }: { names: string[] }) {
  return (
    <div className="av-row">
      {names.slice(0, 5).map((name, index) => (
        <Avatar name={name} size="sm" key={`${name}-${index}`} />
      ))}
    </div>
  );
}
