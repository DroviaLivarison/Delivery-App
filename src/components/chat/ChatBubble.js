import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';

export default function ChatBubble({ message }) {
  const isMyMessage = message.isMine;
  
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, isMyMessage ? styles.myMessage : styles.otherMessage]}>
      <View style={[styles.bubble, isMyMessage ? styles.myBubble : styles.otherBubble]}>
        <Text style={[styles.text, isMyMessage ? styles.myText : styles.otherText]}>
          {message.content}
        </Text>
        <Text style={[styles.time, isMyMessage ? styles.myTime : styles.otherTime]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.surfaceVariant,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: typography.body2,
    lineHeight: typography.lineHeightBody2,
  },
  myText: {
    color: colors.surface,
  },
  otherText: {
    color: colors.text,
  },
  time: {
    fontSize: typography.caption,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: colors.primaryLight,
  },
  otherTime: {
    color: colors.textSecondary,
  },
}); 