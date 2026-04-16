// src/api/chat.js - الإصدار النهائي مع التصدير الصحيح
import apiClient from './client';
import { getSecureItem } from '../utils/storage';

class ChatService {
  constructor() {
    this.baseUrl = '/chat';
    this.currentUserId = null;
  }

  async getCurrentUserId() {
    if (!this.currentUserId) {
      try {
        const token = await getSecureItem('accessToken');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.currentUserId = payload.id;
        }
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }
    return this.currentUserId;
  }

  // ✅ جلب المحادثات
  async getConversations() {
    try {
      const response = await apiClient.get(`${this.baseUrl}/conversations`);
      
      let conversations = [];
      
      if (response.data?.data?.conversations) {
        conversations = response.data.data.conversations;
      } else if (response.data?.data) {
        conversations = response.data.data;
      } else if (Array.isArray(response.data)) {
        conversations = response.data;
      }
      
      const normalizedConversations = await this.normalizeConversations(conversations);
      
      return { 
        success: true, 
        data: normalizedConversations 
      };
    } catch (error) {
      console.error('Get conversations error:', error);
      return { 
        success: true, 
        data: [] 
      };
    }
  }

  async sendMessage(conversationId, content, type = 'text') {
    try {
      const response = await apiClient.post(`${this.baseUrl}/conversations/${conversationId}/messages/text`, {
        content
      });
      
      let message = response.data?.data?.message || response.data?.data || response.data;
      
      return { 
        success: true, 
        data: await this.normalizeMessage(message) 
      };
    } catch (error) {
      console.error('Send message error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل إرسال الرسالة',
      };
    }
  }

  async getMessages(conversationId, page = 1, limit = 50) {
    try {
      const response = await apiClient.get(`${this.baseUrl}/conversations/${conversationId}/messages`, {
        params: { page, limit },
      });
      
      let messages = response.data?.data?.messages || response.data?.data || [];
      
      return { 
        success: true, 
        data: await this.normalizeMessages(messages),
        pagination: response.data?.data?.pagination
      };
    } catch (error) {
      console.error('Get messages error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'فشل جلب الرسائل',
      };
    }
  }

  async markMessagesAsRead(conversationId) {
    try {
      await apiClient.put(`${this.baseUrl}/conversations/${conversationId}/read`);
      return { success: true };
    } catch (error) {
      console.error('Mark read error:', error);
      return { success: false };
    }
  }

  // ========== دوال مساعدة ==========
  
  async normalizeConversations(conversations) {
    const currentUserId = await this.getCurrentUserId();
    
    if (!Array.isArray(conversations)) {
      return [];
    }
    
    return conversations.map(conv => ({
      id: conv._id,
      title: conv.title || 'محادثة',
      type: conv.type || 'direct',
      participants: conv.participants || [],
      lastMessage: conv.lastMessage,
      lastMessageText: conv.lastMessage?.content?.text || '',
      lastActivity: conv.lastActivity || conv.updatedAt,
      unreadCount: conv.unreadCount || 0,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt,
      otherParticipant: conv.otherParticipant || conv.participants?.find(p => p._id !== currentUserId)
    }));
  }

  async normalizeMessages(messages) {
    const currentUserId = await this.getCurrentUserId();
    
    if (!Array.isArray(messages)) {
      return [];
    }
    
    return messages.map(msg => ({
      id: msg._id,
      content: msg.content?.text || '',
      type: msg.type || 'text',
      sender: msg.sender,
      isMine: msg.sender?._id === currentUserId || msg.sender === currentUserId,
      createdAt: msg.delivery?.sentAt || msg.createdAt,
      time: this.formatTime(msg.delivery?.sentAt || msg.createdAt)
    }));
  }

  async normalizeMessage(message) {
    const currentUserId = await this.getCurrentUserId();
    
    if (!message) return null;
    
    return {
      id: message._id,
      content: message.content?.text || '',
      type: message.type || 'text',
      sender: message.sender,
      isMine: message.sender?._id === currentUserId || message.sender === currentUserId,
      createdAt: message.delivery?.sentAt || message.createdAt,
      time: this.formatTime(message.delivery?.sentAt || message.createdAt)
    };
  }

  formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  }
}

// ✅ إنشاء مثيل واحد من الخدمة
const chatService = new ChatService();

// ✅ تصدير الدوال بشكل فردي للاستخدام المباشر
export const getConversations = () => chatService.getConversations();
export const getMessages = (conversationId, page, limit) => chatService.getMessages(conversationId, page, limit);
export const sendMessage = (conversationId, content) => chatService.sendMessage(conversationId, content);
export const markMessagesAsRead = (conversationId) => chatService.markMessagesAsRead(conversationId);

// ✅ تصدير الخدمة كاملة أيضاً (للحالات التي تحتاجها)
export default chatService;