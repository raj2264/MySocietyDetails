import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { format } from 'date-fns';

// Helper function to generate a random access code
const generateAccessCode = () => {
  // Generate a 6-digit random code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Custom date picker component
const SimpleDateTimePicker = ({ visible, onClose, onSelect, initialDate, isDarkMode, theme }) => {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [manualMode, setManualMode] = useState(false);
  const [calendarMode, setCalendarMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [manualYear, setManualYear] = useState(selectedDate.getFullYear().toString());
  const [manualMonth, setManualMonth] = useState((selectedDate.getMonth() + 1).toString());
  const [manualDay, setManualDay] = useState(selectedDate.getDate().toString());
  const [manualHour, setManualHour] = useState(selectedDate.getHours().toString());
  const [manualMinute, setManualMinute] = useState(selectedDate.getMinutes().toString());
  
  // Date options - next 7 days
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });
  
  // Hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  
  // Minute options (0, 15, 30, 45)
  const minuteOptions = [0, 15, 30, 45];
  
  // Month names for calendar
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Update manual inputs when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setManualYear(selectedDate.getFullYear().toString());
      setManualMonth((selectedDate.getMonth() + 1).toString());
      setManualDay(selectedDate.getDate().toString());
      setManualHour(selectedDate.getHours().toString());
      setManualMinute(selectedDate.getMinutes().toString());
    }
  }, [selectedDate]);
  
  // Generate calendar days for the current month view
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of month
    const firstDay = new Date(year, month, 1);
    const firstDayIndex = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Get number of days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Create array for days
    const days = [];
    
    // Add empty spaces for days before the first day of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    
    // Add actual days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };
  
  const handleDateSelect = (date) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(date.getFullYear());
    newDate.setMonth(date.getMonth());
    newDate.setDate(date.getDate());
    newDate.setSeconds(0);
    setSelectedDate(newDate);
  };
  
  const handleHourSelect = (hour) => {
    const newDate = new Date(selectedDate);
    newDate.setHours(hour);
    // Reset seconds to 0 to avoid the "33" issue
    newDate.setSeconds(0);
    setSelectedDate(newDate);
  };
  
  const handleMinuteSelect = (minute) => {
    const newDate = new Date(selectedDate);
    newDate.setMinutes(minute);
    // Reset seconds to 0 to avoid the "33" issue
    newDate.setSeconds(0);
    setSelectedDate(newDate);
  };
  
  const handleManualEntry = () => {
    try {
      // Parse manual values and create date
      const year = parseInt(manualYear) || new Date().getFullYear();
      const month = parseInt(manualMonth) - 1 || 0; // Month is 0-based
      const day = parseInt(manualDay) || 1;
      const hour = parseInt(manualHour) || 0;
      const minute = parseInt(manualMinute) || 0;
      
      const newDate = new Date(year, month, day, hour, minute, 0); // Set seconds to 0
      
      // Validate date
      if (isNaN(newDate.getTime())) {
        throw new Error('Invalid date');
      }
      
      setSelectedDate(newDate);
      setManualMode(false);
    } catch (error) {
      Alert.alert('Invalid Date', 'Please enter a valid date and time.');
    }
  };
  
  const handlePrevMonth = () => {
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    setCurrentMonth(prevMonth);
  };
  
  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentMonth(nextMonth);
  };
  
  const handleConfirm = () => {
    // Ensure seconds are set to 0 to avoid the "33" issue
    const fixedDate = new Date(selectedDate);
    fixedDate.setSeconds(0);
    onSelect(fixedDate);
    onClose();
  };
  
  const handleModeChange = (mode) => {
    setManualMode(mode === 'manual');
    setCalendarMode(mode === 'calendar');
    
    if (mode === 'calendar') {
      setCurrentMonth(new Date(selectedDate));
    }
  };
  
  if (!visible) return null;
  
  // Calendar day renderer
  const renderCalendarDay = (day, index) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.calendarEmptyDay} />;
    }
    
    const isSelected = 
      selectedDate.getDate() === day.getDate() && 
      selectedDate.getMonth() === day.getMonth() && 
      selectedDate.getFullYear() === day.getFullYear();
    
    const isToday = 
      new Date().getDate() === day.getDate() && 
      new Date().getMonth() === day.getMonth() && 
      new Date().getFullYear() === day.getFullYear();
    
    return (
      <TouchableOpacity
        key={`day-${index}`}
        style={[
          styles.calendarDay,
          isSelected && styles.calendarDaySelected,
          isToday && styles.calendarDayToday,
          {
            backgroundColor: isSelected 
              ? theme.primary 
              : isToday
                ? isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'
                : 'transparent'
          }
        ]}
        onPress={() => handleDateSelect(day)}
      >
        <Text
          style={[
            styles.calendarDayText,
            isSelected && styles.calendarDayTextSelected,
            {
              color: isSelected 
                ? 'white' 
                : isDarkMode ? 'white' : 'black'
            }
          ]}
        >
          {day.getDate()}
        </Text>
      </TouchableOpacity>
    );
  };
  
  // Week day headers
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.simpleDatePickerOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}> 
          <KeyboardAvoidingView
            style={[styles.simpleDatePickerContent, { backgroundColor: isDarkMode ? '#2A2A2A' : 'white' }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          >
          <View style={[styles.simpleDatePickerHeader, { borderBottomColor: isDarkMode ? '#333333' : '#eee' }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.simpleDatePickerButton, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.simpleDatePickerTitle, { color: isDarkMode ? '#FFFFFF' : theme.text }]}>
              {format(selectedDate, 'PPp')}
            </Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={[styles.simpleDatePickerButton, { color: theme.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          
          {/* Mode selection buttons */}
          <View style={styles.modeButtonsContainer}>
            <TouchableOpacity 
              style={[
                styles.modeButton, 
                !manualMode && !calendarMode && styles.modeButtonActive,
                { 
                  backgroundColor: !manualMode && !calendarMode 
                    ? theme.primary 
                    : isDarkMode ? '#3F3F3F' : '#F0F0F0' 
                }
              ]}
              onPress={() => handleModeChange('picker')}
            >
              <Text style={{ 
                color: !manualMode && !calendarMode 
                  ? 'white' 
                  : isDarkMode ? '#FFFFFF' : theme.text 
              }}>
                Quick Select
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.modeButton, 
                calendarMode && styles.modeButtonActive,
                { 
                  backgroundColor: calendarMode 
                    ? theme.primary 
                    : isDarkMode ? '#3F3F3F' : '#F0F0F0' 
                }
              ]}
              onPress={() => handleModeChange('calendar')}
            >
              <Text style={{ 
                color: calendarMode 
                  ? 'white' 
                  : isDarkMode ? '#FFFFFF' : theme.text 
              }}>
                Calendar
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.modeButton, 
                manualMode && styles.modeButtonActive,
                { 
                  backgroundColor: manualMode 
                    ? theme.primary 
                    : isDarkMode ? '#3F3F3F' : '#F0F0F0' 
                }
              ]}
              onPress={() => handleModeChange('manual')}
            >
              <Text style={{ 
                color: manualMode 
                  ? 'white' 
                  : isDarkMode ? '#FFFFFF' : theme.text 
              }}>
                Manual
              </Text>
            </TouchableOpacity>
          </View>
          
          {calendarMode && (
            <View style={styles.calendarContainer}>
              {/* Month navigation */}
              <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={handlePrevMonth}>
                  <Ionicons 
                    name="chevron-back" 
                    size={24} 
                    color={isDarkMode ? 'white' : 'black'} 
                  />
                </TouchableOpacity>
                
                <Text style={[styles.calendarMonthTitle, { color: isDarkMode ? 'white' : 'black' }]}>
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </Text>
                
                <TouchableOpacity onPress={handleNextMonth}>
                  <Ionicons 
                    name="chevron-forward" 
                    size={24} 
                    color={isDarkMode ? 'white' : 'black'} 
                  />
                </TouchableOpacity>
              </View>
              
              {/* Days of week */}
              <View style={styles.calendarWeekDays}>
                {weekDays.map((day, index) => (
                  <Text 
                    key={index}
                    style={[styles.calendarWeekDay, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }]}
                  >
                    {day}
                  </Text>
                ))}
              </View>
              
              {/* Calendar grid */}
              <View style={styles.calendarGrid}>
                {generateCalendarDays().map((day, index) => renderCalendarDay(day, index))}
              </View>
              
              {/* Time selector */}
              <View style={styles.calendarTimeContainer}>
                <Text style={[styles.calendarTimeLabel, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>
                  Time:
                </Text>
                <View style={styles.calendarTimeSelectors}>
                  <View style={styles.calendarTimeSelector}>
                    <TouchableOpacity 
                      style={[styles.calendarTimeButton, { backgroundColor: isDarkMode ? '#3F3F3F' : '#F0F0F0' }]}
                      onPress={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setHours(Math.min(23, newDate.getHours() + 1));
                        newDate.setSeconds(0);
                        setSelectedDate(newDate);
                      }}
                    >
                      <Ionicons name="chevron-up" size={20} color={isDarkMode ? 'white' : 'black'} />
                    </TouchableOpacity>
                    
                    <Text style={[styles.calendarTimeText, { color: isDarkMode ? 'white' : 'black' }]}>
                      {selectedDate.getHours().toString().padStart(2, '0')}
                    </Text>
                    
                    <TouchableOpacity 
                      style={[styles.calendarTimeButton, { backgroundColor: isDarkMode ? '#3F3F3F' : '#F0F0F0' }]}
                      onPress={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setHours(Math.max(0, newDate.getHours() - 1));
                        newDate.setSeconds(0);
                        setSelectedDate(newDate);
                      }}
                    >
                      <Ionicons name="chevron-down" size={20} color={isDarkMode ? 'white' : 'black'} />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={[styles.calendarTimeSeparator, { color: isDarkMode ? 'white' : 'black' }]}>:</Text>
                  
                  <View style={styles.calendarTimeSelector}>
                    <TouchableOpacity 
                      style={[styles.calendarTimeButton, { backgroundColor: isDarkMode ? '#3F3F3F' : '#F0F0F0' }]}
                      onPress={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setMinutes(Math.min(59, newDate.getMinutes() + 5));
                        newDate.setSeconds(0);
                        setSelectedDate(newDate);
                      }}
                    >
                      <Ionicons name="chevron-up" size={20} color={isDarkMode ? 'white' : 'black'} />
                    </TouchableOpacity>
                    
                    <Text style={[styles.calendarTimeText, { color: isDarkMode ? 'white' : 'black' }]}>
                      {selectedDate.getMinutes().toString().padStart(2, '0')}
                    </Text>
                    
                    <TouchableOpacity 
                      style={[styles.calendarTimeButton, { backgroundColor: isDarkMode ? '#3F3F3F' : '#F0F0F0' }]}
                      onPress={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setMinutes(Math.max(0, newDate.getMinutes() - 5));
                        newDate.setSeconds(0);
                        setSelectedDate(newDate);
                      }}
                    >
                      <Ionicons name="chevron-down" size={20} color={isDarkMode ? 'white' : 'black'} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
          
          {manualMode && (
            <View style={styles.manualEntryContainer}>
              <Text style={[styles.manualEntryLabel, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>
                Enter Date & Time Manually:
              </Text>
              
              <View style={styles.manualEntryRow}>
                <View style={styles.manualEntryField}>
                  <Text style={[styles.manualEntryFieldLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                    Day
                  </Text>
                  <TextInput
                    style={[styles.manualEntryInput, { 
                      color: isDarkMode ? '#FFFFFF' : theme.text,
                      backgroundColor: isDarkMode ? '#2F2F2F' : '#F8F8F8',
                      borderColor: isDarkMode ? '#444' : '#DDD'
                    }]}
                    value={manualDay}
                    onChangeText={setManualDay}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="DD"
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
                  />
                </View>
                
                <View style={styles.manualEntryField}>
                  <Text style={[styles.manualEntryFieldLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                    Month
                  </Text>
                  <TextInput
                    style={[styles.manualEntryInput, { 
                      color: isDarkMode ? '#FFFFFF' : theme.text,
                      backgroundColor: isDarkMode ? '#2F2F2F' : '#F8F8F8',
                      borderColor: isDarkMode ? '#444' : '#DDD'
                    }]}
                    value={manualMonth}
                    onChangeText={setManualMonth}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
                  />
                </View>
                
                <View style={styles.manualEntryField}>
                  <Text style={[styles.manualEntryFieldLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                    Year
                  </Text>
                  <TextInput
                    style={[styles.manualEntryInput, { 
                      color: isDarkMode ? '#FFFFFF' : theme.text,
                      backgroundColor: isDarkMode ? '#2F2F2F' : '#F8F8F8',
                      borderColor: isDarkMode ? '#444' : '#DDD'
                    }]}
                    value={manualYear}
                    onChangeText={setManualYear}
                    keyboardType="numeric"
                    maxLength={4}
                    placeholder="YYYY"
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
                  />
                </View>
              </View>
              
              <View style={styles.manualEntryRow}>
                <View style={styles.manualEntryField}>
                  <Text style={[styles.manualEntryFieldLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                    Hour (24h)
                  </Text>
                  <TextInput
                    style={[styles.manualEntryInput, { 
                      color: isDarkMode ? '#FFFFFF' : theme.text,
                      backgroundColor: isDarkMode ? '#2F2F2F' : '#F8F8F8',
                      borderColor: isDarkMode ? '#444' : '#DDD'
                    }]}
                    value={manualHour}
                    onChangeText={setManualHour}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
                  />
                </View>
                
                <View style={styles.manualEntryField}>
                  <Text style={[styles.manualEntryFieldLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                    Minute
                  </Text>
                  <TextInput
                    style={[styles.manualEntryInput, { 
                      color: isDarkMode ? '#FFFFFF' : theme.text,
                      backgroundColor: isDarkMode ? '#2F2F2F' : '#F8F8F8',
                      borderColor: isDarkMode ? '#444' : '#DDD'
                    }]}
                    value={manualMinute}
                    onChangeText={setManualMinute}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.manualEntryApplyButton, { backgroundColor: theme.primary }]}
                  onPress={handleManualEntry}
                >
                  <Text style={styles.manualEntryApplyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {!calendarMode && !manualMode && (
            <View style={styles.simpleDatePickerSections}>
              {/* Date Section */}
              <View style={styles.simpleDatePickerSection}>
                <Text style={[styles.simpleDatePickerSectionTitle, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.simpleDatePickerOptions}>
                    {dateOptions.map((date, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.simpleDatePickerOption,
                          selectedDate.getDate() === date.getDate() && 
                          selectedDate.getMonth() === date.getMonth() && 
                          selectedDate.getFullYear() === date.getFullYear() && 
                          styles.simpleDatePickerOptionSelected,
                          {
                            backgroundColor: selectedDate.getDate() === date.getDate() && 
                                             selectedDate.getMonth() === date.getMonth() && 
                                             selectedDate.getFullYear() === date.getFullYear() 
                                             ? theme.primary 
                                             : isDarkMode ? '#3F3F3F' : '#F0F0F0'
                          }
                        ]}
                        onPress={() => handleDateSelect(date)}
                      >
                        <Text 
                          style={[
                            styles.simpleDatePickerOptionText,
                            {
                              color: selectedDate.getDate() === date.getDate() && 
                                     selectedDate.getMonth() === date.getMonth() && 
                                     selectedDate.getFullYear() === date.getFullYear() 
                                     ? 'white' 
                                     : isDarkMode ? '#FFFFFF' : theme.text
                            }
                          ]}
                        >
                          {format(date, 'E, MMM d')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              
              {/* Hour Section */}
              <View style={styles.simpleDatePickerSection}>
                <Text style={[styles.simpleDatePickerSectionTitle, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>Hour</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.simpleDatePickerOptions}>
                    {hourOptions.map((hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.simpleDatePickerOption,
                          selectedDate.getHours() === hour && styles.simpleDatePickerOptionSelected,
                          {
                            backgroundColor: selectedDate.getHours() === hour 
                                             ? theme.primary 
                                             : isDarkMode ? '#3F3F3F' : '#F0F0F0'
                          }
                        ]}
                        onPress={() => handleHourSelect(hour)}
                      >
                        <Text 
                          style={[
                            styles.simpleDatePickerOptionText,
                            {
                              color: selectedDate.getHours() === hour 
                                     ? 'white' 
                                     : isDarkMode ? '#FFFFFF' : theme.text
                            }
                          ]}
                        >
                          {hour < 10 ? `0${hour}` : hour}:00
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              
              {/* Minute Section */}
              <View style={styles.simpleDatePickerSection}>
                <Text style={[styles.simpleDatePickerSectionTitle, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>Minute</Text>
                <View style={styles.simpleDatePickerMinutesOptions}>
                  {minuteOptions.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.simpleDatePickerMinuteOption,
                        selectedDate.getMinutes() === minute && styles.simpleDatePickerOptionSelected,
                        {
                          backgroundColor: selectedDate.getMinutes() === minute 
                                           ? theme.primary 
                                           : isDarkMode ? '#3F3F3F' : '#F0F0F0'
                        }
                      ]}
                      onPress={() => handleMinuteSelect(minute)}
                    >
                      <Text 
                        style={[
                          styles.simpleDatePickerOptionText,
                          {
                            color: selectedDate.getMinutes() === minute 
                                   ? 'white' 
                                   : isDarkMode ? '#FFFFFF' : theme.text
                          }
                        ]}
                      >
                        {minute < 10 ? `0${minute}` : minute}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default function VisitorForm({ residentData, onSuccess }) {
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorPurpose, setVisitorPurpose] = useState('');
  const [expectedDate, setExpectedDate] = useState(new Date());
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Default to 24h expiry
  const [showExpectedPicker, setShowExpectedPicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const { theme, isDarkMode } = useTheme();

  const handleSubmit = async () => {
    if (!visitorName) {
      Alert.alert('Error', 'Visitor name is required', [{ text: 'OK' }]);
      return;
    }

    // Validate dates
    const currentDate = new Date();
    if (!expectedDate || !expiryDate) {
      Alert.alert('Error', 'Please select valid dates', [{ text: 'OK' }]);
      return;
    }

    // Ensure expiry date is after expected date
    if (expiryDate < expectedDate) {
      Alert.alert('Error', 'Access code expiry must be after expected arrival', [{ text: 'OK' }]);
      return;
    }

    try {
      setSubmitting(true);
      
      // Generate a unique access code
      const accessCode = generateAccessCode();
      
      // Prepare visitor data with valid dates
      const visitorData = {
        society_id: residentData.society_id,
        name: visitorName,
        phone: visitorPhone,
        purpose: visitorPurpose,
        flat_number: residentData.unit_number || '',
        resident_id: residentData.id,
        expected_arrival: expectedDate.toISOString(),
        expiry_time: expiryDate.toISOString(),
        access_code: accessCode,
        type: 'guest',
        approval_status: 'approved', // Pre-approved by the resident
        manually_added: false,       // Not manually added by a guard
        added_by_guard: false        // Not added by a guard
      };

      // Add visit_date field if needed (for compatibility)
      if (visitorData.expected_arrival) {
        visitorData.visit_date = visitorData.expected_arrival;
      }
      
      // Add visitor to database
      const { data, error } = await supabase
        .from('visitors')
        .insert(visitorData)
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      // Reset form
      setVisitorName('');
      setVisitorPhone('');
      setVisitorPurpose('');
      setExpectedDate(new Date());
      setExpiryDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
      
      // Call success callback with the new visitor data
      if (onSuccess) {
        onSuccess(data);
      }
      
      // Show success alert after a short delay
      setTimeout(() => {
        Alert.alert(
          'Success', 
          `Visitor added successfully!\nAccess Code: ${accessCode}\nPlease share this code with your visitor.`,
          [{ text: 'OK' }]
        );
      }, 100);
    } catch (error) {
      console.error('Error adding visitor:', error);
      setTimeout(() => {
        Alert.alert('Error', 'Failed to add visitor: ' + (error.message || 'Unknown error'), [{ text: 'OK' }]);
      }, 100);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    >
      <View style={styles.formContainer}>
        <View style={[styles.formField, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>Visitor Name *</Text>
          <TextInput
            style={[styles.input, { 
              color: isDarkMode ? '#FFFFFF' : theme.text, 
              backgroundColor: isDarkMode ? '#3F3F3F' : theme.inputBackground 
            }]}
            placeholder="Enter visitor name"
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
            value={visitorName}
            onChangeText={setVisitorName}
            returnKeyType="next"
          />
        </View>
        
        <View style={[styles.formField, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>Visitor Phone</Text>
          <TextInput
            style={[styles.input, { 
              color: isDarkMode ? '#FFFFFF' : theme.text, 
              backgroundColor: isDarkMode ? '#3F3F3F' : theme.inputBackground 
            }]}
            placeholder="Enter visitor phone"
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
            value={visitorPhone}
            onChangeText={setVisitorPhone}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
        </View>
        
        <View style={[styles.formField, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>Purpose of Visit</Text>
          <TextInput
            style={[styles.input, { 
              color: isDarkMode ? '#FFFFFF' : theme.text, 
              backgroundColor: isDarkMode ? '#3F3F3F' : theme.inputBackground 
            }]}
            placeholder="Enter purpose of visit"
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.6)' : theme.textSecondary}
            value={visitorPurpose}
            onChangeText={setVisitorPurpose}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>
        
        <View style={[styles.formField, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>Expected Arrival</Text>
          <TouchableOpacity 
            style={[styles.dateButton, { backgroundColor: isDarkMode ? '#3F3F3F' : theme.inputBackground }]} 
            onPress={() => setShowExpectedPicker(true)}
          >
            <Text style={{ color: isDarkMode ? '#FFFFFF' : theme.text }}>
              {expectedDate ? format(expectedDate, 'PPpp') : 'Select date'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
          
          <SimpleDateTimePicker
            visible={showExpectedPicker}
            onClose={() => setShowExpectedPicker(false)}
            onSelect={(date) => setExpectedDate(date)}
            initialDate={expectedDate}
            isDarkMode={isDarkMode}
            theme={theme}
          />
        </View>
        
        <View style={[styles.formField, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>Access Code Expiry</Text>
          <TouchableOpacity 
            style={[styles.dateButton, { backgroundColor: isDarkMode ? '#3F3F3F' : theme.inputBackground }]} 
            onPress={() => setShowExpiryPicker(true)}
          >
            <Text style={{ color: isDarkMode ? '#FFFFFF' : theme.text }}>
              {expiryDate ? format(expiryDate, 'PPpp') : 'Select date'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
          
          <SimpleDateTimePicker
            visible={showExpiryPicker}
            onClose={() => setShowExpiryPicker(false)}
            onSelect={(date) => setExpiryDate(date)}
            initialDate={expiryDate}
            isDarkMode={isDarkMode}
            theme={theme}
          />
        </View>
        
        <TouchableOpacity
          style={[
            styles.submitButton, 
            { 
              backgroundColor: theme.primary,
              opacity: submitting ? 0.7 : 1 
            }
          ]}
          onPress={() => {
            if (!submitting) {
              handleSubmit();
            }
          }}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Generate Access Code</Text>
          )}
        </TouchableOpacity>
        
        <View style={styles.noteContainer}>
          <Text style={[styles.noteText, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
            Note: The access code will be generated automatically and can be shared with your visitor.
            Guards will scan or enter this code to verify your visitor.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  formContainer: {
    flex: 1,
  },
  formField: {
    marginBottom: 16,
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 44,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  dateButton: {
    height: 44,
    borderRadius: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  submitButton: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteContainer: {
    marginBottom: 24,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // New Simple DatePicker Styles
  simpleDatePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  simpleDatePickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
    minHeight: 500,
  },
  pickerScrollView: {
    flex: 1,
  },
  pickerScrollContent: {
    paddingBottom: 20,
  },
  simpleDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  simpleDatePickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  simpleDatePickerButton: {
    fontSize: 16,
    fontWeight: '600',
    padding: 4,
  },
  simpleDatePickerSections: {
    gap: 20,
  },
  simpleDatePickerSection: {
    marginBottom: 16,
  },
  simpleDatePickerSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  simpleDatePickerOptions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  simpleDatePickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  simpleDatePickerMinutesOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  simpleDatePickerMinuteOption: {
    width: '22%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleDatePickerOptionSelected: {
    borderWidth: 0,
  },
  simpleDatePickerOptionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  manualModeButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  manualEntryContainer: {
    padding: 8,
  },
  manualEntryLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  manualEntryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  manualEntryField: {
    flex: 1,
    marginRight: 12,
  },
  manualEntryFieldLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  manualEntryInput: {
    height: 44,
    borderRadius: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 16,
    textAlign: 'center',
  },
  manualEntryApplyButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    width: '25%',
    marginTop: 18,
  },
  manualEntryApplyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  modeButtonActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  calendarContainer: {
    flex: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarWeekDay: {
    width: 36,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarDay: {
    width: '14.28%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    marginVertical: 4,
  },
  calendarDaySelected: {
    backgroundColor: '#007AFF',
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: 'gray',
  },
  calendarDayText: {
    fontSize: 14,
  },
  calendarDayTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  calendarEmptyDay: {
    width: '14.28%',
    height: 36,
  },
  calendarTimeContainer: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTimeLabel: {
    fontSize: 16,
    marginRight: 16,
    fontWeight: '500',
  },
  calendarTimeSelectors: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarTimeSelector: {
    alignItems: 'center',
  },
  calendarTimeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  calendarTimeText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  calendarTimeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
}); 