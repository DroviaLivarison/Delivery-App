// src/screens/main/ChatListScreen.js - تأكد من الاستيراد
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import ConversationItem from '../../components/chat/ConversationItem';
// ✅ استيراد مباشر للدالة
import { getConversations } from '../../api/chat';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';
import { globalStyles } from '../../styles/globalStyles';

export default function ChatListScreen() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  const loadConversations = useCallback(async () => {
    try {
      console.log('🔄 Loading conversations...');
      const result = await getConversations();
      console.log('📦 Conversations result:', result);
      
      let conversationsList = [];
      if (result.success && result.data) {
        conversationsList = Array.isArray(result.data) ? result.data : [];
      }
      
      setConversations(conversationsList);
    } catch (error) {
      console.error('❌ Load conversations error:', error);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      const refreshLight = async () => {
        try {
          const result = await getConversations();
          if (result.success && result.data) {
            setConversations(Array.isArray(result.data) ? result.data : []);
          }
        } catch (error) {
          console.error('Refresh light error:', error);
        }
      };
      refreshLight();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const handleConversationPress = (conversation) => {
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      title: conversation.title || 'محادثة',
    });
  };

  const renderEmptyState = () => (
    <View style={globalStyles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.textDisabled} />
      <Text style={globalStyles.emptyText}>لا توجد محادثات</Text>
      <Text style={styles.emptySubtext}>
        ستظهر هنا محادثاتك مع العملاء والمتاجر
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <Header title="المحادثات" showNotification />
        <View style={styles.loadingContainer}>
          <LoadingOverlay visible={true} message="جاري تحميل المحادثات..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <Header title="المحادثات" showNotification />
      
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item)}
          />
        )}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={conversations.length === 0 && styles.emptyList}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emptyList: {
    flexGrow: 1,
  },
  emptySubtext: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});