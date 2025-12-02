import { Module, DynamicModule, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppStoreConnectAuthService, AppStoreConnectConfig } from './auth/app-store-connect-auth.service';
import { AppStoreConnectApiService } from './services/app-store-connect-api.service';
import { IpaUploaderService } from './services/ipa-uploader.service';

@Global()
@Module({})
export class IpaUploaderModule {
  static forRoot(config: AppStoreConnectConfig): DynamicModule {
    return {
      module: IpaUploaderModule,
      imports: [HttpModule],
      providers: [
        {
          provide: 'APP_STORE_CONNECT_CONFIG',
          useValue: config,
        },
        {
          provide: AppStoreConnectAuthService,
          useFactory: (cfg: AppStoreConnectConfig) => {
            return new AppStoreConnectAuthService(cfg);
          },
          inject: ['APP_STORE_CONNECT_CONFIG'],
        },
        AppStoreConnectApiService,
        IpaUploaderService,
      ],
      exports: [
        AppStoreConnectAuthService,
        AppStoreConnectApiService,
        IpaUploaderService,
      ],
    };
  }
}