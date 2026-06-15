import { mediaUrl } from '../api';

type Props = {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
};

export function Avatar({ src, name, size = 44, className = '' }: Props) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase();
  const style = { width: size, height: size, fontSize: size * 0.42 } as const;

  if (src) {
    return (
      <img
        src={mediaUrl(src)}
        alt={name}
        style={style}
        className={`rounded-full object-cover ring-2 ring-white/40 dark:ring-white/10 ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`rounded-full flex items-center justify-center font-semibold text-white shadow-inner ${className}`}
      // gradient initial
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, rgb(var(--accent-400)), rgb(var(--accent-600)))',
        }}
      >
        {initial}
      </div>
    </div>
  );
}
