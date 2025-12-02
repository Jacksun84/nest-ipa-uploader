import { NestFactory } from '@nestjs/core';
import { IpaUploaderModule } from './ipa-uploader.module';

async function bootstrap() {
  const app = await NestFactory.create(
    IpaUploaderModule.forRoot({
      issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID || '',
      keyId: process.env.APP_STORE_CONNECT_KEY_ID || '',
      privateKeyPath: process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH || '',
    })
  );
  
  console.log('IPA Uploader Module initialized');
  console.log('This is a library/CLI tool. Use the CLI commands or import as a module.');
  
  await app.close();
}

bootstrap();