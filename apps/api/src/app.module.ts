import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AskModule } from './ask/ask.module';
import { SapModule } from './sap/sap.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    SapModule,
    AskModule,
  ],
})
export class AppModule {}
