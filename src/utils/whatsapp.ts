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
  }) => string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'meeting-recap',
    name: '📝 Meeting Recap & Minutes',
    category: 'RECAP',
    generate: ({ leadName, aiInsights, meetingUrl }) => {
      let text = `🚀 *Meeting Intelligence Report* 🚀\n\n`;
      text += `Hi ${leadName || 'there'},\nIt was great connecting today. Here's a quick recap of our discussion:\n\n`;
      
      if (aiInsights?.overview) {
        text += `📝 *Summary:* ${aiInsights.overview}\n\n`;
      }
      
      if (aiInsights?.meetingMinutes && aiInsights.meetingMinutes.length > 0) {
        text += `💡 *Key Points:*\n`;
        aiInsights.meetingMinutes.forEach((p: string) => text += `• ${p}\n`);
        text += `\n`;
      }
      
      if (aiInsights?.tasks && aiInsights.tasks.length > 0) {
        text += `✅ *Next Steps:*\n`;
        aiInsights.tasks.forEach((t: any) => text += `• ${t.title}\n`);
        text += `\n`;
      }

      if (meetingUrl) {
        text += `🔗 *Full Protocol & Recordings:* ${meetingUrl}\n\n`;
      }
      
      text += `Feel free to reach out if you have any questions!\n\n`;
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
