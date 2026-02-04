const requiredEnvVars = [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
] as const;

const optionalEnvVars = {
  PORT: { default: '3000' },
  NODE_ENV: { default: 'development' },
  DB_PORT: { default: '5432' },
  MINIO_PORT: { default: '9000' },
  MINIO_USE_SSL: { default: 'false' },
  MINIO_BUCKET_NAME: { default: 'fileuploads' },
} as const;

export interface AppConfig {
  port: number;
  nodeEnv: string;
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  jwt: {
    secret: string;
  };
  minio: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucketName: string;
  };
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return undefined as unknown as string;
  }
  return value;
}

function getEnvWithDefault(key: string, defaultValue: string): string {
  return getEnv(key) ?? defaultValue;
}

export function validateEnv(): void {
  const missing = requiredEnvVars.filter((key) => !getEnv(key));
  if (missing.length > 0) {
    throw new Error(`Missing env: ${missing.join(', ')}`);
  }
}

export function getConfig(): AppConfig {
  return {
    port: parseInt(getEnvWithDefault('PORT', optionalEnvVars.PORT.default), 10),
    nodeEnv: getEnvWithDefault('NODE_ENV', optionalEnvVars.NODE_ENV.default),
    db: {
      host: getEnv('DB_HOST')!,
      port: parseInt(
        getEnvWithDefault('DB_PORT', optionalEnvVars.DB_PORT.default),
        10,
      ),
      username: getEnv('DB_USERNAME')!,
      password: getEnv('DB_PASSWORD')!,
      database: getEnv('DB_NAME')!,
    },
    jwt: {
      secret: getEnv('JWT_SECRET')!,
    },
    minio: {
      endPoint: getEnv('MINIO_ENDPOINT')!,
      port: parseInt(
        getEnvWithDefault('MINIO_PORT', optionalEnvVars.MINIO_PORT.default),
        10,
      ),
      useSSL: getEnvWithDefault('MINIO_USE_SSL', optionalEnvVars.MINIO_USE_SSL.default) === 'true',
      accessKey: getEnv('MINIO_ACCESS_KEY')!,
      secretKey: getEnv('MINIO_SECRET_KEY')!,
      bucketName: getEnvWithDefault(
        'MINIO_BUCKET_NAME',
        optionalEnvVars.MINIO_BUCKET_NAME.default,
      ),
    },
  };
}
