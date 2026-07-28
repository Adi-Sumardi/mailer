import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AutomationRuleController } from './automation-rule.controller';
import { AutomationRuleService } from './automation-rule.service';

@Module({
  imports: [AuthModule],
  controllers: [AutomationRuleController],
  providers: [AutomationRuleService],
  exports: [AutomationRuleService],
})
export class AutomationRuleModule {}
