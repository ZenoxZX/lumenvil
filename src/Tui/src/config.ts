import fs from 'fs';
import os from 'os';
import path from 'path';
import { User } from './types.js';

export type AppConfig = {
  apiBase: string;
  hubUrl: string;
  token?: string;
  user?: User;
};

const DEFAULT_API_BASE = 'http://localhost:5000/api';
const DEFAULT_HUB_URL = 'http://localhost:5000/hubs/build';

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'lumenvil');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const envOverrides = (): Partial<AppConfig> => {
  const overrides: Partial<AppConfig> = {};
  if (process.env.LUMENVIL_API_URL) overrides.apiBase = process.env.LUMENVIL_API_URL;
  if (process.env.LUMENVIL_HUB_URL) overrides.hubUrl = process.env.LUMENVIL_HUB_URL;
  return overrides;
};

const normalize = (config: AppConfig): AppConfig => ({
  apiBase: config.apiBase || DEFAULT_API_BASE,
  hubUrl: config.hubUrl || DEFAULT_HUB_URL,
  token: config.token,
  user: config.user,
  ...envOverrides(),
});

const readConfigFile = (): AppConfig | null => {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw) as AppConfig;
  } catch {
    return null;
  }
};

const writeConfigFile = (config: AppConfig) => {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
};

export class ConfigStore {
  private config: AppConfig;

  constructor() {
    const fileConfig = readConfigFile();
    this.config = normalize({
      apiBase: DEFAULT_API_BASE,
      hubUrl: DEFAULT_HUB_URL,
      ...fileConfig,
    });
  }

  get(): AppConfig {
    return this.config;
  }

  save(next: AppConfig) {
    this.config = normalize(next);
    writeConfigFile(this.config);
  }

  update(patch: Partial<AppConfig>) {
    this.save({ ...this.config, ...patch });
  }

  clearAuth() {
    this.update({ token: undefined, user: undefined });
  }
}
