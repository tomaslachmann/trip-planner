import { cn } from '@/lib/utils';

export function Avatar({ name, size = '' }: { name: string; size?: 'sm' | 'lg' | 'xl' | '' }) {
  return <div className={cn('av', size)}>{name.slice(0, 1).toUpperCase()}</div>;
}

export function AvatarRow({ names }: { names: string[] }) {
  return (
    <div className="av-row">
      {names.slice(0, 5).map((name, index) => (
        <div className={`av sm av-c${index % 5}`} key={`${name}-${index}`}>{name.slice(0, 1).toUpperCase()}</div>
      ))}
    </div>
  );
}
