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
    meetingTitle?: string;
    dateTime?: string;
  }) => string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'meeting-invite',
    name: '📅 Formal Meeting Invite',
    category: 'FORMAL',
    generate: ({ leadName, meetingTitle, dateTime, meetingUrl }) => {
      let text = `📅 *NEW MEETING SCHEDULED* \n\n`;
      text += `Hi ${leadName || 'there'},\n\nI've finalized our temporal alignment for: *${meetingTitle || 'Strategic Discussion'}*.\n\n`;
      text += `⏰ *TIME:* ${dateTime || 'TBD'}\n`;
      if (meetingUrl) {
        text += `🔗 *JOIN LINK:* ${meetingUrl}\n`;
      }
      text += `\nLooking forward to a productive session!\n\n--- \nSent via *handycrm.ai*`;
      return text;
    }
  },
  {
    id: 'meeting-recap',
    name: '📝 Meeting Recap & Minutes',
    category: 'RECAP',
    generate: ({ leadName, aiInsights, meetingUrl }) => {
      let text = `🚀 *MEETING INTELLIGENCE RECAP* 🚀\n\n`;
      text += `Hi ${leadName || 'there'},\nGreat connecting with you. Here are the core insights from our synchronization:\n\n`;

      if (aiInsights?.overview) {
        text += `📝 *EXECUTIVE SUMMARY:*\n${aiInsights.overview}\n\n`;
      }

      if (aiInsights?.meetingMinutes && aiInsights.meetingMinutes.length > 0) {
        text += `💡 *CORE TAKEAWAYS:*\n`;
        aiInsights.meetingMinutes.forEach((p: string) => text += `• ${p}\n`);
        text += `\n`;
      }

      if (aiInsights?.tasks && aiInsights.tasks.length > 0) {
        text += `✅ *ACTION ITEMS:*\n`;
        aiInsights.tasks.forEach((t: any) => text += `• ${t.title}\n`);
        text += `\n`;
      }

      if (meetingUrl) {
        text += `🔗 *FULL RECORDINGS & DATA:* ${meetingUrl}\n\n`;
      }

      text += `Please reach out if you require further neural clarification.\n\n`;
      text += `--- \nSent via *handycrm.ai*`;
      return text;
    }
  },
  {
    id: 'intro-followup',
    name: '👋 Introduction & Thank You',
    category: 'NEXT_STEPS',
    generate: ({ leadName, company }) => {
      return `Hi ${leadName || 'there'},\n\nThank you for your time today! It was wonderful learning more about ${company || 'your company'}. Looking forward to our next steps.\n\nBest regards,\nSent via handycrm.ai`;
    }
  },
  {
    id: 'quick-pulse',
    name: '🔥 Quick Pulse Check',
    category: 'QUICK_NOTE',
    generate: ({ leadName }) => {
      return `Hey ${leadName || 'there'},\n\nJust checking in based on our recent conversation. Do you have any updates on the points we discussed?\n\nCheers!`;
    }
  }
];

export const openWhatsApp = (phone: string, text: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};
