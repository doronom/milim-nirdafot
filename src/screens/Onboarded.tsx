import { Navigate, Outlet } from 'react-router';
import { needsOnboarding } from '../engine/progress';
import { useProgress } from '../state/progress-context';

/** Sends a new player to the welcome screen before anything else. */
export function Onboarded() {
  const { progress, loaded } = useProgress();
  if (!loaded) return null;
  return needsOnboarding(progress) ? <Navigate to="/welcome" replace /> : <Outlet />;
}
