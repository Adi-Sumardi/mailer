export interface IncomingEmail {
  fromAddr: string;
  subject: string;
  body: string;
}

export interface RuleCondition {
  conditionField: 'sender' | 'subject' | 'body';
  conditionOperator: 'contains' | 'equals';
  conditionValue: string;
}

// FR-19/FR-20: mengevaluasi satu kondisi aturan terhadap email masuk. Pure function —
// tidak menyentuh DB/HTTP, jadi bisa diuji langsung tanpa mock.
export function matchesCondition(rule: RuleCondition, email: IncomingEmail): boolean {
  const fieldValue = {
    sender: email.fromAddr,
    subject: email.subject,
    body: email.body,
  }[rule.conditionField].toLowerCase();

  const target = rule.conditionValue.toLowerCase();

  return rule.conditionOperator === 'equals'
    ? fieldValue === target
    : fieldValue.includes(target);
}
