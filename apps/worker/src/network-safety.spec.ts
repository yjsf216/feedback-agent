import { assertSafeRemoteUrl } from './network-safety';

describe('assertSafeRemoteUrl', () => {
  it('rejects loopback addresses', async () => {
    await expect(assertSafeRemoteUrl('http://127.0.0.1/admin')).rejects.toThrow(
      'Private',
    );
  });

  it('rejects non-http protocols', async () => {
    await expect(assertSafeRemoteUrl('file:///etc/passwd')).rejects.toThrow(
      'HTTP',
    );
  });
});
