import APP_BASE_PATH from '@/appBasePath';

const resolveApiBasePath = (): string => {
  const envBase =
    typeof import.meta !== 'undefined' &&
      (import.meta as any)?.env &&
      (import.meta as any).env.BASE_URL
      ? (import.meta as any).env.BASE_URL
      : undefined;

  // Prefer Vite BASE_URL (from vite.config.ts); fall back to APP_BASE_PATH
  const base =
    (typeof envBase === 'string' && envBase.length > 0
      ? envBase
      : APP_BASE_PATH) || '/';

  const trimmed = base.replace(/\/+$/, '');

  if (trimmed && trimmed !== '.' && trimmed !== '') {
    return `${trimmed}/api`;
  }

  return '/api';
};

export default resolveApiBasePath;
