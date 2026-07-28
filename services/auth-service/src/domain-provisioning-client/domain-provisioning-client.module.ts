import { Module } from '@nestjs/common';
import { DomainProvisioningClientService } from './domain-provisioning-client.service';

@Module({
  providers: [DomainProvisioningClientService],
  exports: [DomainProvisioningClientService],
})
export class DomainProvisioningClientModule {}
