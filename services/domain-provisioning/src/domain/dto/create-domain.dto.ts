import { IsNotEmpty, IsString, Matches } from 'class-validator';

const DOMAIN_NAME_REGEX = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/;

export class CreateDomainDto {
  @IsNotEmpty()
  @IsString()
  tenantId: string;

  @IsNotEmpty()
  @IsString()
  @Matches(DOMAIN_NAME_REGEX, { message: 'domainName harus berupa nama domain yang valid' })
  domainName: string;
}
