import { Logger } from '@nestjs/common';
import { MailProcessor } from './mail.processor';
import type { MailService } from './mail.service';

const rejected = new Error('Resend rejected the email: daily quota exceeded');

function codeJob(attemptsMade: number) {
  return {
    id: '42',
    name: 'send-email-code',
    data: { to: 'ana@neopass.test', name: 'Ana', code: '123456' },
    attemptsMade,
    opts: { attempts: 5 },
  } as unknown as Parameters<MailProcessor['process']>[0];
}

describe('MailProcessor cuando Resend rechaza un mail', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let processor: MailProcessor;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    processor = new MailProcessor({
      sendEmailCode: jest.fn().mockRejectedValue(rejected),
    } as unknown as MailService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('deja registrado el tipo de mail y el número de intento', async () => {
    await expect(processor.process(codeJob(0))).rejects.toBe(rejected);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      `Mail job 42 of type send-email-code failed on attempt 1 of 5: ${rejected.message}`,
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('el último intento queda como error', async () => {
    await expect(processor.process(codeJob(4))).rejects.toBe(rejected);

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      `Mail job 42 of type send-email-code failed on attempt 5 of 5: ${rejected.message}`,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('relanza el error para que la cola lo reintente', async () => {
    await expect(processor.process(codeJob(1))).rejects.toBe(rejected);
  });

  it('no registra la dirección ni el contenido del mail', async () => {
    await expect(processor.process(codeJob(0))).rejects.toBe(rejected);

    const logged = JSON.stringify([warn.mock.calls, error.mock.calls]);
    expect(logged).not.toContain('ana@neopass.test');
    expect(logged).not.toContain('123456');
  });
});
