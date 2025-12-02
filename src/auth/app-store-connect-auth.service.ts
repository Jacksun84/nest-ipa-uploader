import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs-extra';

export interface AppStoreConnectConfig {
  issuerId: string;
  keyId: string;
  privateKeyPath: string;
}

@Injectable()
export class AppStoreConnectAuthService {
  private readonly logger = new Logger(AppStoreConnectAuthService.name);
  private privateKey: string;

  constructor(private readonly config: AppStoreConnectConfig) {}

  async initialize(): Promise<void> {
    try {
      this.privateKey = await fs.readFile(this.config.privateKeyPath, 'utf8');
      this.logger.log('Private key loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load private key', error);
      throw new Error(`Cannot load private key from ${this.config.privateKeyPath}`);
    }
  }

  generateToken(): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: this.config.issuerId,
      iat: now,
      exp: now + (20 * 60),
      aud: 'appstoreconnect-v1',
    };

    const header = {
      alg: 'ES256',
      kid: this.config.keyId,
      typ: 'JWT',
    };

    return jwt.sign(payload, this.privateKey, { 
      algorithm: 'ES256',
      header 
    });
  }

  getAuthHeader(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.generateToken()}`,
      'Content-Type': 'application/json',
    };
  }
}