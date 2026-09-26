'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Ticket } from 'lucide-react';

// Pestaña "Ajustes" del panel del organizador.
export default function SettingsTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="font-outfit text-2xl font-bold">
              Ajustes de Organizador
            </h2>
            <p className="text-sm text-neutral-400">
              Configura tu perfil de organizador y herramientas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-start hover:border-white/20 transition-colors">
            <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center text-pink-400 mb-4">
              <Ticket className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Plantillas de Tickets
            </h3>
            <p className="text-sm text-neutral-400 mb-6 flex-1">
              Gestiona tus presets rápidos para cargar entradas en segundos al
              crear nuevos eventos.
            </p>
            <Link
              href="/panel/configuracion/presets"
              className="w-full text-center bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Administrar Plantillas
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
