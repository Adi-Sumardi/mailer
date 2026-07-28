import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export type Priority = 'low' | 'medium' | 'high';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: Priority;
}
