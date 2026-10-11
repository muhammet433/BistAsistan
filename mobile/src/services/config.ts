import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://bistasistan-production.up.railway.app';

function resolveHost(): { host: string; secure: boolean } {
  const configured = process.env.EXPO_PUBLIC_API_HOST || PRODUCTION_API_URL;

  if (configured) {
    const cleaned = configured.replace(/^(https?):\/\//, '');
    const secure = configured.startsWith('https://');
    return { host: cleaned, secure };
  }

  if (Platform.OS === 'android') return { host: '10.0.2.2:3000', secure: false };
  return { host: 'localhost:3000', secure: false };
}

const { host, secure } = resolveHost();
const httpProtocol = secure ? 'https' : 'http';
const wsProtocol = secure ? 'wss' : 'ws';

export const API_BASE_URL = `${httpProtocol}://${host}/api`;
export const WS_URL = `${wsProtocol}://${host}/ws`;
export const API_HOST = host;