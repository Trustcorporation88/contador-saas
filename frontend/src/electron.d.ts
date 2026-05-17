/**
 * Declara o objeto global window.electronAPI exposto pelo preload.
 * Disponível apenas quando rodando dentro do Electron.
 */
export {};

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      versions: Record<string, string>;
    };
  }
}
