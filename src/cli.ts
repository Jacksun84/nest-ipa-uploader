#!/usr/bin/env node
import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import chalk from 'chalk';
import ora from 'ora';
import * as dotenv from 'dotenv';
import { IpaUploaderModule } from './ipa-uploader.module';
import { IpaUploaderService, BuildType } from './services/ipa-uploader.service';
import { AppStoreConnectApiService } from './services/app-store-connect-api.service';
import { AppStoreConnectAuthService } from './auth/app-store-connect-auth.service';

dotenv.config();

const program = new Command();

program
  .name('ipa-upload')
  .description('CLI tool for uploading IPA files to Apple App Store Connect')
  .version('1.0.0');

program
  .command('upload')
  .description('Upload an IPA file to App Store Connect')
  .requiredOption('-f, --file <path>', 'Path to IPA file')
  .requiredOption('-b, --bundle-id <id>', 'App bundle ID')
  .requiredOption('-t, --type <type>', 'Build type: testflight or production')
  .option('-g, --beta-group <id>', 'Beta group ID for TestFlight')
  .option('--skip-wait', 'Skip waiting for build processing')
  .action(async (options) => {
    const spinner = ora('Initializing...').start();

    try {
      const config = {
        issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID,
        keyId: process.env.APP_STORE_CONNECT_KEY_ID,
        privateKeyPath: process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH,
      };

      if (!config.issuerId || !config.keyId || !config.privateKeyPath) {
        spinner.fail('Missing App Store Connect credentials');
        console.error(chalk.red('\nPlease set the following environment variables:'));
        console.error('  • APP_STORE_CONNECT_ISSUER_ID');
        console.error('  • APP_STORE_CONNECT_KEY_ID');
        console.error('  • APP_STORE_CONNECT_PRIVATE_KEY_PATH');
        console.error(chalk.gray('\nNote: Apple ID credentials are no longer required for cross-platform upload!'));
        process.exit(1);
      }

      const app = await NestFactory.createApplicationContext(
        IpaUploaderModule.forRoot(config),
        { logger: false }
      );

      const authService = app.get(AppStoreConnectAuthService);
      await authService.initialize();

      const uploaderService = app.get(IpaUploaderService);

      spinner.text = 'Starting upload...';

      const buildType = options.type.toLowerCase();
      if (buildType !== 'testflight' && buildType !== 'production') {
        spinner.fail('Invalid build type');
        console.error(chalk.red('\nBuild type must be either "testflight" or "production"'));
        process.exit(1);
      }

      const result = await uploaderService.uploadIpa({
        ipaPath: options.file,
        bundleId: options.bundleId,
        buildType: buildType as BuildType,
        betaGroupId: options.betaGroup,
        skipWaitingForBuild: options.skipWait,
      });

      if (result.success) {
        spinner.succeed(chalk.green('Upload completed successfully!'));
        console.log('');
        if (result.buildId) {
          console.log(chalk.cyan('  Build ID:'), result.buildId);
          console.log(chalk.cyan('  Version:'), result.version);
          console.log(chalk.cyan('  Processing State:'), result.processingState);
        }
        console.log(chalk.cyan('  Message:'), result.message);
      } else {
        spinner.fail(chalk.red('Upload failed'));
        console.error(chalk.red('\nError:'), result.message);
        process.exit(1);
      }

      await app.close();
    } catch (error) {
      spinner.fail(chalk.red('Upload failed'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list-apps')
  .description('List all apps in App Store Connect')
  .action(async () => {
    const spinner = ora('Fetching apps...').start();

    try {
      const config = {
        issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID,
        keyId: process.env.APP_STORE_CONNECT_KEY_ID,
        privateKeyPath: process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH,
      };

      if (!config.issuerId || !config.keyId || !config.privateKeyPath) {
        spinner.fail('Missing credentials');
        process.exit(1);
      }

      const app = await NestFactory.createApplicationContext(
        IpaUploaderModule.forRoot(config),
        { logger: false }
      );

      const authService = app.get(AppStoreConnectAuthService);
      await authService.initialize();

      spinner.succeed(chalk.gray(`Generated Token: ${authService.generateToken()}\n`));

      const apiService = app.get(AppStoreConnectApiService);
      const apps = await apiService.getApps();

      spinner.succeed(chalk.green(`Found ${apps.length} apps`));

      console.log('\n');
      apps.forEach((appItem, index) => {
        console.log(chalk.bold(`${index + 1}. ${appItem.attributes.name}`));
        console.log(chalk.gray('   Bundle ID:'), appItem.attributes.bundleId);
        console.log(chalk.gray('   App ID:'), appItem.id);
        console.log('');
      });

      await app.close();
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch apps'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list-builds')
  .description('List builds for an app')
  .requiredOption('-b, --bundle-id <id>', 'App bundle ID')
  .option('-v, --version <version>', 'Filter by version')
  .action(async (options) => {
    const spinner = ora('Fetching builds...').start();

    try {
      const config = {
        issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID,
        keyId: process.env.APP_STORE_CONNECT_KEY_ID,
        privateKeyPath: process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH,
      };

      const app = await NestFactory.createApplicationContext(
        IpaUploaderModule.forRoot(config),
        { logger: false }
      );

      const authService = app.get(AppStoreConnectAuthService);
      await authService.initialize();

      const apiService = app.get(AppStoreConnectApiService);
      
      const appData = await apiService.getAppByBundleId(options.bundleId);
      if (!appData) {
        spinner.fail(chalk.red(`App with bundle ID ${options.bundleId} not found`));
        process.exit(1);
      }

      const builds = await apiService.getBuilds(appData.id, options.version);

      spinner.succeed(chalk.green(`Found ${builds.length} builds for ${appData.attributes.name}`));

      console.log('\n');
      builds.forEach((build, index) => {
        console.log(chalk.bold(`${index + 1}. Version ${build.attributes.version}`));
        console.log(chalk.gray('   Upload Date:'), new Date(build.attributes.uploadedDate).toLocaleString());
        console.log(chalk.gray('   Processing State:'), build.attributes.processingState);
        console.log(chalk.gray('   Build ID:'), build.id);
        console.log('');
      });

      await app.close();
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch builds'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list-build-details')
  .description('List build details for an app')
  .requiredOption('-b, --bundle-id <id>', 'App bundle ID')
  .requiredOption('-bvi, --build-version-id <id>', 'Build version ID')
  .option('-v, --version <version>', 'Filter by version')
  .action(async (options) => {
    const spinner = ora('Fetching build details...').start();

    try {
      const config = {
        issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID,
        keyId: process.env.APP_STORE_CONNECT_KEY_ID,
        privateKeyPath: process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH,
      };

      const app = await NestFactory.createApplicationContext(
        IpaUploaderModule.forRoot(config),
        { logger: false }
      );

      const authService = app.get(AppStoreConnectAuthService);
      await authService.initialize();

      const apiService = app.get(AppStoreConnectApiService);
      
      const appData = await apiService.getAppByBundleId(options.bundleId);
      if (!appData) {
        spinner.fail(chalk.red(`App with bundle ID ${options.bundleId} not found`));
        process.exit(1);
      }

      const buildDetais = await apiService.getBuildDetails(options.buildVersionId);

      spinner.succeed(chalk.green(`Found attributes for build ${appData.attributes.name}`));

      console.log('\n');
      console.log(chalk.bold(`   Version ${buildDetais.attributes.version}`));
      console.log(chalk.gray('   Processing State:'), buildDetais.attributes.processingState);
      console.log(chalk.gray('   Upload Date:'), new Date(buildDetais.attributes.uploadedDate).toLocaleString());
      console.log(chalk.gray('   Build Id: '), buildDetais.id);
      console.log('');

      await app.close();
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch build details'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze IPA build type (App Store, Ad-Hoc, Enterprise, Development)')
  .requiredOption('-f, --file <path>', 'Path to IPA file')
  .action(async (options) => {
    const spinner = ora('Analyzing IPA...').start();

    try {
      // No need for API credentials to analyze IPA
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(options.file);
      const entries = zip.getEntries();

      // Find embedded.mobileprovision
      const provisionEntry = entries.find((entry: any) =>
        entry.entryName.match(/Payload\/[^\/]+\.app\/embedded\.mobileprovision$/)
      );

      if (!provisionEntry) {
        spinner.fail(chalk.red('No provisioning profile found in IPA'));
        console.error(chalk.yellow('\nThis may not be a valid IPA file.'));
        process.exit(1);
      }

      const provisionContent = provisionEntry.getData().toString('utf8');

      // Parse provisioning profile - all helper functions inline
      const getProvisionedDevices = (): string[] => {
        const devicesMatch = provisionContent.match(
          /<key>ProvisionedDevices<\/key>\s*<array>([\s\S]*?)<\/array>/
        );
        if (!devicesMatch) return [];

        const devices = devicesMatch[1].match(/<string>([^<]+)<\/string>/g) || [];
        return devices.map(d => d.replace(/<\/?string>/g, ''));
      };

      const getExpirationDate = (): Date | undefined => {
        const expMatch = provisionContent.match(
          /<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/
        );
        return expMatch ? new Date(expMatch[1]) : undefined;
      };

      const getTeamId = (): string | undefined => {
        const teamMatch = provisionContent.match(
          /<key>TeamIdentifier<\/key>\s*<array>\s*<string>([^<]+)<\/string>/
        );
        return teamMatch ? teamMatch[1] : undefined;
      };

      const getTeamName = (): string | undefined => {
        const teamNameMatch = provisionContent.match(
          /<key>TeamName<\/key>\s*<string>([^<]+)<\/string>/
        );
        return teamNameMatch ? teamNameMatch[1] : undefined;
      };

      const getProfileName = (): string | undefined => {
        const nameMatch = provisionContent.match(
          /<key>Name<\/key>\s*<string>([^<]+)<\/string>/
        );
        return nameMatch ? nameMatch[1] : undefined;
      };

      const getBundleId = (): string | undefined => {
        const bundleMatch = provisionContent.match(
          /<key>application-identifier<\/key>\s*<string>([^<]+)<\/string>/
        );
        return bundleMatch ? bundleMatch[1] : undefined;
      };

      const determineBuildType = (): 'adhoc' | 'enterprise' | 'development' | 'appstore' => {
        // Check for get-task-allow (development)
        if (provisionContent.includes('<key>get-task-allow</key>')) {
          return 'development';
        }

        // Check for provisioned devices (ad-hoc)
        const devices = getProvisionedDevices();
        if (devices.length > 0) {
          return 'adhoc';
        }

        // Check for enterprise (ProvisionsAllDevices)
        if (provisionContent.includes('<key>ProvisionsAllDevices</key>')) {
          return 'enterprise';
        }

        return 'appstore';
      };

      // Extract all information
      const buildType = determineBuildType();
      const devices = getProvisionedDevices();
      const expirationDate = getExpirationDate();
      const teamId = getTeamId();
      const teamName = getTeamName();
      const profileName = getProfileName();
      const bundleID = getBundleId();

      spinner.succeed(chalk.green('IPA analyzed successfully'));

      // Display results
      console.log('\n');
      console.log(chalk.bold('Build Information:'));
      console.log(chalk.cyan('  Build ID:'), bundleID);
      console.log(chalk.cyan('  Build Type:'), buildType.toUpperCase());
      console.log(chalk.cyan('  Authorized Devices:'), devices.length);
      
      if (expirationDate) {
        const daysUntilExpiry = Math.ceil(
          (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        console.log(chalk.cyan('  Expiration:'), expirationDate.toLocaleDateString());
        
        if (daysUntilExpiry < 0) {
          console.log(chalk.cyan('  Days Remaining:'), chalk.red(`EXPIRED ${Math.abs(daysUntilExpiry)} days ago`));
        } else if (daysUntilExpiry < 30) {
          console.log(chalk.cyan('  Days Remaining:'), chalk.yellow(daysUntilExpiry));
        } else {
          console.log(chalk.cyan('  Days Remaining:'), daysUntilExpiry);
        }
      }
      
      if (teamId) {
        console.log(chalk.cyan('  Team ID:'), teamId);
      }

      if(teamName){
        console.log(chalk.cyan('  Team Name:'), teamName);
      }

      if (profileName) {
        console.log(chalk.cyan('  Profile Name:'), profileName);
      }
      
      console.log('');

      // Provide recommendations based on build type
      if (buildType === 'appstore') {
        console.log(chalk.green('✓ This is an App Store build - use the "upload" command'));
        console.log(chalk.gray('  Command: npm run cli -- upload --file <ipa> --bundle-id <id> --type testflight'));
      } else if (buildType === 'adhoc') {
        console.log(chalk.yellow('⚠ This is an Ad-Hoc build'));
        console.log(chalk.gray('  You can still upload it to TestFlight using the "upload" command'));
        console.log(chalk.gray('  Command: npm run cli -- upload --file <ipa> --bundle-id <id> --type testflight'));
      } else if (buildType === 'enterprise') {
        console.log(chalk.yellow('⚠ This is an Enterprise build'));
        console.log(chalk.gray('  Enterprise builds are typically distributed internally'));
      } else {
        console.log(chalk.yellow('⚠ This is a Development build'));
        console.log(chalk.gray('  Development builds are for testing during development only'));
      }

      // Show device UDIDs if not too many
      if (devices.length > 0 && devices.length <= 10) {
        console.log('\n' + chalk.gray('Authorized Device UDIDs:'));
        devices.forEach((udid, i) => {
          console.log(chalk.gray(`  ${i + 1}. ${udid}`));
        });
      } else if (devices.length > 10) {
        console.log('\n' + chalk.gray(`Authorized Devices: ${devices.length} (too many to display)`));
      }

      console.log('');
    } catch (error) {
      spinner.fail(chalk.red('Failed to analyze IPA'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

program
  .command('create-distribution')
  .description('Create ad-hoc distribution package with OTA installation')
  .requiredOption('-f, --file <path>', 'Path to ad-hoc IPA file')
  .requiredOption('-o, --output <dir>', 'Output directory for distribution files')
  .requiredOption('-u, --base-url <url>', 'Base URL where files will be hosted (e.g., https://example.com/downloads)')
  .action(async (options) => {
    const spinner = ora('Creating distribution package...').start();

    try {
      const { AdHocDistributionService } = require('./services/adhoc-distribution.service');
      const adhocService = new AdHocDistributionService();
      
      const result = await adhocService.createDistributionPackage(
        options.file,
        options.output,
        options.baseUrl,
      );

      spinner.succeed(chalk.green('Distribution package created successfully!'));

      console.log('\n' + chalk.bold('Distribution Files:'));
      console.log(chalk.cyan('  IPA:'), result.ipaPath);
      console.log(chalk.cyan('  Manifest:'), result.manifestPath);
      console.log(chalk.cyan('  Install Page:'), result.htmlPath);
      console.log('');
      
      console.log(chalk.bold('Next Steps:'));
      console.log(chalk.gray('  1. Upload all files to your web server'));
      console.log(chalk.gray(`  2. Share this URL: ${options.baseUrl}/index.html`));
      console.log(chalk.gray('  3. Users open the link in Safari on their iOS device'));
      console.log(chalk.gray('  4. Tap "Install App" to install via OTA'));
      console.log('');
      
      console.log(chalk.yellow('⚠ Important:'));
      console.log(chalk.gray('  • Server must use HTTPS'));
      console.log(chalk.gray('  • Device UDID must be in provisioning profile'));
      console.log(chalk.gray('  • Installation only works in Safari browser'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to create distribution package'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

  /*
program
  .command('metadata')
  .description('Extract metadata from IPA file')
  .requiredOption('-f, --file <path>', 'Path to IPA file')
  .action(async (options) => {
    const spinner = ora('Reading IPA metadata...').start();

    try {
      const config = {
        issuerId: 'dummy',
        keyId: 'dummy',
        privateKeyPath: '/tmp/dummy',
      };

      const app = await NestFactory.createApplicationContext(
        IpaUploaderModule.forRoot(config),
        { logger: false }
      );

      const uploaderService = app.get(IpaUploaderService);
      const metadata = await uploaderService.getIpaMetadata(options.file);

      spinner.succeed(chalk.green('Metadata extracted successfully'));

      console.log('\n');
      console.log(chalk.cyan('  Bundle ID:'), metadata.bundleId);
      console.log(chalk.cyan('  Version:'), metadata.version);
      console.log(chalk.cyan('  Build Number:'), metadata.buildNumber);
      console.log(chalk.cyan('  Display Name:'), metadata.displayName);
      console.log('');

      await app.close();
    } catch (error) {
      spinner.fail(chalk.red('Failed to read metadata'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

  */

  program
  .command('metadata')
  .description('Analyze IPA build type (App Store, Ad-Hoc, Enterprise, Development)')
  .requiredOption('-f, --file <path>', 'Path to IPA file')
  .action(async (options) => {
    const spinner = ora('Analyzing IPA...').start();

    try {
      // No need for API credentials to analyze IPA
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(options.file);
      const entries = zip.getEntries();

      // Find embedded.mobileprovision
      const provisionEntry = entries.find((entry: any) =>
        entry.entryName.match(/Payload\/[^\/]+\.app\/embedded\.mobileprovision$/)
      );

      if (!provisionEntry) {
        spinner.fail(chalk.red('No provisioning profile found in IPA'));
        console.error(chalk.yellow('\nThis may not be a valid IPA file.'));
        process.exit(1);
      }

      const provisionContent = provisionEntry.getData().toString('utf8');

      // Parse provisioning profile - all helper functions inline
      const getProvisionedDevices = (): string[] => {
        const devicesMatch = provisionContent.match(
          /<key>ProvisionedDevices<\/key>\s*<array>([\s\S]*?)<\/array>/
        );
        if (!devicesMatch) return [];

        const devices = devicesMatch[1].match(/<string>([^<]+)<\/string>/g) || [];
        return devices.map(d => d.replace(/<\/?string>/g, ''));
      };

      const getExpirationDate = (): Date | undefined => {
        const expMatch = provisionContent.match(
          /<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/
        );
        return expMatch ? new Date(expMatch[1]) : undefined;
      };

      const getTeamId = (): string | undefined => {
        const teamMatch = provisionContent.match(
          /<key>TeamIdentifier<\/key>\s*<array>\s*<string>([^<]+)<\/string>/
        );
        return teamMatch ? teamMatch[1] : undefined;
      };

      const getProfileName = (): string | undefined => {
        const nameMatch = provisionContent.match(
          /<key>Name<\/key>\s*<string>([^<]+)<\/string>/
        );
        return nameMatch ? nameMatch[1] : undefined;
      };

      const determineBuildType = (): 'adhoc' | 'enterprise' | 'development' | 'appstore' => {
        // Check for get-task-allow (development)
        if (provisionContent.includes('<key>get-task-allow</key>')) {
          return 'development';
        }

        // Check for provisioned devices (ad-hoc)
        const devices = getProvisionedDevices();
        if (devices.length > 0) {
          return 'adhoc';
        }

        // Check for enterprise (ProvisionsAllDevices)
        if (provisionContent.includes('<key>ProvisionsAllDevices</key>')) {
          return 'enterprise';
        }

        return 'appstore';
      };

      // Extract all information
      const buildType = determineBuildType();
      const devices = getProvisionedDevices();
      const expirationDate = getExpirationDate();
      const teamId = getTeamId();
      const profileName = getProfileName();

      spinner.succeed(chalk.green('IPA analyzed successfully'));

      // Display results
      console.log('\n');
      console.log(chalk.bold('Build Information:'));
      console.log(chalk.cyan('  Build Type:'), buildType.toUpperCase());
      console.log(chalk.cyan('  Authorized Devices:'), devices.length);
      
      if (expirationDate) {
        const daysUntilExpiry = Math.ceil(
          (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        console.log(chalk.cyan('  Expiration:'), expirationDate.toLocaleDateString());
        
        if (daysUntilExpiry < 0) {
          console.log(chalk.cyan('  Days Remaining:'), chalk.red(`EXPIRED ${Math.abs(daysUntilExpiry)} days ago`));
        } else if (daysUntilExpiry < 30) {
          console.log(chalk.cyan('  Days Remaining:'), chalk.yellow(daysUntilExpiry));
        } else {
          console.log(chalk.cyan('  Days Remaining:'), daysUntilExpiry);
        }
      }
      
      if (teamId) {
        console.log(chalk.cyan('  Team ID:'), teamId);
      }
      
      if (profileName) {
        console.log(chalk.cyan('  Profile Name:'), profileName);
      }
      
      console.log('');

      // Provide recommendations based on build type
      if (buildType === 'appstore') {
        console.log(chalk.green('✓ This is an App Store build - use the "upload" command'));
        console.log(chalk.gray('  Command: npm run cli -- upload --file <ipa> --bundle-id <id> --type testflight'));
      } else if (buildType === 'adhoc') {
        console.log(chalk.yellow('⚠ This is an Ad-Hoc build'));
        console.log(chalk.gray('  You can still upload it to TestFlight using the "upload" command'));
        console.log(chalk.gray('  Command: npm run cli -- upload --file <ipa> --bundle-id <id> --type testflight'));
      } else if (buildType === 'enterprise') {
        console.log(chalk.yellow('⚠ This is an Enterprise build'));
        console.log(chalk.gray('  Enterprise builds are typically distributed internally'));
      } else {
        console.log(chalk.yellow('⚠ This is a Development build'));
        console.log(chalk.gray('  Development builds are for testing during development only'));
      }

      // Show device UDIDs if not too many
      if (devices.length > 0 && devices.length <= 10) {
        console.log('\n' + chalk.gray('Authorized Device UDIDs:'));
        devices.forEach((udid, i) => {
          console.log(chalk.gray(`  ${i + 1}. ${udid}`));
        });
      } else if (devices.length > 10) {
        console.log('\n' + chalk.gray(`Authorized Devices: ${devices.length} (too many to display)`));
      }

      console.log('');
    } catch (error) {
      spinner.fail(chalk.red('Failed to analyze IPA'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list-beta-groups')
  .description('List TestFlight beta groups for an app')
  .requiredOption('-b, --bundle-id <id>', 'App bundle ID')
  .action(async (options) => {
    const spinner = ora('Fetching beta groups...').start();

    try {
      const config = {
        issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID,
        keyId: process.env.APP_STORE_CONNECT_KEY_ID,
        privateKeyPath: process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH,
      };

      const app = await NestFactory.createApplicationContext(
        IpaUploaderModule.forRoot(config),
        { logger: false }
      );

      const authService = app.get(AppStoreConnectAuthService);
      await authService.initialize();

      const apiService = app.get(AppStoreConnectApiService);
      
      const appData = await apiService.getAppByBundleId(options.bundleId);
      if (!appData) {
        spinner.fail(chalk.red(`App with bundle ID ${options.bundleId} not found`));
        process.exit(1);
      }

      const betaGroups = await apiService.getBetaGroups(appData.id);

      spinner.succeed(chalk.green(`Found ${betaGroups.length} beta groups`));

      console.log('\n');
      betaGroups.forEach((group, index) => {
        console.log(chalk.bold(`${index + 1}. ${group.attributes.name}`));
        console.log(chalk.gray('   Group ID:'), group.id);
        console.log(chalk.gray('   Public Link:'), group.attributes.publicLinkEnabled ? 'Yes' : 'No');
        console.log('');
      });

      await app.close();
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch beta groups'));
      console.error(chalk.red('\nError:'), error.message);
      process.exit(1);
    }
  });

if (process.argv.length < 3) {
  program.help();
}

program.parse(process.argv);