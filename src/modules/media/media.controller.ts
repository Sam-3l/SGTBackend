import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { BunnyService } from './bunny.service';
import { Role } from 'src/common/decorators/role.decorator';
import { IRole } from '../admin/interfaces/admin.interface';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const FILE_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MAX_BYTES = 1024 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(private readonly bunnyService: BunnyService) {}

  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES, IRole.MANAGE_CONTENT)
  @Post('image')
  @ResponseMessage('image uploaded successfully')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: IMAGE_MAX_BYTES } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('file must be an image');

    const key = `images/${randomUUID()}${extname(file.originalname)}`;
    const url = await this.bunnyService.uploadToStorage(key, file.buffer, file.mimetype);

    return { url, publicId: key };
  }

  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES, IRole.MANAGE_CONTENT)
  @Post('file')
  @ResponseMessage('file uploaded successfully')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: FILE_MAX_BYTES } }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');

    const format = extname(file.originalname).replace('.', '');
    const key = `files/${randomUUID()}${extname(file.originalname)}`;
    const url = await this.bunnyService.uploadToStorage(key, file.buffer, file.mimetype);

    return { url, publicId: key, format, resourceType: 'file' };
  }

  // Bunny Stream needs a video object created first (returns a GUID), then
  // the binary uploaded to that GUID - two calls where Cloudinary was one.
  // Duration is deliberately NOT returned here: Bunny only knows it once
  // encoding finishes, which doesn't happen inline with the upload request.
  // The frontend must keep supplying its own client-side-read duration for
  // the section/chapter payload, same as it does today.
  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES, IRole.MANAGE_CONTENT)
  @Post('video')
  @ResponseMessage('video uploaded successfully')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: VIDEO_MAX_BYTES } }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File, @Body('title') title?: string) {
    if (!file) throw new BadRequestException('file is required');
    if (!file.mimetype.startsWith('video/')) throw new BadRequestException('file must be a video');

    const videoId = await this.bunnyService.createStreamVideo(title || file.originalname);
    await this.bunnyService.uploadStreamVideo(videoId, file.buffer);
    const url = this.bunnyService.buildStreamEmbedUrl(videoId);

    return { url, publicId: videoId, resourceType: 'video', format: 'iframe' };
  }
}
