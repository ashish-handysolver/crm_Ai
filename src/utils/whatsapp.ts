/**
 * WhatsApp Intelligence Utility
 * Manages message templates and formatting for lead communication.
 */

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'RECAP' | 'NEXT_STEPS' | 'QUICK_NOTE' | 'FORMAL';
  generate: (data: {
    leadName?: string;
    company?: string;
    aiInsights?: any;
    meetingUrl?: string;
    recordUrl?: string;
    meetingTitle?: string;
    dateTime?: string;
  }) => string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'meeting-invite',
    name: 'Formal Meeting Invite',
    category: 'FORMAL',
    generate: ({ leadName, meetingTitle, dateTime, meetingUrl }) => {
      let text = `*New Meeting Scheduled*\n\n`;
      text += `Hi ${leadName || 'there'},\n\nI've finalized our plan for *${meetingTitle || 'Strategic Discussion'}*.\n\n`;
      text += `*Time:* ${dateTime || 'TBD'}\n`;
      if (meetingUrl) {
        text += `*Join Link:* ${meetingUrl}\n`;
      }
      text += `\nLooking forward to a productive session!\n\n---\nSent via *handycrm.ai*`;
      return text;
    }
  },
  {
    id: 'meeting-recap',
    name: 'Meeting Recap & Minutes',
    category: 'RECAP',
    generate: ({ leadName, aiInsights, meetingUrl, recordUrl }) => {
      let text = `*Meeting Recap & Next Steps*\n\n`;
      text += `Hi ${leadName || 'there'},\nGreat connecting with you. Here are the key points from our meeting:\n\n`;

      if (aiInsights?.overview) {
        text += `*Executive Summary:*\n${aiInsights.overview}\n\n`;
      }

      if (Array.isArray(aiInsights?.meetingMinutes) && aiInsights.meetingMinutes.length > 0) {
        text += `*Core Takeaways:*\n`;
        aiInsights.meetingMinutes.forEach((point: string) => {
          text += `• ${point}\n`;
        });
        text += `\n`;
      }

      if (Array.isArray(aiInsights?.tasks) && aiInsights.tasks.length > 0) {
        text += `*Action Items:*\n`;
        aiInsights.tasks.forEach((task: any) => {
          text += `• ${task.title}\n`;
        });
        text += `\n`;
      }

      if (recordUrl) {
        text += `*Recording Link:* ${recordUrl}\n`;
      }

      if (meetingUrl) {
        text += `*Meeting Link:* ${meetingUrl}\n`;
      }

      text += `\nPlease reach out if you need anything else.\n\n---\nSent via *handycrm.ai*`;
      return text;
    }
  },
  {
    id: 'intro-followup',
    name: 'Introduction & Thank You',
    category: 'NEXT_STEPS',
    generate: ({ leadName, company }) => {
      return `Hi ${leadName || 'there'},\n\nThank you for your time today! It was wonderful learning more about ${company || 'your company'}. Looking forward to our next steps.\n\nBest regards,\nSent via handycrm.ai`;
    }
  },
  {
    id: 'quick-pulse',
    name: 'Quick Pulse Check',
    category: 'QUICK_NOTE',
    generate: ({ leadName }) => {
      return `Hey ${leadName || 'there'},\n\nJust checking in based on our recent conversation. Do you have any updates on the points we discussed?\n\nCheers!`;
    }
  }
];

export const openWhatsApp = (phone: string | undefined, text: string) => {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};
