import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateCalendarEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;

  @IsOptional()
  @IsString()
  location?: string;

  // FR-13: format RRULE (RFC 5545), mis. "FREQ=WEEKLY;BYDAY=MO"
  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  // FR-14
  @IsOptional()
  @IsInt()
  @Min(0)
  reminderMinutesBefore?: number;
}
