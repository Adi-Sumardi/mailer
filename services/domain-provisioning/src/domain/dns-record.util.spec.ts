import {
  buildDmarcRecord,
  buildMxRecord,
  buildSpfRecord,
  generateDkimKeyPair,
} from './dns-record.util';

describe('dns-record.util', () => {
  it('buildMxRecord formats priority + host with trailing dot', () => {
    expect(buildMxRecord('mail.example.com', 10)).toBe('10 mail.example.com.');
  });

  it('buildSpfRecord hard-fails by default and includes relay host/IP when provided', () => {
    expect(buildSpfRecord()).toBe('v=spf1 -all');
    expect(buildSpfRecord('relay.provider.com')).toBe('v=spf1 include:relay.provider.com -all');
    expect(buildSpfRecord(undefined, '203.0.113.10')).toBe('v=spf1 ip4:203.0.113.10 -all');
    expect(buildSpfRecord('relay.provider.com', '203.0.113.10')).toBe(
      'v=spf1 ip4:203.0.113.10 include:relay.provider.com -all',
    );
  });

  it('buildDmarcRecord starts at quarantine policy with reporting address', () => {
    const record = buildDmarcRecord('example.com');
    expect(record).toContain('p=quarantine');
    expect(record).toContain('rua=mailto:dmarc-reports@example.com');
  });

  it('generateDkimKeyPair returns a usable public TXT value and private PEM', () => {
    const { selector, publicKeyRecord, privateKeyPem } = generateDkimKeyPair('sendago');
    expect(selector).toBe('sendago');
    expect(publicKeyRecord).toMatch(/^v=DKIM1; k=rsa; p=[A-Za-z0-9+/=]+$/);
    expect(privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
  });
});
