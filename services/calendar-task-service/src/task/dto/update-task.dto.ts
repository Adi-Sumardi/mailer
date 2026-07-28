import { IsEnum, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  // FR-17: update status tugas
  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'done'])
  status?: TaskStatus;
}
