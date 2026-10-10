'use client';

import ProfileForm from '@/components/account/ProfileForm';

export default function PerfilPage() {
  return (
    <div className="max-w-4xl mx-auto pt-8 pb-24 md:py-8 px-4 md:px-8">
      <div className="mb-8">
        <h1 className="font-outfit text-4xl font-bold text-white mb-2">
          Mi perfil
        </h1>
        <p className="text-neutral-400">Gestioná tu información personal.</p>
      </div>

      <ProfileForm />
    </div>
  );
}
