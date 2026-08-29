import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SapModule } from './sap/sap.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    SapModule,
  ],
})
export class AppModule {}
