import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { BunnyService } from './bunny.service';

@Module({
  controllers: [MediaController],
  providers: [BunnyService],
  exports: [BunnyService],
})
export class MediaModule {}
