import { configDefaults, defineConfig } from 'vitest/config';

// O teste do emulador do Firebase Auth roda à parte (npm run emulator:test), com Java e o
// emulador de pé; a suíte normal não depende dele.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'tests/emulator/**'] },
});
