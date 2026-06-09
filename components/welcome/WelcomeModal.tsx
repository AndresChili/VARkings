'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Trophy, Users, Zap, Star, X } from 'lucide-react';
import { VarkingsLogo, VarkingsWordmark } from '@/components/ui/varkings-logo';

interface WelcomeModalProps {
  userId: string;
}

const storageKey = (id: string) => `varkings_welcomed_${id}`;

export function WelcomeModal({ userId }: WelcomeModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(storageKey(userId))) setOpen(true);
  }, [userId]);

  function dismiss() {
    localStorage.setItem(storageKey(userId), '1');
    setOpen(false);
  }

  function next() {
    if (step < 2) setStep((s) => s + 1);
    else dismiss();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={dismiss}
    >
      <div
        className="relative bg-surface-card border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm overflow-hidden shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X size={15} />
        </button>

        {/* Step content — key forces fade-in on step change */}
        <div key={step} className="animate-fade-in">
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepScoring />}
          {step === 2 && <StepExtras />}
        </div>

        {/* Footer */}
        <div className="px-5 pt-2 pb-6">
          <button
            onClick={next}
            className="w-full bg-crown hover:bg-crown-muted active:scale-[0.98] text-surface font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {step < 2 ? (
              <>
                Siguiente <ChevronRight size={17} />
              </>
            ) : (
              <>
                ¡Empezar a jugar! <Trophy size={17} />
              </>
            )}
          </button>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-crown' : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepWelcome() {
  return (
    <div>
      {/* Hero gradient */}
      <div className="relative bg-gradient-to-br from-field-dark via-[#1e5c3a] to-field px-6 pt-10 pb-7 text-center overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-black/20" />
        <div className="absolute top-4 right-8 w-3 h-3 rounded-full bg-crown/40" />
        <div className="absolute bottom-6 left-10 w-2 h-2 rounded-full bg-crown/30" />

        <div className="relative">
          <div className="flex justify-center mb-3">
            <VarkingsLogo size={72} className="shadow-2xl ring-2 ring-white/10" />
          </div>
          <h1 className="text-2xl font-black text-white mt-2">
            Bienvenido a{' '}
            <VarkingsWordmark className="text-2xl" />
          </h1>
          <p className="text-field-light/90 text-sm mt-1.5 font-medium">
            La quiniela del Mundial 2026
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5">
        <p className="text-gray-300 text-sm leading-relaxed text-center">
          Predice partidos, acumula puntos y demuestra que sabes de fútbol. Compite con tus amigos y escala el ranking global.
        </p>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2.5 mt-4">
          <div className="bg-surface border border-white/5 rounded-xl py-3 text-center">
            <p className="text-crown font-black text-xl leading-none">104</p>
            <p className="text-gray-500 text-xs mt-1">partidos</p>
          </div>
          <div className="bg-surface border border-white/5 rounded-xl py-3 text-center">
            <p className="text-field-light font-black text-xl leading-none">20</p>
            <p className="text-gray-500 text-xs mt-1">niveles</p>
          </div>
          <div className="bg-surface border border-white/5 rounded-xl py-3 text-center">
            <p className="text-white font-black text-xl leading-none">28</p>
            <p className="text-gray-500 text-xs mt-1">logros</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepScoring() {
  return (
    <div>
      <div className="px-5 pt-6 pb-1">
        <h2 className="text-xl font-black text-white">¿Cómo puntuar?</h2>
        <p className="text-gray-500 text-sm mt-0.5">Tres formas de sumar puntos al ranking</p>
      </div>

      <div className="px-5 py-4 space-y-2.5">
        {/* Partidos */}
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="text-xl">⚽</span>
            <p className="font-bold text-white text-sm flex-1">Partidos</p>
            <span className="text-xs text-field-light font-semibold bg-field/20 px-2 py-0.5 rounded-full">
              máx. 3 pts
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Marcador exacto</span>
              <span className="text-crown font-black">3 pts</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Solo el resultado</span>
              <span className="text-gray-300 font-bold">1 pt</span>
            </div>
          </div>
        </div>

        {/* Podio */}
        <div className="bg-surface border border-crown/20 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-crown/5 rounded-bl-3xl" />
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="text-xl">🏆</span>
            <p className="font-bold text-white text-sm flex-1">Podio del torneo</p>
            <span className="text-xs text-crown font-semibold bg-crown/10 px-2 py-0.5 rounded-full">
              más pts
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">🥇 Campeón exacto</span>
              <span className="text-crown font-black">20 pts</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">🥈 Subcampeón</span>
              <span className="text-gray-300 font-bold">10 pts</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">🥉 Tercer puesto</span>
              <span className="text-gray-300 font-bold">5 pts</span>
            </div>
          </div>
        </div>

        {/* Clasificados */}
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="text-xl">🗺️</span>
            <p className="font-bold text-white text-sm flex-1">Clasificados por grupo</p>
            <span className="text-xs text-field-light font-semibold bg-field/20 px-2 py-0.5 rounded-full">
              máx. 5 pts
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Ambos equipos</span>
              <span className="text-crown font-black">5 pts</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Un equipo</span>
              <span className="text-gray-300 font-bold">2 pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepExtras() {
  return (
    <div>
      <div className="px-5 pt-6 pb-1">
        <h2 className="text-xl font-black text-white">Mucho más por descubrir</h2>
        <p className="text-gray-500 text-sm mt-0.5">El juego tiene profundidad</p>
      </div>

      <div className="px-5 py-4 space-y-2.5">
        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-field/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users size={19} className="text-field-light" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">Grupos privados</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
              Crea o únete a un grupo y compite en un ranking solo entre amigos.
            </p>
          </div>
        </div>

        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-crown/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap size={19} className="text-crown" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">XP y niveles</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
              Cada punto ganado se convierte en XP. Sube hasta el nivel 20.
            </p>
          </div>
        </div>

        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-purple-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Star size={19} className="text-purple-400" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">28 logros</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
              Desbloquea logros haciendo predicciones, conectando con amigos y manteniendo rachas.
            </p>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs pt-1">
          Hecho por Andrés con ❤️ ·{' '}
          <a
            href="mailto:andrescabreroamieva@gmail.com"
            className="text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
          >
            ¿sugerencias?
          </a>
        </p>
      </div>
    </div>
  );
}
