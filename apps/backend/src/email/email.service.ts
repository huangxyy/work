import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { RuntimeConfigService } from '../system-config/runtime-config.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress = 'noreply@homework-ai.local';
  private transporterPromise: Promise<void> | null = null;
  private transporterPromiseSignature = '';
  private transporterSignature = '';

  constructor(private readonly runtimeConfigService: RuntimeConfigService) {}

  private async ensureTransporter() {
    const startedAt = Date.now();
    const config = await this.runtimeConfigService.getEmailRuntimeConfig();
    this.fromAddress = config.from || 'noreply@homework-ai.local';
    const signature = JSON.stringify({
      host: config.host || '',
      port: config.port || 587,
      user: config.user || '',
      secure: Boolean(config.secure),
      passwordSet: Boolean(config.password),
      from: this.fromAddress,
    });
    if (this.transporter && this.transporterSignature === signature) {
      return;
    }

    if (this.transporterPromise && this.transporterPromiseSignature === signature) {
      await this.transporterPromise;
      return;
    }

    const ensurePromise = (async () => {
      if (config.host && config.user && config.password) {
        this.transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.user, pass: config.password },
        });
        this.transporterSignature = signature;
        this.logger.log(
          `Email service configured host=${config.host} port=${config.port} secure=${Boolean(config.secure)} durationMs=${Date.now() - startedAt}`,
        );
      } else {
        this.transporter = null;
        this.transporterSignature = signature;
        this.logger.warn(`SMTP not configured — email sending disabled durationMs=${Date.now() - startedAt}`);
      }
    })().finally(() => {
      if (this.transporterPromiseSignature === signature) {
        this.transporterPromise = null;
        this.transporterPromiseSignature = '';
      }
    });

    this.transporterPromise = ensurePromise;
    this.transporterPromiseSignature = signature;
    await ensurePromise;
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    const startedAt = Date.now();
    await this.ensureTransporter();
    if (!this.transporter) {
      this.logger.debug(`Email skipped (not configured): to=${to}, subject=${subject}, durationMs=${Date.now() - startedAt}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.debug(`Email sent to=${to} subject=${subject} durationMs=${Date.now() - startedAt}`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`Failed to send email to ${to} after ${Date.now() - startedAt}ms: ${msg}`);
      return false;
    }
  }
}
