import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;

  constructor(configService: ConfigService) {
    const host = configService.get<string>('SMTP_HOST');
    const port = Number(configService.get<string>('SMTP_PORT') || '587');
    const user = configService.get<string>('SMTP_USER');
    const pass = configService.get<string>('SMTP_PASS');
    this.fromAddress = configService.get<string>('SMTP_FROM') || 'noreply@homework-ai.local';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log('Email service configured');
    } else {
      this.logger.warn('SMTP not configured — email sending disabled');
    }
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.debug(`Email skipped (not configured): to=${to}, subject=${subject}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`Failed to send email to ${to}: ${msg}`);
      return false;
    }
  }
}
