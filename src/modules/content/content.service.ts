import { Injectable } from '@nestjs/common';
import { CreateContentDto, GetContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { Transaction } from 'sequelize';
import { ContentRepository } from './repositories/content.repository';
import * as helpers from 'src/common/utils/helper';
import { BunnyService } from '../media/bunny.service';

@Injectable()
export class ContentService {

  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly bunnyService: BunnyService
  ){}

  async create(data: CreateContentDto, transaction: Transaction) {

     await this.contentRepository.create({...data}, transaction);
  
    }

 async findContentById(id: string) {
    return await this.contentRepository.findOne({id});
  }

  async findAll(data: GetContentDto ) {

    const {page, limit, searchValue, ...rest} = data;

    let searchConditions = {};

    if (searchValue) searchConditions = helpers.getSearchConditions(searchValue, ['title', 'slug']);


    return await this.contentRepository.findAllPaginated({ ...rest, ...searchConditions }, { order: [['createdAt', 'DESC']] }, { page, limit });

  }

  async removeContent(id: string, transaction: Transaction){

     const content = await this.contentRepository.findOne({id});

     await this.contentRepository.delete({id}, transaction);

     if (content) {
       await this.bunnyService.deleteAssetByUrl(content.image);
     }

  }


}
