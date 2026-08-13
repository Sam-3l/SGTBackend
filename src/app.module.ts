import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigsModule } from './common/configs/configs.module';
import { appProvider } from './common/app.provider';
import { DatabaseModule } from './shared/database/database.module';
import { JwtModule } from '@nestjs/jwt';
import { CacheStoreModule } from './shared/cache-store/cache-store.module';
import { AdminModule } from './modules/admin/admin.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './shared/notification/email/email.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ContentModule } from './modules/content/content.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [ConfigsModule, DatabaseModule, EmailModule, JwtModule, CacheStoreModule, AdminModule, UsersModule, AuthModule, CoursesModule, ContentModule, PaymentModule, MediaModule],
  controllers: [AppController],
  providers: [AppService, ...appProvider],
})
export class AppModule {}
