import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { RuntimeConfigService } from '../system-config/runtime-config.service';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let runtimeConfigService: any;

  const fullConfig = {
    host: 'smtp.test.com',
    port: 587,
    secure: false,
    user: 'user@test.com',
    password: 'secret',
    from: 'noreply@test.com',
  };

  beforeEach(async () => {
    runtimeConfigService = {
      getEmailRuntimeConfig: jest.fn().mockResolvedValue(fullConfig),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: RuntimeConfigService, useValue: runtimeConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe('isConfigured', () => {
    it('should return false before first send', () => {
      expect(service.isConfigured).toBe(false);
    });
  });

  describe('send', () => {
    it('should send email when configured', async () => {
      const result = await service.send('to@test.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(true);
    });

    it('should return false when SMTP not configured', async () => {
      runtimeConfigService.getEmailRuntimeConfig.mockResolvedValue({
        host: '',
        user: '',
        password: '',
      });

      const result = await service.send('to@test.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(false);
    });

    it('should return false on send error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer');
      nodemailer.createTransport.mockReturnValue({
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP error')),
      });

      // Force transporter re-creation by using a different config signature
      runtimeConfigService.getEmailRuntimeConfig.mockResolvedValue({
        ...fullConfig,
        host: 'other-smtp.test.com',
      });

      const result = await service.send('to@test.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(false);
    });

    it('should reuse transporter when config unchanged', async () => {
      await service.send('a@test.com', 'S1', '<p>1</p>');
      await service.send('b@test.com', 'S2', '<p>2</p>');

      // getEmailRuntimeConfig called twice (once per send)
      expect(runtimeConfigService.getEmailRuntimeConfig).toHaveBeenCalledTimes(2);
    });
  });
});
