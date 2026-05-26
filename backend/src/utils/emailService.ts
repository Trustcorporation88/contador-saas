/**
 * Email Service
 * Handles all email notifications for EFD and system
 */

import nodemailer, { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: any[];
  priority?: 'low' | 'normal' | 'high';
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on environment
   */
  private initializeTransporter(): void {
    try {
      const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

      if (emailProvider === 'sendgrid') {
        // SendGrid configuration
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY || '',
          },
        });
        this.isConfigured = !!process.env.SENDGRID_API_KEY;
      } else if (emailProvider === 'ses') {
        // AWS SES configuration
        const nodemailerSES = require('nodemailer-ses');
        const aws = require('aws-sdk');

        const ses = new aws.SES({
          region: process.env.AWS_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });

        this.transporter = nodemailer.createTransport(nodemailerSES({ ses, aws }));
        this.isConfigured = !!process.env.AWS_ACCESS_KEY_ID;
      } else if (emailProvider === 'gmail') {
        // Gmail configuration
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASSWORD,
          },
        });
        this.isConfigured = !!(process.env.GMAIL_USER && process.env.GMAIL_PASSWORD);
      } else {
        // Default SMTP configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              }
            : undefined,
        });
        this.isConfigured = !!process.env.SMTP_HOST;
      }

      console.log(`[Email Service] Configured with provider: ${emailProvider}`);
    } catch (error) {
      console.error('[Email Service] Error initializing transporter:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<any> {
    if (!this.transporter || !this.isConfigured) {
      console.warn('[Email Service] Email not configured, skipping send');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@contador.app',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        headers: {
          'X-Priority': this.priorityToNumber(options.priority || 'normal'),
        },
      });

      console.log(`[Email Service] Email sent successfully: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('[Email Service] Error sending email:', error);
      throw error;
    }
  }

  /**
   * Convert priority string to number
   */
  private priorityToNumber(priority: string): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'normal':
        return 3;
      case 'low':
        return 5;
      default:
        return 3;
    }
  }

  /**
   * Verify transporter connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('[Email Service] Connection verified');
      return true;
    } catch (error) {
      console.error('[Email Service] Connection verification failed:', error);
      return false;
    }
  }
}

// Singleton instance
const emailService = new EmailService();

/**
 * Send email notification
 * Public API
 */
export async function sendEmailNotification(options: EmailOptions): Promise<any> {
  return emailService.sendEmail(options);
}

/**
 * Verify email service
 */
export async function verifyEmailService(): Promise<boolean> {
  return emailService.verifyConnection();
}

export default emailService;
