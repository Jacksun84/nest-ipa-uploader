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