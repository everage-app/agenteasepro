const telnyx = require('telnyx');

class TelnyxService {
  private client: any;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = process.env.TELNYX_API_KEY;
    if (apiKey) {
      this.client = telnyx(apiKey);
      this.isConfigured = true;
      console.log('Telnyx SDK initialized.');
    } else {
      console.warn('TELNYX_API_KEY is not defined. Telnyx SMS service is disabled.');
    }
  }

  /**
   * Send an SMS message via Telnyx
   */
  async sendSms({ to, from, text }: { to: string; from?: string; text: string }): Promise<any> {
    if (!this.isConfigured) {
      console.error('Cannot send SMS: Telnyx service is not configured (missing API key).');
      throw new Error('Telnyx API key missing');
    }

    try {
      // If no from number is provided, fall back to a default environment variable
      const fromNumber = from || process.env.TELNYX_DEFAULT_FROM_NUMBER;
      if (!fromNumber) {
        throw new Error('No "from" number provided and TELNYX_DEFAULT_FROM_NUMBER is not set.');
      }

      console.log(`Sending SMS via Telnyx to ${to}...`);
      const response = await this.client.messages.create({
        from: fromNumber,
        to,
        text,
      });

      console.log(`Successfully sent Telnyx SMS to ${to}. Message ID: ${response.data?.id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error sending Telnyx SMS to ${to}:`, error.message || error);
      throw error;
    }
  }
}

export const telnyxService = new TelnyxService();
