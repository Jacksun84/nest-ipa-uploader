// src/services/ipa-uploader.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import { AppStoreConnectApiService } from './app-store-connect-api.service';
import { AppStoreConnectAuthService } from '../auth/app-store-connect-auth.service';

const execAsync = promisify(exec);

export enum BuildType {
  TESTFLIGHT = 'testflight',
  PRODUCTION = 'production',
}

export interface UploadOptions {
  ipaPath: string;
  bundleId: string;
  buildType: BuildType;
  betaGroupId?: string;
  skipWaitingForBuild?: boolean;
}

export interface UploadResult {
  success: boolean;
  buildId?: string;
  version?: string;
  message: string;
  processingState?: string;
}

interface BuildUploadSession {
  id: string;
  type: string;
  attributes: {
    uploadOperations: Array<{
      method: string;
      url: string;
      length: number;
      offset: number;
      requestHeaders: Array<{
        name: string;
        value: string;
      }>;
    }>;
  };
}

@Injectable()
export class IpaUploaderService {
  private readonly logger = new Logger(IpaUploaderService.name);
  private readonly baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  constructor(
    private readonly apiService: AppStoreConnectApiService,
    private readonly authService: AppStoreConnectAuthService,
  ) {}

  async uploadIpa(options: UploadOptions): Promise<UploadResult> {
    try {
      if (!await fs.pathExists(options.ipaPath)) {
        throw new Error(`IPA file not found: ${options.ipaPath}`);
      }

      this.logger.log(`Starting cross-platform IPA upload for bundle: ${options.bundleId}`);
      this.logger.log(`Platform: ${process.platform}`);
      this.logger.log(`Build type: ${options.buildType}`);

      console.log(`Starting cross-platform IPA upload for bundle: ${options.bundleId}`);
      console.log(`Platform: ${process.platform}`);
      console.log(`Build type: ${options.buildType}`);

      // Get app from App Store Connect
      const app = await this.apiService.getAppByBundleId(options.bundleId);
      if (!app) {
        throw new Error(`App with bundle ID ${options.bundleId} not found in App Store Connect`);
      }

      this.logger.log(`Found app: ${app.attributes.name} (${app.id})`);

      // Extract IPA metadata
      const metadata = await this.getIpaMetadata(options.ipaPath);
      this.logger.log(`IPA Version: ${metadata.version}, Build: ${metadata.buildNumber}`);

      console.log(`Found app: ${app.attributes.name} (${app.id})`);
      console.log(`IPA Version: ${metadata.version}, Build: ${metadata.buildNumber}`);

      // Upload using App Store Connect API (cross-platform)
      await this.uploadUsingAppStoreConnectApi(options, app.id, metadata);

      if (!options.skipWaitingForBuild) {
        this.logger.log('Waiting for build to be processed...');
       
        console.log('Waiting for build to be processed...');

        const build = await this.waitForBuildProcessing(app.id, metadata.version, 60, 10000);
        
        if (build) {
          this.logger.log(`Build processed: ${build.id} (${build.attributes.version})`);

          console.log(`Build processed: ${build.id} (${build.attributes.version})`);

          if (options.buildType === BuildType.TESTFLIGHT && options.betaGroupId) {
            await this.apiService.addBuildToBetaGroup(build.id, options.betaGroupId);
          }

          return {
            success: true,
            buildId: build.id,
            version: build.attributes.version,
            processingState: build.attributes.processingState,
            message: 'IPA uploaded and processed successfully',
          };
        }
      }

      return {
        success: true,
        message: 'IPA uploaded successfully (processing status not verified)',
      };
    } catch (error) {
      this.logger.error('Failed to upload IPA', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Upload using App Store Connect API (cross-platform: Windows/Linux/macOS)
   */
  private async uploadUsingAppStoreConnectApi(
    options: UploadOptions,
    appId: string,
    metadata: any,
  ): Promise<void> {
    try {
      const fileStats = await fs.stat(options.ipaPath);
      const fileSize = fileStats.size;
      const fileName = path.basename(options.ipaPath);

      this.logger.log(`File: ${fileName}`);
      this.logger.log(`Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

      console.log(`File: ${fileName}`);
      console.log(`Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

      // Step 1: Calculate MD5 checksum
      this.logger.log('Step 1/5: Calculating file checksum...');
      const md5Checksum = await this.calculateMD5(options.ipaPath);
      this.logger.log(`MD5: ${md5Checksum}`);

      console.log(`MD5: ${md5Checksum}`);

      // Step 2: Create a Build
      this.logger.log('Step 2/5: Creating build record...');
      const buildId = await this.createBuild(
        appId,
        metadata.version,
        metadata.buildNumber,
      );

      // Step 3: Create Build Upload Session
      this.logger.log('Step 3/5: Creating upload session...');
      const uploadSession = await this.createBuildUploadSession(
        buildId,
        fileSize,
        fileName,
      );

      // Step 4: Upload file chunks to AWS
      this.logger.log('Step 4/5: Uploading file to Apple servers...');
      console.log('Step 4/5: Uploading file to Apple servers...');
      await this.uploadFileChunks(options.ipaPath, uploadSession);

      // Step 5: Commit the upload
      this.logger.log('Step 5/5: Finalizing upload...');
      console.log('Step 5/5: Finalizing upload...');
      await this.commitBuildUpload(uploadSession.id, md5Checksum);

      this.logger.log('✓ IPA uploaded successfully!');
      console.log('✓ IPA uploaded successfully!');
      
    } catch (error) {
      this.logger.error('API upload failed:', error.message);
      console.error('API upload failed:', error.message);
      if (error.response?.data) {
        this.logger.error('Response:', JSON.stringify(error.response.data, null, 2));
        console.error('Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`Failed to upload IPA: ${error.message}`);
    }
  }

  /**
   * Step 1: Calculate MD5 checksum
   */
  private async calculateMD5(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('base64')));
      stream.on('error', reject);
    });
  }

  /**
   * Step 2: Create Build in App Store Connect
   */
  private async createBuild(
    appId: string,
    version: string,
    buildNumber: string,
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/builds`,
        {
          data: {
            type: 'builds',
            attributes: {
              processingState: 'PROCESSING',
              uploadedDate: new Date().toISOString(),
              version: buildNumber,
            },
            relationships: {
              app: {
                data: {
                  type: 'apps',
                  id: appId,
                },
              },
              preReleaseVersion: {
                data: {
                  type: 'preReleaseVersions',
                  attributes: {
                    version: version,
                    platform: 'IOS',
                  },
                },
              },
            },
          },
        },
        {
          headers: this.authService.getAuthHeader(),
        }
      );

      return response.data.data.id;
    } catch (error) {
      // If build already exists, try to find it
      if (error.response?.status === 409 || error.response?.status === 400) {
        this.logger.warn('Build may already exist, attempting to find it...');
        const builds = await this.apiService.getBuilds(appId, version);
        if (builds.length > 0) {
          return builds[0].id;
        }
      }
      throw error;
    }
  }

  /**
   * Step 3: Create Build Upload Session
   */
  private async createBuildUploadSession(
    buildId: string,
    fileSize: number,
    fileName: string,
  ): Promise<BuildUploadSession> {
    const response = await axios.post(
      `${this.baseUrl}/ciMacOsVersions`,
      {
        data: {
          type: 'buildBundles',
          attributes: {
            fileName: fileName,
            fileSize: fileSize,
          },
          relationships: {
            build: {
              data: {
                type: 'builds',
                id: buildId,
              },
            },
          },
        },
      },
      {
        headers: this.authService.getAuthHeader(),
      }
    );

    return response.data.data;
  }

  /**
   * Step 4: Upload file chunks to AWS S3
   */
  private async uploadFileChunks(
    filePath: string,
    uploadSession: BuildUploadSession,
  ): Promise<void> {
    const operations = uploadSession.attributes.uploadOperations;
    const fileBuffer = await fs.readFile(filePath);

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      this.logger.log(`Uploading chunk ${i + 1}/${operations.length}...`);

      // Extract chunk from file
      const chunk = fileBuffer.slice(
        operation.offset,
        operation.offset + operation.length
      );

      // Prepare headers
      const headers: any = {};
      operation.requestHeaders.forEach(header => {
        headers[header.name] = header.value;
      });

      // Upload chunk
      await axios({
        method: operation.method.toLowerCase() as any,
        url: operation.url,
        data: chunk,
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'Content-Length': chunk.length,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      // Progress indicator
      const progress = ((i + 1) / operations.length * 100).toFixed(1);
      this.logger.log(`Progress: ${progress}%`);
    }
  }

  /**
   * Step 5: Commit the upload
   */
  private async commitBuildUpload(
    uploadSessionId: string,
    md5Checksum: string,
  ): Promise<void> {
    await axios.patch(
      `${this.baseUrl}/buildBundles/${uploadSessionId}`,
      {
        data: {
          type: 'buildBundles',
          id: uploadSessionId,
          attributes: {
            uploaded: true,
            checksum: md5Checksum,
          },
        },
      },
      {
        headers: this.authService.getAuthHeader(),
      }
    );
  }

  /**
   * Wait for build processing
   */
  private async waitForBuildProcessing(
    appId: string,
    version: string,
    maxAttempts: number = 60,
    delayMs: number = 10000,
  ): Promise<any> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.logger.log(`Checking build status (${attempt + 1}/${maxAttempts})...`);
        
        const builds = await this.apiService.getBuilds(appId);
        
        if (builds.length > 0) {
          const latestBuild = builds
            .filter(b => b.attributes.version === version)
            .sort((a, b) => 
              new Date(b.attributes.uploadedDate).getTime() - 
              new Date(a.attributes.uploadedDate).getTime()
            )[0];

          if (latestBuild) {
            const state = latestBuild.attributes.processingState;
            this.logger.log(`Build state: ${state}`);

            if (state === 'PROCESSING' || state === 'VALID') {
              return latestBuild;
            }

            if (state === 'INVALID') {
              throw new Error('Build processing failed - build is invalid');
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        this.logger.warn(`Error checking build: ${error.message}`);
      }
    }

    this.logger.warn('Build check timed out');
    return null;
  }

  /**
   * Extract IPA metadata (cross-platform)
   */
  async getIpaMetadata(ipaPath: string): Promise<any> {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(ipaPath);
      const zipEntries = zip.getEntries();

      // Find Info.plist
      const plistEntry = zipEntries.find((entry: any) => 
        entry.entryName.match(/Payload\/[^\/]+\.app\/Info\.plist$/)
      );

      if (!plistEntry) {
        throw new Error('Info.plist not found in IPA');
      }

      const plistContent = plistEntry.getData().toString('utf8');
      return this.parsePlist(plistContent);
    } catch (error) {
      this.logger.error('Failed to extract IPA metadata', error);
      throw new Error('Could not read IPA metadata. Ensure the file is a valid IPA.');
    }
  }

  /**
   * Parse plist file (XML format)
   */
  private parsePlist(plistContent: string): any {
    const parseValue = (content: string, key: string): string => {
      const regex = new RegExp(
        `<key>${key}</key>\\s*<string>([^<]+)</string>`,
        'i'
      );
      const match = content.match(regex);
      return match ? match[1] : 'unknown';
    };

    return {
      bundleId: parseValue(plistContent, 'CFBundleIdentifier'),
      version: parseValue(plistContent, 'CFBundleShortVersionString'),
      buildNumber: parseValue(plistContent, 'CFBundleVersion'),
      displayName: parseValue(plistContent, 'CFBundleDisplayName') || 
                   parseValue(plistContent, 'CFBundleName'),
    };
  }
}