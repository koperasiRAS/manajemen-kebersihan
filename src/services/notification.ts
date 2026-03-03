// ============================================================
// Modular Notification Service
// Supports WhatsApp Business API and Telegram Bot API
// Easily switchable via NOTIFICATION_PROVIDER env var
// ============================================================

import type { NotificationPayload } from '@/lib/types';

type NotificationProvider = 'whatsapp' | 'telegram' | 'none';

/**
 * Get the configured notification provider
 */
function getProvider(): NotificationProvider {
  const provider = process.env.NOTIFICATION_PROVIDER?.toLowerCase();
  if (provider === 'whatsapp') return 'whatsapp';
  if (provider === 'telegram') return 'telegram';
  return 'none';
}

/**
 * Send notification via WhatsApp Business API
 */
async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

  if (!apiUrl || !apiToken) {
    console.warn('[Notification] WhatsApp API not configured');
    return false;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Notification] WhatsApp send failed:', error);
    return false;
  }
}

/**
 * Send notification via Telegram Bot API
 */
async function sendTelegram(chatId: string, message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn('[Notification] Telegram Bot not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[Notification] Telegram send failed:', error);
    return false;
  }
}

/**
 * Send a notification using the configured provider
 */
export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  const provider = getProvider();

  const message = `⚠️ DISCIPLINE ALERT\n\nEmployee: ${payload.employeeName}\nConsecutive Missed Days: ${payload.consecutiveMissed}\n\n${payload.message}`;

  switch (provider) {
    case 'whatsapp': {
      const results: boolean[] = [];
      if (payload.ownerPhone) {
        results.push(await sendWhatsApp(payload.ownerPhone, message));
      }
      if (payload.type === 'violation_warning' && payload.employeePhone) {
        results.push(await sendWhatsApp(payload.employeePhone, message));
      }
      return results.some(Boolean);
    }

    case 'telegram': {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        return await sendTelegram(chatId, message);
      }
      return false;
    }

    case 'none':
    default:
      console.log('[Notification] No provider configured. Message:', message);
      return false;
  }
}

export const notificationService = {
  sendNotification,
};
