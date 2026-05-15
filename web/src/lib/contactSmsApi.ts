import api from './api';

export type ContactSmsType = 'lead' | 'client';

export interface SendSmsPayload {
  contactType: ContactSmsType;
  contactId: string;
  text: string;
}

export const contactSmsApi = {
  async sendSms(payload: SendSmsPayload): Promise<{ ok: boolean; messageId: string | null; sentAt: string }> {
    const { data } = await api.post('/contact-sms/send', payload);
    return data;
  }
};
