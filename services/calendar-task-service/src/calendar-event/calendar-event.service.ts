import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@Injectable()
export class CalendarEventService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-12
  create(userId: string, dto: CreateCalendarEventDto) {
    return this.prisma.calendarEvent.create({
      data: {
        userId,
        title: dto.title,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        location: dto.location,
        recurrenceRule: dto.recurrenceRule,
        reminderMinutesBefore: dto.reminderMinutesBefore,
      },
    });
  }

  // FR-15: tampilan harian/mingguan/bulanan — backend cukup sediakan range query,
  // pengelompokan hari/minggu/bulan jadi tanggung jawab client/UI.
  findAll(userId: string, dateFrom?: string, dateTo?: string) {
    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        ...(dateFrom || dateTo
          ? {
              startTime: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOneOrThrow(userId: string, id: string) {
    const event = await this.prisma.calendarEvent.findFirst({ where: { id, userId } });
    if (!event) {
      throw new NotFoundException(`Event ${id} tidak ditemukan`);
    }
    return event;
  }

  async update(userId: string, id: string, dto: UpdateCalendarEventDto) {
    await this.findOneOrThrow(userId, id);
    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startTime ? { startTime: new Date(dto.startTime) } : {}),
        ...(dto.endTime ? { endTime: new Date(dto.endTime) } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOneOrThrow(userId, id);
    return this.prisma.calendarEvent.delete({ where: { id } });
  }
}
