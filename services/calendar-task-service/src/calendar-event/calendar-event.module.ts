import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalendarEventController } from './calendar-event.controller';
import { CalendarEventService } from './calendar-event.service';

@Module({
  imports: [AuthModule],
  controllers: [CalendarEventController],
  providers: [CalendarEventService],
  exports: [CalendarEventService],
})
export class CalendarEventModule {}
