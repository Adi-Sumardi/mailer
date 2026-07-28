import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateTaskFromEmailDto } from './dto/create-task-from-email.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-16
  create(userId: string, dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority,
      },
    });
  }

  // FR-18
  createFromEmail(userId: string, dto: CreateTaskFromEmailDto) {
    return this.prisma.task.create({
      data: { userId, title: dto.title, linkedEmailId: dto.emailId },
    });
  }

  findAll(userId: string, status?: TaskStatus) {
    return this.prisma.task.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOneOrThrow(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) {
      throw new NotFoundException(`Task ${id} tidak ditemukan`);
    }
    return task;
  }

  // FR-17: update status (todo/in_progress/done) sekaligus field lain (judul, deadline, prioritas)
  async update(userId: string, id: string, dto: UpdateTaskDto) {
    await this.findOneOrThrow(userId, id);
    return this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOneOrThrow(userId, id);
    return this.prisma.task.delete({ where: { id } });
  }
}
