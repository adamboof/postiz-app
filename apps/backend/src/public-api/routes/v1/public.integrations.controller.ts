import {
  Body, Controller, Delete, Get, HttpException, Param, Post, Query, UploadedFile, UseInterceptors
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permissions.service';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { GetPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.dto';
import { UploadUrlDto } from '@gitroom/nestjs-libraries/dtos/media/upload-url.dto';

@ApiTags('Public API')
@Controller('/public/v1')
export class PublicIntegrationsController {
  private storage = UploadFactory.createStorage();

  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _mediaService: MediaService
  ) {}

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSimple(
    @GetOrgFromRequest() org: Organization,
    @UploadedFile('file') file: Express.Multer.File
  ) {
    if (!file) {
      throw new HttpException({ msg: 'No file provided' }, 400);
    }

    const getFile = await this.storage.uploadFile(file);
    return this._mediaService.saveFile(
      org.id,
      getFile.originalname,
      getFile.path
    );
  }

  @Post('/upload-url')
  async uploadFromUrl(
    @GetOrgFromRequest() org: Organization,
    @Body() body: UploadUrlDto
  ) {
    try {
      // Download and upload the file from the provided URL
      const uploadedPath = await this.storage.uploadSimple(body.url);
      
      // Extract filename from URL or use a default name
      const urlParts = body.url.split('/');
      const fileName = urlParts[urlParts.length - 1] || 'uploaded-file';
      
      // Save the file record to the database
      return this._mediaService.saveFile(
        org.id,
        fileName,
        uploadedPath
      );
    } catch (error) {
      throw new HttpException(
        { msg: 'Failed to download or upload file from URL', error: error instanceof Error ? error.message : 'Unknown error' },
        400
      );
    }
  }

  @Get('/posts')
  async getPosts(
    @GetOrgFromRequest() org: Organization,
    @Query() query: GetPostsDto
  ) {
    const posts = await this._postsService.getPosts(org.id, query);

    return {
      posts,
      // comments,
    };
  }

  @Get('/posts/:id')
  async getPost(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._postsService.getPost(org.id, id);
  }

  @Post('/posts')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  createPost(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreatePostDto
  ) {
    console.log(JSON.stringify(body, null, 2));
    return this._postsService.createPost(org.id, body);
  }

  @Delete('/posts/:id')
  async deletePost(
    @GetOrgFromRequest() org: Organization,
    @Param() body: { id: string }
  ) {
    const getPostById = await this._postsService.getPost(org.id, body.id);
    return this._postsService.deletePost(org.id, getPostById.group);
  }

  @Get('/integrations')
  async listIntegration(@GetOrgFromRequest() org: Organization) {
    return (await this._integrationService.getIntegrationsList(org.id)).map(
      (org) => ({
        id: org.id,
        name: org.name,
        identifier: org.providerIdentifier,
        picture: org.picture,
        disabled: org.disabled,
        profile: org.profile,
        customer: org.customer
          ? {
              id: org.customer.id,
              name: org.customer.name,
            }
          : undefined,
      })
    );
  }
}
