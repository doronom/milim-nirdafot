import { resetEmulators } from './emulator';

export default async function globalSetup(): Promise<void> {
  await resetEmulators();
}
