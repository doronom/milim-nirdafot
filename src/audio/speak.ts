import { say } from './player';

/**
 * Reads Hebrew text aloud: the generated clip for it when there is one, otherwise the browser's speech engine. Silent
 * when no engine or voice is available, or when the parent turned reading aloud off: the child never sees an error.
 */
export function speak(text: string): void {
  void say(text);
}
