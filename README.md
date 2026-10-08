# VARkings

Quiniela para predecir los resultados del Mundial 2026, pensada para jugar entre grupos de amigos. Cada usuario predice marcadores, clasificados de grupo y el podio final del torneo, y compite por puntos dentro de sus propios grupos privados.

**Demo:** [va-rkings.vercel.app/demo](https://va-rkings.vercel.app/demo) — sin necesidad de registrarte.

![Pantalla de partidos](docs/screenshots/partidos.png)
![Clasificación de un grupo](docs/screenshots/clasificacion.png)
![Perfil de usuario](docs/screenshots/perfil.png)
![Logros](docs/screenshots/logros.png)

## Funcionalidades

- **Predicciones por partido**: antes de cada partido, el usuario predice el marcador exacto. Si el partido es de eliminatoria y el usuario predice un empate, también elige qué equipo pasa de ronda.
- **Fase de grupos**: predicción de qué 2 equipos quedan clasificados en cada grupo, antes de que arranque el torneo.
- **Podio final**: predicción de campeón, subcampeón y tercer puesto.
- **Grupos privados**: cada usuario crea o se une a grupos con sus amigos (por código de invitación), con su propia clasificación y chat en tiempo real.
- **Amigos**: solicitudes de amistad, perfil público con historial de predicciones y estadísticas.
- **Niveles, XP y logros**: se gana experiencia por predecir, acertar, invitar amigos o completar hitos, con un sistema de niveles e insignias desbloqueables.
- **Notificaciones push**: aviso antes de que empiece un partido si al usuario le falta predecirlo.
- **Instalable como app (PWA)**: funciona como aplicación en el móvil, con icono y pantalla de carga propios.

## Sistema de puntuación

Por cada partido se pueden ganar hasta 3 puntos:
- 1 punto por acertar el ganador (o el empate).
- 1 punto por acertar los goles del equipo local.
- 1 punto por acertar los goles del equipo visitante.

En partidos de eliminatoria que terminan en empate y se deciden por penales, el punto de "ganador" se otorga según qué equipo eligió el usuario que pasaría de ronda, no según el resultado del empate.

Por la fase de grupos: 5 puntos si aciertas los dos equipos que clasifican de un grupo, 2 puntos si aciertas solo uno.

Por el podio final: 20 puntos por acertar el campeón exacto, 10 por el subcampeón, 5 por el tercer puesto. Si un equipo queda en el podio pero no en la posición exacta que predijiste, se dan 3 puntos de consolación.

## Estado del proyecto

Finalizado. Se usó durante todo el Mundial 2026 con unos 30-40 usuarios reales repartidos en 4-5 grupos privados, hasta el último partido del torneo. Ya no está en mantenimiento activo; la demo pública muestra la app con datos de ejemplo.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Supabase: base de datos Postgres, autenticación y chat en tiempo real
- Upstash Redis: límite de peticiones (rate limiting)
- PWA con notificaciones push
- Vercel: despliegue y tareas programadas (cron)

## Local

```bash
npm install
cp .env.example .env.local   # completa tus propias claves
npm run dev
```

---

Desarrollado con asistencia de IA (Claude Code).
