'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Globe } from 'lucide-react';

interface Session {
  id: string;
  name: string;
  city: string;
  flag: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  startUTC: number; // hour in UTC
  endUTC: number;   // hour in UTC
}

const SESSIONS: Session[] = [
  {
    id: 'sydney',
    name: 'Sydney',
    city: 'Sydney',
    flag: '🇦🇺',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    glowColor: 'shadow-yellow-500/20',
    startUTC: 22, // 22:00 UTC (08:00 AEST)
    endUTC: 7,    // 07:00 UTC (17:00 AEST)
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    city: 'Tóquio',
    flag: '🇯🇵',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    glowColor: 'shadow-rose-500/20',
    startUTC: 0,  // 00:00 UTC (09:00 JST)
    endUTC: 9,    // 09:00 UTC (18:00 JST)
  },
  {
    id: 'london',
    name: 'London',
    city: 'Londres',
    flag: '🇬🇧',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    glowColor: 'shadow-cyan-500/20',
    startUTC: 8,  // 08:00 UTC (08:00 GMT)
    endUTC: 17,  // 17:00 UTC (17:00 GMT)
  },
  {
    id: 'newyork',
    name: 'New York',
    city: 'Nova York',
    flag: '🇺🇸',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    glowColor: 'shadow-emerald-500/20',
    startUTC: 13, // 13:00 UTC (09:00 EST)
    endUTC: 22,  // 22:00 UTC (18:00 EST)
  },
];

/** Check if a session is currently active */
function isSessionActive(session: Session, utcHour: number, utcMinute: number): boolean {
  const utcDecimal = utcHour + utcMinute / 60;

  if (session.startUTC < session.endUTC) {
    // Same-day session (e.g., London 8-17)
    return utcDecimal >= session.startUTC && utcDecimal < session.endUTC;
  } else {
    // Overnight session (e.g., Sydney 22-7)
    return utcDecimal >= session.startUTC || utcDecimal < session.endUTC;
  }
}

/** Get session progress percentage (0-100) */
function getSessionProgress(session: Session, utcHour: number, utcMinute: number): number {
  const utcDecimal = utcHour + utcMinute / 60;

  let totalDuration: number;
  let elapsed: number;

  if (session.startUTC < session.endUTC) {
    totalDuration = session.endUTC - session.startUTC;
    elapsed = utcDecimal - session.startUTC;
  } else {
    totalDuration = (24 - session.startUTC) + session.endUTC;
    if (utcDecimal >= session.startUTC) {
      elapsed = utcDecimal - session.startUTC;
    } else {
      elapsed = (24 - session.startUTC) + utcDecimal;
    }
  }

  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

/** Get remaining time in session as string */
function getSessionRemaining(session: Session, utcHour: number, utcMinute: number): string {
  const utcDecimal = utcHour + utcMinute / 60;
  let remaining: number;

  if (session.startUTC < session.endUTC) {
    remaining = session.endUTC - utcDecimal;
  } else {
    if (utcDecimal >= session.startUTC) {
      remaining = (24 - utcDecimal) + session.endUTC;
    } else {
      remaining = session.endUTC - utcDecimal;
    }
  }

  if (remaining <= 0) return '00:00';

  const hours = Math.floor(remaining);
  const minutes = Math.floor((remaining - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/** Get session start/end in BRT */
function getSessionTimesBRT(session: Session): { start: string; end: string } {
  const brtOffset = -3; // BRT = UTC-3
  
  let startBRT = session.startUTC + brtOffset;
  let endBRT = session.endUTC + brtOffset;
  
  if (startBRT < 0) startBRT += 24;
  if (startBRT >= 24) startBRT -= 24;
  if (endBRT < 0) endBRT += 24;
  if (endBRT >= 24) endBRT -= 24;

  return {
    start: `${startBRT.toString().padStart(2, '0')}:00`,
    end: `${endBRT.toString().padStart(2, '0')}:00`,
  };
}

export function ForexSessionClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    // Delay first setState to next tick to avoid direct effect body call
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Avoid hydration mismatch: render a skeleton until client mounts
  if (!time) {
    return (
      <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-secondary" />
            <div className="h-3 w-32 rounded bg-secondary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const utcHour = time.getUTCHours();
  const utcMinute = time.getUTCMinutes();
  const utcSecond = time.getUTCSeconds();

  // Format current times
  const utcTimeStr = `${utcHour.toString().padStart(2, '0')}:${utcMinute.toString().padStart(2, '0')}:${utcSecond.toString().padStart(2, '0')}`;
  const brtTimeStr = time.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
  });

  // Get active sessions
  const activeSessions = SESSIONS.filter(s => isSessionActive(s, utcHour, utcMinute));

  // Calculate total 24h timeline position
  const timelinePosition = ((utcHour + utcMinute / 60) / 24) * 100;

  return (
    <Card className="border-2 border-cyan-500/60 bg-card/80 backdrop-blur-sm overflow-hidden shadow-lg shadow-cyan-500/20">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold">Sessões Forex</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>BRT {brtTimeStr}</span>
            </div>
            <div className="w-px h-3 bg-border/40" />
            <span className="text-[10px] text-muted-foreground font-mono">UTC {utcTimeStr}</span>
          </div>
        </div>

        {/* 24h Timeline Bar */}
        <div className="relative">
          {/* Timeline background */}
          <div className="h-8 rounded-lg bg-secondary/30 border border-border/20 overflow-hidden relative">
            {/* Session blocks on timeline */}
            {SESSIONS.map(session => {
              const startPct = (session.startUTC / 24) * 100;
              const endPct = (session.endUTC / 24) * 100;
              const isActive = isSessionActive(session, utcHour, utcMinute);
              
              let widthPct: number;
              let leftPct: number;
              
              if (session.startUTC < session.endUTC) {
                leftPct = startPct;
                widthPct = endPct - startPct;
              } else {
                // Overnight session - draw in two parts
                // Part 1: startUTC to 24
                // We'll just show the full span
                widthPct = (24 - session.startUTC + session.endUTC);
                leftPct = startPct;
              }

              return (
                <motion.div
                  key={session.id}
                  className={`absolute top-1 bottom-1 rounded-sm ${
                    isActive 
                      ? `${session.bgColor} border ${session.borderColor} shadow-sm ${session.glowColor}` 
                      : 'bg-secondary/50 border border-border/10 opacity-40'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.min(widthPct, 100 - leftPct)}%`,
                  }}
                  initial={false}
                  animate={{ opacity: isActive ? 0.9 : 0.3 }}
                  transition={{ duration: 0.5 }}
                />
              );
            })}

            {/* Current time indicator */}
            <motion.div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg shadow-white/50 z-10"
              style={{ left: `${timelinePosition}%` }}
              initial={false}
              animate={{ left: `${timelinePosition}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            >
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-lg shadow-white/50" />
            </motion.div>

            {/* Hour labels */}
            <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none">
              {[0, 6, 12, 18].map(h => (
                <span key={h} className="text-[7px] text-muted-foreground/50 font-mono">
                  {h.toString().padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>

          {/* Overlap indicators */}
          {activeSessions.length >= 2 && (
            <div className="flex items-center gap-1 mt-1">
              <div className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[8px] text-amber-400 font-medium">
                  Sobreposição: {activeSessions.map(s => s.flag).join(' + ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Session Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-1.5">
          {SESSIONS.map(session => {
            const isActive = isSessionActive(session, utcHour, utcMinute);
            const progress = getSessionProgress(session, utcHour, utcMinute);
            const remaining = isActive ? getSessionRemaining(session, utcHour, utcMinute) : null;
            const times = getSessionTimesBRT(session);

            return (
              <motion.div
                key={session.id}
                className={`relative rounded-lg p-2 border transition-all duration-500 ${
                  isActive 
                    ? `${session.bgColor} ${session.borderColor} shadow-sm ${session.glowColor}` 
                    : 'bg-secondary/20 border-border/20'
                }`}
                initial={false}
                animate={{
                  scale: isActive ? 1.02 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                      session.color === 'text-yellow-400' ? 'bg-yellow-400' :
                      session.color === 'text-rose-400' ? 'bg-rose-400' :
                      session.color === 'text-cyan-400' ? 'bg-cyan-400' :
                      'bg-emerald-400'
                    }`}
                    animate={{ 
                      boxShadow: [
                        `0 0 0 0 rgba(255,255,255,0)`,
                        `0 0 0 3px rgba(255,255,255,0.1)`,
                        `0 0 0 0 rgba(255,255,255,0)`,
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}

                {/* Flag + Name */}
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-sm leading-none">{session.flag}</span>
                  <span className={`text-[9px] font-bold leading-none ${isActive ? session.color : 'text-muted-foreground'}`}>
                    {session.city}
                  </span>
                </div>

                {/* Status */}
                <div className="mb-1.5">
                  <span className={`text-[8px] font-semibold uppercase tracking-wider ${
                    isActive ? session.color : 'text-muted-foreground/50'
                  }`}>
                    {isActive ? 'Aberta' : 'Fechada'}
                  </span>
                </div>

                {/* Progress bar */}
                {isActive && (
                  <div className="space-y-1">
                    <div className="h-0.5 rounded-full bg-secondary/60 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          session.color === 'text-yellow-400' ? 'bg-yellow-400' :
                          session.color === 'text-rose-400' ? 'bg-rose-400' :
                          session.color === 'text-cyan-400' ? 'bg-cyan-400' :
                          'bg-emerald-400'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[7px] text-muted-foreground font-mono">{remaining}</span>
                      <span className="text-[7px] text-muted-foreground/60">{Math.round(progress)}%</span>
                    </div>
                  </div>
                )}

                {/* BRT Times (shown when closed) */}
                {!isActive && (
                  <div className="text-[7px] text-muted-foreground/40 font-mono">
                    {times.start}-{times.end}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Footer - Next session info */}
        {(() => {
          const nowUTC = utcHour + utcMinute / 60;
          let nextSession: Session | null = null;
          let minWait = 25;

          for (const session of SESSIONS) {
            if (isSessionActive(session, utcHour, utcMinute)) continue;

            let wait: number;
            if (session.startUTC < session.endUTC) {
              wait = session.startUTC > nowUTC 
                ? session.startUTC - nowUTC 
                : 24 - nowUTC + session.startUTC;
            } else {
              wait = session.startUTC > nowUTC 
                ? session.startUTC - nowUTC 
                : 0; // started recently
            }

            if (wait > 0 && wait < minWait) {
              minWait = wait;
              nextSession = session;
            }
          }

          if (!nextSession || activeSessions.length === SESSIONS.length) return null;

          const hours = Math.floor(minWait);
          const minutes = Math.floor((minWait - hours) * 60);

          return (
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              <span className="text-[8px] text-muted-foreground/50">Próxima:</span>
              <span className="text-[8px] font-semibold text-muted-foreground">
                {nextSession.flag} {nextSession.city}
              </span>
              <span className="text-[8px] text-muted-foreground/50">
                em {hours}h {minutes > 0 ? `${minutes}min` : ''}
              </span>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
