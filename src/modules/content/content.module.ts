import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ContentModel } from './models/content.model';
import { SequelizeModule } from '@nestjs/sequelize';
import {  ContentRepository } from './repositories/content.repository';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [SequelizeModule.forFeature([ContentModel]), MediaModule],
  controllers: [ContentController],
  providers: [ContentService, ContentRepository],
})
export class ContentModule {}
