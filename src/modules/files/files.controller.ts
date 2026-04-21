import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CreateDownloadLinkResponseDto } from './dto/create-download-link-response.dto';
import { CreateDownloadLinkDto } from './dto/create-download-link.dto';
import { DownloadFileQueryDto } from './dto/download-file-query.dto';
import { UploadFileResponseDto } from './dto/upload-file-response.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@ApiTags('Files')
@Controller('v1/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @ApiOperation({
    summary: 'Upload a base64-encoded file into the active storage provider.',
  })
  @ApiCreatedResponse({ type: UploadFileResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Post('upload')
  async upload(@Body() body: UploadFileDto, @Req() req: Request) {
    const uploaded = await this.filesService.uploadBase64File({
      fileName: body.fileName,
      contentBase64: body.contentBase64,
      contentType: body.contentType ?? 'application/octet-stream',
      organizationId: body.organizationId,
    });

    return {
      data: {
        ...uploaded,
        downloadUrl: this.filesService.createDownloadLink(
          uploaded.storageKey,
          this.resolveBaseUrl(req),
        ),
      },
    };
  }

  @ApiOperation({ summary: 'Generate a download URL for a stored file.' })
  @ApiCreatedResponse({ type: CreateDownloadLinkResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Post('download-link')
  createDownloadLink(@Body() body: CreateDownloadLinkDto, @Req() req: Request) {
    return {
      data: {
        storageKey: body.storageKey,
        url: this.filesService.createDownloadLink(
          body.storageKey,
          this.resolveBaseUrl(req),
        ),
      },
    };
  }

  @ApiOperation({
    summary: 'Stream a locally stored file or redirect to a public Bunny URL.',
  })
  @ApiQuery({ name: 'key', type: String, required: true })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description:
      'Binary file stream when the active storage provider is local disk.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiFoundResponse({
    description:
      'Redirect to the public file URL when the active storage provider exposes one.',
  })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({
    description: 'The requested file could not be found.',
  })
  @Get('download')
  async download(
    @Query() query: DownloadFileQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.filesService.downloadFile(query.key);

    if (result.redirectUrl) {
      res.redirect(result.redirectUrl);
      return;
    }

    if (result.file?.contentType) {
      res.setHeader('Content-Type', result.file.contentType);
    }

    if (result.file) {
      res.setHeader('Content-Length', String(result.file.sizeBytes));
      res.send(result.file.body);
      return;
    }

    res.status(404).send('File not found');
  }

  private resolveBaseUrl(req: Request): string {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const firstForwardedProto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto;
    const protocol = firstForwardedProto || req.protocol || 'http';

    return `${protocol}://${req.get('host')}`;
  }
}
