import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { ExecuteRulesDto } from './dto/execute-rules.dto';
import { matchesCondition } from './rule-evaluator.util';
import { encryptApiKey, maskApiKey } from './ai-key-crypto.util';

type AutomationRuleRow = Awaited<ReturnType<PrismaService['automationRule']['create']>>;

@Injectable()
export class AutomationRuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // FR-19
  async create(userId: string, dto: CreateAutomationRuleDto) {
    const aiFields = this.buildAiFields(dto);
    const rule = await this.prisma.automationRule.create({
      data: {
        userId,
        name: dto.name,
        conditionField: dto.conditionField,
        conditionOperator: dto.conditionOperator ?? 'contains',
        conditionValue: dto.conditionValue,
        actionType: dto.actionType,
        actionValue: dto.actionType === 'ai_agent' ? undefined : dto.actionValue,
        ...aiFields,
      },
    });
    return this.toPublic(rule);
  }

  async findAll(userId: string) {
    const rules = await this.prisma.automationRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rules.map((r) => this.toPublic(r));
  }

  async findOnePublic(userId: string, id: string) {
    return this.toPublic(await this.findOneOrThrow(userId, id));
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
    const existing = await this.findOneOrThrow(userId, id);
    const nextActionType = dto.actionType ?? existing.actionType;

    // Kalau berpindah KELUAR dari ai_agent, bersihkan field AI supaya tidak nyangkut.
    // Kalau TETAP/berpindah KE ai_agent tapi aiApiKey tidak diisi ulang, pertahankan key lama.
    const aiFields =
      nextActionType === 'ai_agent'
        ? this.buildAiFields({ ...existing, ...dto, actionType: 'ai_agent' } as CreateAutomationRuleDto, existing)
        : { aiProvider: null, aiModel: null, aiApiKeyEncrypted: null, aiApiKeyMasked: null };

    const { aiApiKey: _omit, ...rest } = dto as UpdateAutomationRuleDto & { aiApiKey?: string };
    const rule = await this.prisma.automationRule.update({
      where: { id },
      data: { ...rest, ...aiFields },
    });
    return this.toPublic(rule);
  }

  async remove(userId: string, id: string) {
    await this.findOneOrThrow(userId, id);
    return this.prisma.automationRule.delete({ where: { id } });
  }

  // FR-20: eksekusi terhadap satu email masuk. Mengembalikan aturan mana yang cocok + aksi
  // yang SEHARUSNYA dijalankan — tapi TIDAK benar-benar memanggil mail-app-service untuk
  // mengeksekusi aksi (pindah folder/forward/auto-reply/hapus), dan untuk ai_agent TIDAK
  // memanggil LLM sungguhan (baru fondasi konfigurasi — lihat README).
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
        aiProvider: rule.aiProvider,
        aiModel: rule.aiModel,
      })),
    };
  }

  private buildAiFields(
    dto: CreateAutomationRuleDto,
    existing?: AutomationRuleRow,
  ): {
    aiProvider: CreateAutomationRuleDto['aiProvider'] | null;
    aiModel: string | null;
    aiApiKeyEncrypted: string | null;
    aiApiKeyMasked: string | null;
  } {
    if (dto.actionType !== 'ai_agent') {
      return { aiProvider: null, aiModel: null, aiApiKeyEncrypted: null, aiApiKeyMasked: null };
    }

    if (!dto.aiApiKey) {
      // Update tanpa key baru — pertahankan yang lama (harus ada, divalidasi di controller/DTO
      // saat create; untuk update, existing sudah bertipe ai_agent atau baru berpindah ke situ).
      return {
        aiProvider: dto.aiProvider ?? existing?.aiProvider ?? null,
        aiModel: dto.aiModel ?? existing?.aiModel ?? null,
        aiApiKeyEncrypted: existing?.aiApiKeyEncrypted ?? null,
        aiApiKeyMasked: existing?.aiApiKeyMasked ?? null,
      };
    }

    const secret = this.config.get<string>('AI_KEY_ENCRYPTION_SECRET');
    if (!secret) {
      throw new Error('AI_KEY_ENCRYPTION_SECRET tidak diset — tidak bisa menyimpan API key AI agent');
    }

    return {
      aiProvider: dto.aiProvider ?? null,
      aiModel: dto.aiModel ?? null,
      aiApiKeyEncrypted: encryptApiKey(dto.aiApiKey, secret),
      aiApiKeyMasked: maskApiKey(dto.aiApiKey),
    };
  }

  // aiApiKeyEncrypted TIDAK PERNAH keluar lewat API — cukup masked preview.
  private toPublic(rule: AutomationRuleRow) {
    const { aiApiKeyEncrypted: _omit, ...publicRule } = rule;
    return publicRule;
  }
}
