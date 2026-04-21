import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
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
import { FileMetadataResponseDto } from './dto/file-metadata-response.dto';
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
      contentType: body.contentType,
      organizationId: body.organizationId,
      requestId: body.requestId,
      submissionId: body.submissionId,
      submissionItemId: body.submissionItemId,
      uploadedByType: body.uploadedByType,
      uploadedById: body.uploadedById,
      metadata: body.metadata,
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

  @ApiOperation({ summary: 'Get persisted metadata for an uploaded file.' })
  @ApiOkResponse({ type: FileMetadataResponseDto })
  @ApiNotFoundResponse({ description: 'File metadata not found.' })
  @Get('metadata/:id')
  async getFileMetadata(@Param('id') fileId: string, @Req() req: Request) {
    const fileMetadata = await this.filesService.getFileMetadata(fileId);

    return {
      data: {
        id: fileMetadata.id,
        organizationId: fileMetadata.organizationId,
        requestId: fileMetadata.requestId,
        submissionId: fileMetadata.submissionId,
        submissionItemId: fileMetadata.submissionItemId,
        originalFileName: fileMetadata.originalFileName,
        normalizedFileName: fileMetadata.normalizedFileName,
        extension: fileMetadata.extension,
        declaredMimeType: fileMetadata.declaredMimeType,
        detectedMimeType: fileMetadata.detectedMimeType,
        sizeBytes: fileMetadata.sizeBytes,
        checksumSha256: fileMetadata.checksumSha256,
        storageKey: fileMetadata.storageKey,
        storageDriver: fileMetadata.storageDriver,
        publicUrl: this.filesService.getPublicFileUrl(fileMetadata.storageKey),
        downloadUrl: this.filesService.createDownloadLink(
          fileMetadata.storageKey,
          this.resolveBaseUrl(req),
        ),
        status: fileMetadata.status,
        createdAt: fileMetadata.createdAt.toISOString(),
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
