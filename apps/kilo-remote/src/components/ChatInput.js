import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import DropDownPicker from 'react-native-dropdown-picker';
import { useTheme } from '../hooks/useTheme';
import { getChatInputStyles } from '../styles';

const ChatInput = ({
  inputValue,
  setInputValue,
  isStreaming,
  handleSend,
  handleCancel,
  inputRef,
  mode,
  onModeChange,
}) => {
  const { theme } = useTheme();
  const styles = getChatInputStyles(theme);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    { label: 'Architect', value: 'architect' },
    { label: 'Code', value: 'code' },
    { label: 'Ask', value: 'ask' },
    { label: 'Debug', value: 'debug' },
    { label: 'Orchestrator', value: 'orchestrator' },
    { label: 'Translate', value: 'translate' },
    { label: 'Test', value: 'test' },
  ]);

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        value={inputValue}
        onChangeText={setInputValue}
        placeholder="Type a message..."
        placeholderTextColor={theme.dim}
        multiline
        style={styles.textInput}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Enter' && e.nativeEvent.metaKey) {
            handleSend();
            Keyboard.dismiss(); // Hide keyboard on CMD+Enter
          }
        }}
      />

      <View style={styles.bottomBar}>
        <View style={styles.pickerContainer}>
          <DropDownPicker
            open={open}
            value={mode}
            items={items}
            setOpen={setOpen}
            setValue={onModeChange}
            setItems={setItems}
            theme={theme.dark ? 'DARK' : 'LIGHT'}
            style={styles.pickerStyle}
            dropDownContainerStyle={styles.dropDownContainerStyle}
            labelStyle={styles.labelStyle}
            listItemLabelStyle={styles.listItemLabelStyle}
            placeholder="Select a mode"
            listMode="SCROLLVIEW"
            zIndex={3000}
            zIndexInverse={1000}
            modal={true}
            onBackdropPress={() => setOpen(false)}
          />
        </View>

        {isStreaming ? (
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Icon name="stop" size={22} style={styles.cancelIcon} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              handleSend();
              Keyboard.dismiss(); // Hide keyboard when pressing Send button
            }}
            style={styles.sendButton}
          >
            <Icon name="send" size={22} style={styles.sendIcon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default ChatInput;
