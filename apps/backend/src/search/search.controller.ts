import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  async search(@Query('q') q: string, @Req() req: { user: AuthUser }) {
    return this.service.search(q, req.user);
  }
}
