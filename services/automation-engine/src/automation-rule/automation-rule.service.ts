import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { ExecuteRulesDto } from './dto/execute-rules.dto';
import { matchesCondition } from './rule-evaluator.util';

@Injectable()
export class AutomationRuleService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-19
  create(userId: string, dto: CreateAutomationRuleDto) {
    return this.prisma.automationRule.create({
      data: {
        userId,
        name: dto.name,
        conditionField: dto.conditionField,
        conditionOperator: dto.conditionOperator ?? 'contains',
        conditionValue: dto.conditionValue,
        actionType: dto.actionType,
        actionValue: dto.actionValue,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.automationRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrThrow(userId: string, id: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, userId } });
    if (!rule) {
      throw new NotFoundException(`Automation rule ${id} tidak ditemukan`);
    }
    return rule;
  }

  // FR-21: aktif/nonaktifkan lewat isActive di UpdateAutomationRuleDto — endpoint yang sama
  // dengan edit field lain, tidak perlu endpoint terpisah.
  async update(userId: string, id: string, dto: UpdateAutomationRuleDto) {
    await this.findOneOrThrow(userId, id);
    return this.prisma.automationRule.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOneOrThrow(userId, id);
    return this.prisma.automationRule.delete({ where: { id } });
  }

  // FR-20: eksekusi terhadap satu email masuk. Mengembalikan aturan mana yang cocok + aksi
  // yang SEHARUSNYA dijalankan — tapi TIDAK benar-benar memanggil mail-app-service untuk
  // mengeksekusi aksi (pindah folder/forward/auto-reply/hapus). Lihat README untuk kenapa.
  async executeForEmail(userId: string, dto: ExecuteRulesDto) {
    const activeRules = await this.prisma.automationRule.findMany({
      where: { userId, isActive: true },
    });

    const matched = activeRules.filter((rule) =>
      matchesCondition(
        {
          conditionField: rule.conditionField,
          conditionOperator: rule.conditionOperator,
          conditionValue: rule.conditionValue,
        },
        { fromAddr: dto.fromAddr, subject: dto.subject, body: dto.body },
      ),
    );

    return {
      matchedCount: matched.length,
      actions: matched.map((rule) => ({
        ruleId: rule.id,
        ruleName: rule.name,
        actionType: rule.actionType,
        actionValue: rule.actionValue,
      })),
    };
  }
}
