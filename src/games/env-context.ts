import { createContext, useContext } from 'react';
import type { GameEnv } from './types';

export const GameEnvContext = createContext<GameEnv | null>(null);

export function useGameEnv(): GameEnv {
  const env = useContext(GameEnvContext);
  if (!env) throw new Error('useGameEnv outside GameEnvContext');
  return env;
}
