import { Navigate, Outlet } from 'react-router';
import { needsOnboarding } from '../engine/progress';
import { useProgress } from '../state/progress-context';
import { useChildSession } from '../state/use-activity';

/** Sends a new player to the welcome screen before anything else; counts play time once onboarded. */
export function Onboarded() {
  const { progress, loaded } = useProgress();
  useChildSession();
  if (!loaded) return null;
  return needsOnboarding(progress) ? <Navigate to="/welcome" replace /> : <Outlet />;
}
