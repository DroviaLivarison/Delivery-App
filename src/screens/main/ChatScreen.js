import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import ChatBubble from '../../components/chat/ChatBubble';
import ChatInput from '../../components/chat/ChatInput';
import { getMessages, sendMessage, markMessagesAsRead } from '../../api/chat';
import { onEvent, offEvent, getSocket } from '../../api/socket';
import { colors } from '../../styles/colors';
import { globalStyles } from '../../styles/globalStyles';

export default function ChatScreen() {
  const route = useRoute();
  const { conversationId, title } = route.params;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef();

  const loadMessages = async () => {
    const result = await getMessages(conversationId);
    if (result.success) {
      setMessages(result.data);
      await markMessagesAsRead(conversationId);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();
    
    // الاستماع للرسائل الجديدة عبر Socket
    const socket = getSocket();
    if (socket) {
      onEvent(`chat:message:${conversationId}`, (data) => {
        setMessages(prev => [...prev, data]);
        markMessagesAsRead(conversationId);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      });
    }
    
    return () => {
      offEvent(`chat:message:${conversationId}`);
    };
  }, [conversationId]);

  const handleSend = async (text) => {
    if (!text.trim()) return;
    
    setSending(true);
    const result = await sendMessage(conversationId, text);
    setSending(false);
    
    if (result.success) {
      setMessages(prev => [...prev, result.data]);
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <Header title={title} showBack />
        <LoadingOverlay visible={true} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <Header title={title} showBack />
      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
        />
        
        <ChatInput onSend={handleSend} loading={sending} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
});