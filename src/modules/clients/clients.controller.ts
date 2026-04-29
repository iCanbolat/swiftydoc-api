import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { resolvePagination } from '../../common/http/pagination.dto';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedInternalActor } from '../auth/auth.types';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { WorkspaceAccess } from '../auth/workspace-access.decorator';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import {
  ClientListResponseDto,
  ClientResponseDto,
} from './dto/client-response.dto';
import { GetClientQueryDto } from './dto/get-client-query.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('Clients')
@ApiBearerAuth('bearer')
@UseGuards(InternalAuthGuard, WorkspaceMembershipGuard)
@Controller('v1/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @ApiOperation({ summary: 'List clients for a workspace.' })
  @ApiOkResponse({ type: ClientListResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    key: 'workspaceId',
    resource: 'workspace',
    source: 'query',
  })
  @Get()
  async listClients(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Query() query: ListClientsQueryDto,
  ) {
    const result = await this.clientsService.listClients({
      organizationId: actor.organization.id,
      pagination: resolvePagination(query),
      province: query.province,
      search: query.search,
      status: query.status,
      workspaceId: query.workspaceId,
    });

    return {
      data: result.data.map((item) =>
        this.clientsService.serializeClient(item),
      ),
      meta: result.meta,
    };
  }

  @ApiOperation({ summary: 'Create a client in a workspace.' })
  @ApiCreatedResponse({ type: ClientResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    key: 'workspaceId',
    resource: 'workspace',
    source: 'body',
  })
  @Post()
  async createClient(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreateClientDto,
  ) {
    const client = await this.clientsService.createClient({
      organizationId: actor.organization.id,
      workspaceId: body.workspaceId,
      displayName: body.displayName,
      legalName: body.legalName,
      externalRef: body.externalRef,
      province: body.province,
      district: body.district,
      metadata: body.metadata,
      actorUserId: actor.user.id,
    });

    return {
      data: this.clientsService.serializeClient(client),
    };
  }

  @ApiOperation({ summary: 'Get a client by id.' })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Client not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'client', source: 'param' })
  @Get(':id')
  async getClient(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Param('id') clientId: string,
    @Query() query: GetClientQueryDto,
  ) {
    const client = await this.clientsService.getClientResponse(
      clientId,
      actor.organization.id,
      query.include,
    );

    return {
      data: client,
    };
  }

  @ApiOperation({
    summary: 'Update client identity, location, metadata and status.',
  })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Client not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'client', source: 'param' })
  @Patch(':id')
  async updateClient(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Param('id') clientId: string,
    @Body() body: UpdateClientDto,
  ) {
    const client = await this.clientsService.updateClient(clientId, {
      organizationId: actor.organization.id,
      displayName: body.displayName,
      legalName: body.legalName,
      externalRef: body.externalRef,
      province: body.province,
      district: body.district,
      metadata: body.metadata,
      status: body.status,
      actorUserId: actor.user.id,
    });

    return {
      data: this.clientsService.serializeClient(client),
    };
  }
}
