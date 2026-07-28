import { matchesCondition } from './rule-evaluator.util';

const email = {
  fromAddr: 'billing@vendor.com',
  subject: 'Invoice Agustus 2026',
  body: 'Berikut invoice bulanan Anda dari Vendor Inc.',
};

describe('rule-evaluator', () => {
  it('mencocokkan sender dengan operator contains (case-insensitive)', () => {
    expect(
      matchesCondition(
        { conditionField: 'sender', conditionOperator: 'contains', conditionValue: '@VENDOR.com' },
        email,
      ),
    ).toBe(true);
  });

  it('tidak mencocokkan sender yang tidak mengandung nilai kondisi', () => {
    expect(
      matchesCondition(
        { conditionField: 'sender', conditionOperator: 'contains', conditionValue: '@lain.com' },
        email,
      ),
    ).toBe(false);
  });

  it('mencocokkan subject dengan operator equals', () => {
    expect(
      matchesCondition(
        { conditionField: 'subject', conditionOperator: 'equals', conditionValue: 'Invoice Agustus 2026' },
        email,
      ),
    ).toBe(true);
  });

  it('operator equals tidak cocok untuk substring parsial', () => {
    expect(
      matchesCondition(
        { conditionField: 'subject', conditionOperator: 'equals', conditionValue: 'Invoice' },
        email,
      ),
    ).toBe(false);
  });

  it('mencocokkan body dengan operator contains', () => {
    expect(
      matchesCondition(
        { conditionField: 'body', conditionOperator: 'contains', conditionValue: 'invoice bulanan' },
        email,
      ),
    ).toBe(true);
  });
});
