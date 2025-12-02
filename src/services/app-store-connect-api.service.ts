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

@Injectable()
export class AppStoreConnectApiService {
  private readonly logger = new Logger(AppStoreConnectApiService.name);
  private readonly baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  constructor(
    private readonly authService: AppStoreConnectAuthService,
    private readonly httpService: HttpService,
  ) {}

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
}