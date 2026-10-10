import { avatarImageUrl } from '@/utils/cloudinary';
import type { SessionUser } from '@/hooks/useCurrentUser';

const SIZES = {
  sm: {
    box: 'w-8 h-8 text-xs border border-white/20',
    // El doble de los píxeles en pantalla, para que se vea nítida.
    pixels: 64,
  },
  lg: {
    box: 'w-32 h-32 text-5xl border-4 border-neutral-900 shadow-xl',
    pixels: 256,
  },
};

// La foto de perfil, o la inicial del nombre si no subió una.
export default function Avatar({
  user,
  size,
}: {
  user: Pick<SessionUser, 'name' | 'avatarUrl'>;
  size: keyof typeof SIZES;
}) {
  const { box, pixels } = SIZES[size];

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary ya la entrega del tamaño justo
      <img
        src={avatarImageUrl(user.avatarUrl, pixels)}
        alt={user.name}
        className={`${box} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${box} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shrink-0`}
    >
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}
