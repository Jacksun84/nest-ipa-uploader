import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppStoreConnectAuthService } from '../auth/app-store-connect-auth.service';

export interface App {
  id: string;
  attributes: {
    bundleId: string;
    name: string;
  };
}

export interface Build {
  id: string;
  type: string;
  attributes: {
    version: string;
    uploadedDate: string;
    processingState: string;
  };
}

export interface BuildUpload {
  id: string;
  type: string;
  attributes: {
    fileName: string;
    fileSize: number;
    uploadedDate?: string;
    uploadStatus?: string;
  };
}
export interface BuildUploadRelationship {
  id: string;
  type: string;
}

export interface PreReleaseVersion {
  id: string;
  attributes: {
    version: string;
    platform: string;
  };
}

@Injectable()
export class AppStoreConnectApiService {
  private readonly logger = new Logger(AppStoreConnectApiService.name);
  private readonly baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  constructor(
    private readonly authService: AppStoreConnectAuthService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Get all apps for the account
   */
  async getApps(): Promise<App[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/apps`, {
          headers: this.authService.getAuthHeader(),
        })
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch apps', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get app by bundle ID
   */
  async getAppByBundleId(bundleId: string): Promise<App | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/apps`, {
          headers: this.authService.getAuthHeader(),
          params: {
            'filter[bundleId]': bundleId,
          },
        })
      );
      
      const apps = response.data.data;
      return apps.length > 0 ? apps[0] : null;
    } catch (error) {
      this.logger.error('Failed to fetch app by bundle ID', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get builds for an app
   */
  async getBuilds(appId: string, version?: string): Promise<Build[]> {
    try {
      const params: any = {};
      if (version) {
        params['filter[version]'] = version;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/apps/${appId}/builds`, {
          headers: this.authService.getAuthHeader(),
          params,
        })
      );
      
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch builds', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get pre-release versions for an app
   */
  async getPreReleaseVersions(appId: string): Promise<PreReleaseVersion[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/apps/${appId}/preReleaseVersions`, {
          headers: this.authService.getAuthHeader(),
        })
      );
      
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch pre-release versions', error.response?.data || error.message);
      throw error;
    }
  }  

  /**
   * Get build details
   */ 
  async getBuildDetails(buildId: string): Promise<Build> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/builds/${buildId}`, {
          headers: this.authService.getAuthHeader(),
        })
      );
      
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch build details', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Add build to TestFlight beta group
   */
  async addBuildToBetaGroup(buildId: string, betaGroupId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/betaGroups/${betaGroupId}/relationships/builds`,
          {
            data: [
              {
                type: 'builds',
                id: buildId,
              },
            ],
          },
          {
            headers: this.authService.getAuthHeader(),
          }
        )
      );
      
      this.logger.log(`Build ${buildId} added to beta group ${betaGroupId}`);
    } catch (error) {
      this.logger.error('Failed to add build to beta group', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get beta groups for an app
   */  
  async getBetaGroups(appId: string): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/apps/${appId}/betaGroups`, {
          headers: this.authService.getAuthHeader(),
        })
      );
      
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch beta groups', error.response?.data || error.message);
      throw error;
    }
  }
}